# View Current Inventory

> All handlers use **`IUnitOfWork`** → **`IGenericRepository<T>`** (generic), no custom repository per entity. 🐶

## 1. Class Diagram

```mermaid
%%{init: { 'themeConfig': { 'showMethods': false, 'showAttributes': false } } }%
classDiagram

    %% ================= FRONTEND LAYER (ReactJS) =================
    class InventoryWorkspace
    class InventoryOverviewCards
    class inventoryService

    %% ================= API / CONTROLLER LAYER =================
    class InventoryController
    class IMediator {
        <<interface>>
    }

    %% ================= APPLICATION LAYER (CQRS & MediatR) =================
    class GetCurrentInventoryQuery
    class CurrentInventoryDto
    class MaterialPhaseUsageDto
    class GetCurrentInventoryQueryHandler

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
    class CurrentInventory
    class MaterialCatalog
    class Unit
    class Project
    class Phase
    class BOQItem
    class MaterialIssuanceItem
    class SystemConfig

    %% ================= RELATIONSHIPS & UML ARROWS =================
    %% Frontend Layer
    InventoryWorkspace *-- InventoryOverviewCards
    InventoryOverviewCards ..> inventoryService : calls get inventory

    %% FE <-> BE Integration Boundary (Vòng khép kín FE-BE)
    inventoryService ..> InventoryController : GET /inventory/current (gửi query params)
    InventoryController ..> inventoryService : HTTP 200 OK (trả List~CurrentInventoryDto~)

    %% API / Controller Layer
    InventoryController o-- IMediator
    InventoryController ..> GetCurrentInventoryQuery : binds query
    InventoryController ..> CurrentInventoryDto : returns result

    %% Application Layer (MediatR CQRS)
    GetCurrentInventoryQueryHandler o-- IUnitOfWork
    GetCurrentInventoryQueryHandler ..> GetCurrentInventoryQuery : handles
    GetCurrentInventoryQueryHandler ..> CurrentInventoryDto : maps & aggregates result
    CurrentInventoryDto *-- MaterialPhaseUsageDto

    %% Infrastructure Layer (Realization & Aggregation)
    IUnitOfWork o-- IGenericRepository
    UnitOfWork ..|> IUnitOfWork
    GenericRepository ..|> IGenericRepository
    UnitOfWork o-- GenericRepository
    GenericRepository ..> CurrentInventory : queries stock

    %% Domain Entities Association
    CurrentInventory --> MaterialCatalog
    CurrentInventory --> Unit
    CurrentInventory --> Project
    BOQItem --> Phase
    MaterialIssuanceItem --> MaterialCatalog
```

## 2. Sequence Diagram

```mermaid
%%{init: { 'themeConfig': { 'mirrorActors': false } } }%
sequenceDiagram
    actor "Site Engineer / Manager" as User
    participant ": InventoryOverviewCards (React)" as UI
    participant ": inventoryService.ts" as Service
    participant ": InventoryController" as Controller
    participant ": Mediator" as Mediator
    participant ": GetCurrentInventoryQueryHandler" as Handler
    participant ": UnitOfWork (EF Core)" as UOW
    database ": SQL Server (Database)" as DB

    User ->> UI: 1. Opens Inventory Workspace (Selects Project filter)
    activate UI

    UI ->> Service: 2. getCurrentInventory(projectId)
    activate Service
    Service ->> Controller: 3. GET /api/v1/inventory/current?projectId={projectId}
    activate Controller
    Controller ->> Mediator: 4. Send(GetCurrentInventoryQuery)
    activate Mediator
    Mediator ->> Handler: 5. Route query to handler
    activate Handler

    Handler ->> UOW: 6. SystemConfigs.GetByKeyAsync("LowStockThreshold")
    activate UOW
    UOW ->> DB: 6.1 SELECT ConfigValue FROM SystemConfig WHERE ConfigKey = 'LowStockThreshold'
    activate DB
    DB -->> UOW: 6.2 Returns safety threshold value
    deactivate DB
    UOW -->> Handler: 6.3 Safety threshold value (default 10)
    deactivate UOW

    Handler ->> UOW: 7. Phases.GetByProjectIdAsync(projectId) & BOQItems.GetByProjectIdAsync(projectId)
    activate UOW
    UOW ->> DB: 7.1 SELECT Phase & BOQItem records for Project
    activate DB
    DB -->> UOW: 7.2 Returns Phase & BOQ records
    deactivate DB
    UOW -->> Handler: 7.3 Phase list & BOQ quantities grouped by (MaterialId, PhaseId)
    deactivate UOW

    Handler ->> UOW: 8. MaterialIssuanceItems.GetUsedQtyByProjectIdAsync(projectId)
    activate UOW
    UOW ->> DB: 8.1 SELECT Issued quantities grouped by (MaterialId, PhaseId)
    activate DB
    DB -->> UOW: 8.2 Returns issued usage records
    deactivate DB
    UOW -->> Handler: 8.3 Used quantities map per phase
    deactivate UOW

    Handler ->> UOW: 9. PurchaseOrderItems.GetLastSuppliersAsync(projectId)
    activate UOW
    UOW ->> DB: 9.1 SELECT Latest Supplier per Material
    activate DB
    DB -->> UOW: 9.2 Returns supplier mapping
    deactivate DB
    UOW -->> Handler: 9.3 Supplier map per MaterialId
    deactivate UOW

    Handler ->> UOW: 10. CurrentInventories.GetByProjectIdWithDetailsAsync(projectId)
    activate UOW
    UOW ->> DB: 10.1 SELECT CurrentInventory c INNER JOIN MaterialCatalog m INNER JOIN Unit u WHERE c.ProjectId = @ProjectId
    activate DB
    DB -->> UOW: 10.2 Returns stock records with Material & Unit details
    deactivate DB
    UOW -->> Handler: 10.3 CurrentInventory entity list
    deactivate UOW

    Handler ->> Handler: 11. Calculate BOQ vs Used breakdown per Phase & populate MaterialPhaseUsageDto

    Handler -->> Mediator: 12. Returns List<CurrentInventoryDto>
    deactivate Handler

    Mediator -->> Controller: 13. Returns List<CurrentInventoryDto>
    deactivate Mediator

    Controller -->> Service: 14. HTTP 200 OK (ApiResponse<List<CurrentInventoryDto>>)
    deactivate Controller

    Service ->> Service: 15. Update React Query Cache ('currentInventory', projectId)
    Service -->> UI: 16. Returns stock list & aggregated metrics
    deactivate Service

    UI -->> User: 17. Render Stock Table, Low Stock Alert badges & Phase usage breakdown
    deactivate UI
```
