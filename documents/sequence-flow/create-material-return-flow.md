# Create Material Return

> All handlers use **`IUnitOfWork`** → **`IGenericRepository<T>`** (generic), no custom repository per entity. 🐶

## 1. Class Diagram

```mermaid
%%{init: { 'themeConfig': { 'showMethods': false, 'showAttributes': false } } }%
classDiagram

    %% ================= FRONTEND LAYER (ReactJS) =================
    class InventoryWorkspace
    class IssuanceDetailModal
    class inventoryService

    %% ================= API / CONTROLLER LAYER =================
    class MaterialReturnsController
    class IMediator {
        <<interface>>
    }

    %% ================= APPLICATION LAYER (CQRS & MediatR) =================
    class CreateMaterialReturnCommand
    class MaterialReturnDetailDto
    class ValidationBehavior
    class CreateMaterialReturnCommandValidator
    class CreateMaterialReturnCommandHandler

    %% ================= INFRASTRUCTURE LAYER =================
    class IUnitOfWork {
        <<interface>>
    }
    class UnitOfWork
    class IGenericRepository {
        <<interface>>
    }
    class GenericRepository

    %% ================= DOMAIN ENTITIES =================
    class MaterialReturn
    class MaterialReturnItem
    class MaterialIssuance
    class ProjectTask
    class CurrentInventory
    class MaterialCatalog

    %% ================= RELATIONSHIPS & UML ARROWS =================
    %% Frontend Layer
    InventoryWorkspace *-- IssuanceDetailModal
    IssuanceDetailModal ..> inventoryService : calls create return

    %% FE <-> BE Integration Boundary (Vòng khép kín FE-BE)
    inventoryService ..> MaterialReturnsController : POST /materialreturns (gửi return payload)
    MaterialReturnsController ..> inventoryService : HTTP 200 OK (trả MaterialReturnDetailDto)

    %% API / Controller Layer
    MaterialReturnsController o-- IMediator
    MaterialReturnsController ..> CreateMaterialReturnCommand : binds body
    MaterialReturnsController ..> MaterialReturnDetailDto : returns result

    %% Application Layer (MediatR CQRS)
    ValidationBehavior o-- CreateMaterialReturnCommandValidator
    CreateMaterialReturnCommandValidator ..> CreateMaterialReturnCommand : validates
    CreateMaterialReturnCommandHandler o-- IUnitOfWork
    CreateMaterialReturnCommandHandler ..> CreateMaterialReturnCommand : handles
    CreateMaterialReturnCommandHandler ..> MaterialReturnDetailDto : maps result
    CreateMaterialReturnCommandHandler ..> MaterialReturn : creates
    CreateMaterialReturnCommandHandler ..> CurrentInventory : restores stock

    %% Infrastructure Layer (Realization & Aggregation)
    IUnitOfWork o-- IGenericRepository
    UnitOfWork ..|> IUnitOfWork
    GenericRepository ..|> IGenericRepository
    UnitOfWork o-- GenericRepository
    GenericRepository ..> MaterialReturn : persists

    %% Domain Entities Association & Composition
    MaterialReturn *-- MaterialReturnItem
    MaterialReturn --> MaterialIssuance
    MaterialIssuance --> ProjectTask
    MaterialReturnItem --> MaterialCatalog
```

## 2. Sequence Diagram

```mermaid
%%{init: { 'themeConfig': { 'mirrorActors': false } } }%
sequenceDiagram
    actor "Site Engineer / Warehouse Keeper" as User
    participant ": IssuanceDetailModal (React)" as UI
    participant ": inventoryService.ts" as Service
    participant ": MaterialReturnsController" as Controller
    participant ": Mediator" as Mediator
    participant ": CreateMaterialReturnCommandHandler" as Handler
    participant ": UnitOfWork (EF Core)" as UOW
    participant ": NotificationService" as NotifSvc
    participant ": SignalR Hub" as SignalR
    database ": SQL Server (Database)" as DB
    actor "Online Project Members" as Members

    User ->> UI: 1. Selects Original Material Issuance, enters Return Quantities & Reason
    activate UI

    note over UI: 2. Client-side Zod validation (return quantities & reason)

    UI ->> Service: 3. createMaterialReturn({ OriginalIssuanceId, Items: [...], Reason })
    activate Service
    Service ->> Controller: 4. POST /api/v1/materialreturns (JSON body)
    activate Controller
    Controller ->> Mediator: 5. Send(CreateMaterialReturnCommand)
    activate Mediator
    Mediator ->> Handler: 6. Route command to handler
    activate Handler

    Handler ->> UOW: 7. MaterialIssuances.GetByIdWithDetailsAsync(issuanceId)
    activate UOW
    UOW ->> DB: 7.1 SELECT issuance, items & previous return records
    activate DB
    DB -->> UOW: 7.2 Returns issuance entity data
    deactivate DB
    UOW -->> Handler: 7.3 issuance entity
    deactivate UOW

    loop [for each return item]
        Handler ->> Handler: 8. Validate ReturnQty <= (IssuedQty - AlreadyReturnedQty)
    end

    Handler ->> UOW: 9. BeginTransaction()
    activate UOW
    UOW ->> DB: 9.1 BEGIN TRANSACTION
    activate DB
    DB -->> UOW: 9.2 Transaction Started
    deactivate DB
    UOW -->> Handler: 9.3 Transaction context initialized
    deactivate UOW

    Handler ->> UOW: 10. MaterialReturns.AddAsync(returnEntity)
    activate UOW
    UOW -->> Handler: 10.1 MaterialReturn tracked in ChangeTracker
    deactivate UOW

    loop [for each returned item]
        Handler ->> UOW: 11.1 MaterialReturnItems.AddAsync(returnItem)
        activate UOW
        UOW -->> Handler: 11.2 Item tracked in ChangeTracker
        deactivate UOW

        Handler ->> UOW: 11.3 CurrentInventories.Update(currentInventory)
        activate UOW
        UOW -->> Handler: 11.4 CurrentInventory stock restored (+ReturnQty)
        deactivate UOW

        Handler ->> UOW: 11.5 InventoryTransactions.AddAsync(returnTx)
        activate UOW
        UOW -->> Handler: 11.6 InventoryTransaction tracked
        deactivate UOW
    end

    Handler ->> UOW: 12. SaveChangesAsync() + CommitTransaction()
    activate UOW
    UOW ->> DB: 12.1 INSERT MaterialReturn, MaterialReturnItems, InventoryTransactions; UPDATE CurrentInventory; COMMIT TRANSACTION
    activate DB
    DB -->> UOW: 12.2 Transaction committed success (ReturnId generated)
    deactivate DB
    UOW -->> Handler: 12.3 Changes persisted successfully
    deactivate UOW

    par [System Notification]
        Handler ->> NotifSvc: 13.1 SendNotificationAsync(WarehouseManager, "Material return created", returnRef)
        activate NotifSvc
        NotifSvc -->> Handler: 13.2 Notification sent
        deactivate NotifSvc
    and [Realtime Return Broadcast]
        Handler ->> SignalR: 13.3 SendToGroupAsync("Project_{projectId}", "ReceiveMaterialReturnCreated", MaterialReturnDetailDto)
        activate SignalR
        SignalR ->> Members: 13.4 Broadcast ReceiveMaterialReturnCreated to Project_{projectId} group
        SignalR -->> Handler: 13.5 Realtime broadcast completed
        deactivate SignalR
        note over Members: Update inventory stock list & stock cards
    end

    Handler -->> Mediator: 14. Returns MaterialReturnDetailDto
    deactivate Handler

    Mediator -->> Controller: 15. Returns MaterialReturnDetailDto
    deactivate Mediator

    Controller -->> Service: 16. HTTP 200 OK (ApiResponse<MaterialReturnDetailDto>)
    deactivate Controller

    Service -->> UI: 17. success callback (unwrapped MaterialReturnDetailDto)
    deactivate Service

    UI -->> User: 18. Close modal + success toast notification
    deactivate UI
```
