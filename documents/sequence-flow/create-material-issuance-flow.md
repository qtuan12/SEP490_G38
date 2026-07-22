# Create Material Issuance

> All handlers use **`IUnitOfWork`** → **`IGenericRepository<T>`** (generic), no custom repository per entity. 🐶

## 1. Class Diagram

```mermaid
%%{init: { 'themeConfig': { 'showMethods': false, 'showAttributes': false } } }%
classDiagram

    %% ================= FRONTEND LAYER (ReactJS) =================
    class InventoryWorkspace
    class CreateIssuanceModal
    class inventoryService

    %% ================= API / CONTROLLER LAYER =================
    class MaterialIssuancesController
    class IMediator {
        <<interface>>
    }

    %% ================= APPLICATION LAYER (CQRS & MediatR) =================
    class CreateMaterialIssuanceCommand
    class MaterialIssuanceDetailDto
    class ValidationBehavior
    class CreateMaterialIssuanceCommandValidator
    class CreateMaterialIssuanceCommandHandler

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
    class MaterialIssuance
    class MaterialIssuanceItem
    class ProjectTask
    class CurrentInventory
    class MaterialCatalog

    %% ================= RELATIONSHIPS & UML ARROWS =================
    %% Frontend Layer
    InventoryWorkspace *-- CreateIssuanceModal
    CreateIssuanceModal ..> inventoryService : calls create issuance

    %% FE <-> BE Integration Boundary (Vòng khép kín FE-BE)
    inventoryService ..> MaterialIssuancesController : POST /materialissuances (gửi issuance payload)
    MaterialIssuancesController ..> inventoryService : HTTP 200 OK (trả MaterialIssuanceDetailDto)

    %% API / Controller Layer
    MaterialIssuancesController o-- IMediator
    MaterialIssuancesController ..> CreateMaterialIssuanceCommand : binds body
    MaterialIssuancesController ..> MaterialIssuanceDetailDto : returns result

    %% Application Layer (MediatR CQRS)
    ValidationBehavior o-- CreateMaterialIssuanceCommandValidator
    CreateMaterialIssuanceCommandValidator ..> CreateMaterialIssuanceCommand : validates
    CreateMaterialIssuanceCommandHandler o-- IUnitOfWork
    CreateMaterialIssuanceCommandHandler ..> CreateMaterialIssuanceCommand : handles
    CreateMaterialIssuanceCommandHandler ..> MaterialIssuanceDetailDto : maps result
    CreateMaterialIssuanceCommandHandler ..> MaterialIssuance : creates
    CreateMaterialIssuanceCommandHandler ..> CurrentInventory : deducts stock

    %% Infrastructure Layer (Realization & Aggregation)
    IUnitOfWork o-- IGenericRepository
    UnitOfWork ..|> IUnitOfWork
    GenericRepository ..|> IGenericRepository
    UnitOfWork o-- GenericRepository
    GenericRepository ..> MaterialIssuance : persists

    %% Domain Entities Association & Composition
    MaterialIssuance *-- MaterialIssuanceItem
    MaterialIssuance --> ProjectTask
    MaterialIssuanceItem --> MaterialCatalog
```

## 2. Sequence Diagram

```mermaid
%%{init: { 'themeConfig': { 'mirrorActors': false } } }%
sequenceDiagram
    actor "Warehouse Keeper / Site Manager" as User
    participant ": CreateIssuanceModal (React)" as UI
    participant ": inventoryService.ts" as Service
    participant ": MaterialIssuancesController" as Controller
    participant ": Mediator" as Mediator
    participant ": CreateMaterialIssuanceCommandHandler" as Handler
    participant ": UnitOfWork (EF Core)" as UOW
    participant ": NotificationService" as NotifSvc
    participant ": SignalR Hub" as SignalR
    database ": SQL Server (Database)" as DB
    actor "Online Project Members" as Members

    User ->> UI: 1. Selects Task, selects Materials, enters Issued Quantities & Receiver Name
    activate UI

    note over UI: 2. Client-side Zod validation (task & quantities > 0)

    UI ->> Service: 3. createMaterialIssuance({ TaskId, Items: [...] })
    activate Service
    Service ->> Controller: 4. POST /api/v1/material-issuances (JSON body)
    activate Controller
    Controller ->> Mediator: 5. Send(CreateMaterialIssuanceCommand)
    activate Mediator
    Mediator ->> Handler: 6. Route command to handler
    activate Handler

    Handler ->> UOW: 7. ProjectTasks.GetByIdAsync(taskId) & CurrentInventories.GetAsync(projectId, materialId)
    activate UOW
    UOW ->> DB: 7.1 SELECT task & current inventory records
    activate DB
    DB -->> UOW: 7.2 Returns entity data
    deactivate DB
    UOW -->> Handler: 7.3 task & inventory entities
    deactivate UOW

    Handler ->> Handler: 8. Validate Task.Status == InProgress

    loop [each requested item]
        Handler ->> Handler: 9.1 Validate IssuedQty <= CurrentInventory.Quantity
        alt [insufficient stock]
            Handler -->> Mediator: 9.2.1 Throw InvalidOperationException ("Khong du vat tu trong kho")
            Mediator -->> Controller: 9.2.2 Exception
            Controller -->> Service: 9.2.3 HTTP 400 Bad Request
            Service -->> UI: 9.2.4 Error callback
            UI -->> User: 9.2.5 Display out-of-stock toast
        end
    end

    Handler ->> UOW: 10. BeginTransaction()
    activate UOW
    UOW ->> DB: 10.1 BEGIN TRANSACTION
    activate DB
    DB -->> UOW: 10.2 Transaction Started
    deactivate DB
    UOW -->> Handler: 10.3 Transaction context initialized
    deactivate UOW

    Handler ->> UOW: 11. MaterialIssuances.AddAsync(issuanceEntity)
    activate UOW
    UOW -->> Handler: 11.1 MaterialIssuance tracked in ChangeTracker
    deactivate UOW

    loop [each issued item]
        Handler ->> UOW: 12.1 MaterialIssuanceItems.AddAsync(issuanceItem)
        activate UOW
        UOW -->> Handler: 12.2 Item tracked in ChangeTracker
        deactivate UOW

        Handler ->> UOW: 12.3 CurrentInventories.Update(currentInventory)
        activate UOW
        UOW -->> Handler: 12.4 CurrentInventory stock deducted (-IssuedQty)
        deactivate UOW

        Handler ->> UOW: 12.5 InventoryTransactions.AddAsync(outboundTx)
        activate UOW
        UOW -->> Handler: 12.6 InventoryTransaction tracked
        deactivate UOW
    end

    Handler ->> UOW: 13. SaveChangesAsync() + CommitTransaction()
    activate UOW
    UOW ->> DB: 13.1 INSERT MaterialIssuance, MaterialIssuanceItems, InventoryTransactions; UPDATE CurrentInventory; COMMIT TRANSACTION
    activate DB
    DB -->> UOW: 13.2 Transaction committed success (IssuanceId generated)
    deactivate DB
    UOW -->> Handler: 13.3 Changes persisted successfully
    deactivate UOW

    par [System Notification]
        Handler ->> NotifSvc: 14.1 SendNotificationAsync(TaskAssignee, "Material issuance created", issuanceRef)
        activate NotifSvc
        NotifSvc -->> Handler: 14.2 Notification sent
        deactivate NotifSvc
    and [Realtime Stock Deduction Broadcast]
        Handler ->> SignalR: 14.3 SendToGroupAsync("Project_{projectId}", "ReceiveMaterialIssuanceCreated", MaterialIssuanceDetailDto)
        activate SignalR
        SignalR ->> Members: 14.4 Broadcast ReceiveMaterialIssuanceCreated to Project_{projectId} group
        SignalR -->> Handler: 14.5 Realtime broadcast completed
        deactivate SignalR
        note over Members: Update inventory stock view in real time
    end

    Handler -->> Mediator: 15. Returns MaterialIssuanceDetailDto
    deactivate Handler

    Mediator -->> Controller: 16. Returns MaterialIssuanceDetailDto
    deactivate Mediator

    Controller -->> Service: 17. HTTP 200 OK (ApiResponse<MaterialIssuanceDetailDto>)
    deactivate Controller

    Service -->> UI: 18. success callback (unwrapped MaterialIssuanceDetailDto)
    deactivate Service

    UI -->> User: 19. Close modal + success toast notification
    deactivate UI
```
