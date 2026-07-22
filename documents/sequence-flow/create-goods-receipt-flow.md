# Create Goods Receipt

> All handlers use **`IUnitOfWork`** → **`IGenericRepository<T>`** (generic), no custom repository per entity. 🐶

## 1. Class Diagram

```mermaid
%%{init: { 'themeConfig': { 'showMethods': false, 'showAttributes': false } } }%
classDiagram

    %% ================= FRONTEND LAYER (ReactJS) =================
    class InventoryWorkspace
    class CreateReceiptModal
    class inventoryService

    %% ================= API / CONTROLLER LAYER =================
    class GoodsReceiptsController
    class IMediator {
        <<interface>>
    }

    %% ================= APPLICATION LAYER (CQRS & MediatR) =================
    class CreateGoodsReceiptCommand
    class GoodsReceiptDetailDto
    class ValidationBehavior
    class CreateGoodsReceiptCommandValidator
    class CreateGoodsReceiptCommandHandler

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
    class GoodsReceipt
    class GoodsReceiptItem
    class PurchaseOrder
    class CurrentInventory
    class MaterialCatalog

    %% ================= RELATIONSHIPS & UML ARROWS =================
    %% Frontend Layer
    InventoryWorkspace *-- CreateReceiptModal
    CreateReceiptModal ..> inventoryService : calls create receipt

    %% FE <-> BE Integration Boundary (Vòng khép kín FE-BE)
    inventoryService ..> GoodsReceiptsController : POST /goodsreceipts (gửi receipt payload)
    GoodsReceiptsController ..> inventoryService : HTTP 200 OK (trả GoodsReceiptDetailDto)

    %% API / Controller Layer
    GoodsReceiptsController o-- IMediator
    GoodsReceiptsController ..> CreateGoodsReceiptCommand : binds body
    GoodsReceiptsController ..> GoodsReceiptDetailDto : returns result

    %% Application Layer (MediatR CQRS)
    ValidationBehavior o-- CreateGoodsReceiptCommandValidator
    CreateGoodsReceiptCommandValidator ..> CreateGoodsReceiptCommand : validates
    CreateGoodsReceiptCommandHandler o-- IUnitOfWork
    CreateGoodsReceiptCommandHandler ..> CreateGoodsReceiptCommand : handles
    CreateGoodsReceiptCommandHandler ..> GoodsReceiptDetailDto : maps result
    CreateGoodsReceiptCommandHandler ..> GoodsReceipt : creates
    CreateGoodsReceiptCommandHandler ..> CurrentInventory : updates stock

    %% Infrastructure Layer (Realization & Aggregation)
    IUnitOfWork o-- IGenericRepository
    UnitOfWork ..|> IUnitOfWork
    GenericRepository ..|> IGenericRepository
    UnitOfWork o-- GenericRepository
    GenericRepository ..> GoodsReceipt : persists

    %% Domain Entities Association & Composition
    GoodsReceipt *-- GoodsReceiptItem
    GoodsReceipt --> PurchaseOrder
    GoodsReceiptItem --> MaterialCatalog
```

## 2. Sequence Diagram

```mermaid
%%{init: { 'themeConfig': { 'mirrorActors': false } } }%
sequenceDiagram
    actor "Warehouse Keeper / Site Manager" as User
    participant ": CreateReceiptModal (React)" as UI
    participant ": inventoryService.ts" as Service
    participant ": GoodsReceiptsController" as Controller
    participant ": Mediator" as Mediator
    participant ": CreateGoodsReceiptCommandHandler" as Handler
    participant ": UnitOfWork (EF Core)" as UOW
    participant ": NotificationService" as NotifSvc
    participant ": SignalR Hub" as SignalR
    database ": SQL Server (Database)" as DB
    actor "Online Project Members" as Members

    User ->> UI: 1. Selects Purchase Order (PO), enters Received Items & Unit Prices
    activate UI

    note over UI: 2. Client-side Zod validation (items & quantities > 0)

    UI ->> Service: 3. createGoodsReceipt({ PurchaseOrderId, Items: [...] })
    activate Service
    Service ->> Controller: 4. POST /api/v1/goods-receipts (JSON body)
    activate Controller
    Controller ->> Mediator: 5. Send(CreateGoodsReceiptCommand)
    activate Mediator
    Mediator ->> Handler: 6. Route command to handler
    activate Handler

    Handler ->> UOW: 7. PurchaseOrders.GetByIdWithDetailsAsync(purchaseOrderId)
    activate UOW
    UOW ->> DB: 7.1 SELECT PO, POItems & Supplier records
    activate DB
    DB -->> UOW: 7.2 Returns PO entity data
    deactivate DB
    UOW -->> Handler: 7.3 PurchaseOrder entity
    deactivate UOW

    Handler ->> Handler: 8. Validate PO.Status == Approved
    Handler ->> Handler: 9. Validate ReceivedQty <= RemainingOrderedQty

    Handler ->> UOW: 10. BeginTransaction()
    activate UOW
    UOW ->> DB: 10.1 BEGIN TRANSACTION
    activate DB
    DB -->> UOW: 10.2 Transaction Started
    deactivate DB
    UOW -->> Handler: 10.3 Transaction context initialized
    deactivate UOW

    Handler ->> UOW: 11. GoodsReceipts.AddAsync(goodsReceiptEntity)
    activate UOW
    UOW -->> Handler: 11.1 GoodsReceipt tracked in ChangeTracker
    deactivate UOW

    loop [each received item]
        Handler ->> UOW: 12.1 GoodsReceiptItems.AddAsync(receiptItem)
        activate UOW
        UOW -->> Handler: 12.2 Item tracked in ChangeTracker
        deactivate UOW

        Handler ->> UOW: 12.3 CurrentInventories.GetAsync(projectId, materialId)
        activate UOW
        UOW ->> DB: 12.4 SELECT CurrentInventory record
        activate DB
        DB -->> UOW: 12.5 Returns inventory record
        deactivate DB
        UOW -->> Handler: 12.6 CurrentInventory entity
        deactivate UOW

        Handler ->> UOW: 12.7 CurrentInventories.Update(currentInventory)
        activate UOW
        UOW -->> Handler: 12.8 CurrentInventory updated (+ReceivedQty)
        deactivate UOW

        Handler ->> UOW: 12.9 InventoryTransactions.AddAsync(inboundTx)
        activate UOW
        UOW -->> Handler: 12.10 InventoryTransaction tracked
        deactivate UOW
    end

    alt [PO fully received]
        Handler ->> Handler: 13. Set PO.Status = Completed
    end

    Handler ->> UOW: 14. SaveChangesAsync() + CommitTransaction()
    activate UOW
    UOW ->> DB: 14.1 INSERT GoodsReceipt, GoodsReceiptItems, InventoryTransactions; UPDATE CurrentInventory; COMMIT TRANSACTION
    activate DB
    DB -->> UOW: 14.2 Transaction committed success (ReceiptId generated)
    deactivate DB
    UOW -->> Handler: 14.3 Changes persisted successfully
    deactivate UOW

    par [System Notification]
        Handler ->> NotifSvc: 15.1 SendNotificationAsync(ProjectManager, "Goods receipt created", receiptRef)
        activate NotifSvc
        NotifSvc -->> Handler: 15.2 Notification sent
        deactivate NotifSvc
    and [Realtime Stock Update Broadcast]
        Handler ->> SignalR: 15.3 SendToGroupAsync("Project_{projectId}", "ReceiveGoodsReceiptCreated", GoodsReceiptDetailDto)
        activate SignalR
        SignalR ->> Members: 15.4 Broadcast ReceiveGoodsReceiptCreated to Project_{projectId} group
        SignalR -->> Handler: 15.5 Realtime broadcast completed
        deactivate SignalR
        note over Members: Refresh inventory list & stock cards
    end

    Handler -->> Mediator: 16. Returns GoodsReceiptDetailDto
    deactivate Handler

    Mediator -->> Controller: 17. Returns GoodsReceiptDetailDto
    deactivate Mediator

    Controller -->> Service: 18. HTTP 200 OK (ApiResponse<GoodsReceiptDetailDto>)
    deactivate Controller

    Service -->> UI: 19. success callback (unwrapped GoodsReceiptDetailDto)
    deactivate Service

    UI -->> User: 20. Close modal + success toast notification
    deactivate UI
```
