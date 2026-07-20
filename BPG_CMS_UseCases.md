# BPG Construction Management System (BPG-CMS) — Business Flow Use Case Specifications

**Project:** SEP490_G38 — BPG-CMS
**Backend:** `BPG_CMS_BE` (.NET 8, C#; MediatR + CQRS + FluentValidation + AutoMapper)
**Frontend:** `BPG_CMS_FE` (React + TypeScript)
**Document language:** English
**Scope of this document:** 9 core business flows — Notifications, Daily Log, Comment, Supplier CRUD, Goods Receipt, Material Return, Current Inventory, Inventory History, Material Issuance.

**Role model (BPG.Domain.Constants.TypeConstants.UserRole):**
- `Admin` — system administrator
- `Director` — company director
- `TechnicalManager` — technical manager
- `SiteEngineer` — site engineer (field staff)
- `Accountant` — accountant
- `ProjectLeader` — project leader (a `ProjectMember` flag `IsLeader`, NOT a `UserRole`)

**Authorization policy summary (BPG.Api\Program.cs):**
- `RequireAdmin` → Admin
- `RequireManagerOrAbove` → Admin, Director, TechnicalManager
- `RequireFieldStaff` → SiteEngineer, TechnicalManager, Admin, Director
- `RequireTechnicalManager` → TechnicalManager
- `RequireDirector` → Director
- `RequireAccountant` → Accountant
- `RequireSiteEngineer` → SiteEngineer
- `RequireProcurement` → Admin, Director, Accountant

> Note: Supplier endpoints use only the generic `[Authorize]` attribute (any authenticated user). In practice the Admin role governs Supplier CRUD; the backend does not enforce a role gate on these endpoints.

---

## 1. Notifications Flow

### Actors
- **Any authenticated user** — views own notifications, marks them read.
- **System (background)** — generates notifications on events (progress updates, comments, etc.). There is **no direct "create notification" API**; notifications are produced internally by services (e.g., `INotificationService.SendNotificationAsync`, `SendNotificationToRoleAsync`).

### Preconditions
- User is authenticated (valid JWT).
- At least one notification row exists with `RecipientId == currentUser`.

### Main Success Scenario
1. User requests `GET /api/notifications/my` (paged).
2. System returns the current user's notifications, ordered (most recent / unread first per implementation).
3. User marks items read via `POST /api/notifications/mark-read` with a body selecting either one `notificationId` or `"all": true`.
4. System sets `IsRead = true` (and `ReadAt`) for the targeted notification(s) and returns success.

### Extensions
- *a.* No notifications exist → system returns an empty paged result.
- *b.* `mark-read` targets an id owned by another user → rejected (handler filters by current user; cross-user mutation is not allowed).
- *c.* Invalid body (neither a valid id nor `all`) → validation error 400.

### Business Rules
- Notifications are **read-only for clients**; creation is server-internal only.
- Only two operations are exposed: list-my and mark-read (single or all).
- `mark-read` is idempotent: re-marking an already-read item is a no-op.

### Authorization
- Endpoints carry `[Authorize]` only → any authenticated user.
- Users may only read/mark **their own** notifications.

### Code Refs
- `BPG.Api\Controllers\NotificationsController.cs` — `GET my`, `POST mark-read`.
- `BPG.Application\IServices\INotificationService.cs` — internal send API.
- `BPG.Domain\Constants\TypeConstants.cs` — `NotificationType` (e.g., `Progress`).

---

## 2. Daily Log Flow (Nhật ký thi công) — 4 Use Cases

### Overview
Project members record daily task progress. Progress updates trigger parent-task rollup, dependency validation, and realtime notifications. Logs are immutable once the edit window expires.

### Use Cases

---

#### UC-DL-01: Create Daily Log

**Actor:** Admin, TechnicalManager, Project Leader (of that project), Assigned Engineer.

**Pre-condition:** Task exists, project `InProgress`, task/ancestors not locked, task has no active subtasks. Decreasing progress requires Admin/TechnicalManager.

**Flow:**
1. Actor `POST /api/dailylogs` with `TaskId`, `NewProgressPercent`, `Description`, optional `Images` (max 5).
2. System verifies task existence, project active status, lock state, authorization.
3. System validates FS dependencies: all non-ancestor predecessors must be 100% (or `Obsolete`).
4. System acquires app lock on project (`sp_getapplock`).
5. System creates `DailyLog`, stores images, updates `Task.ProgressPercent`.
6. Status: 100% → `Completed`, >0 → `InProgress`.
7. System appends `TaskProgressLog`, rolls up parent progress recursively.
8. System commits, sends `NotificationType.Progress`, pushes SignalR `ReceiveDailyLogCreated`.

**Post-condition:** DailyLog created; progress updated; parent tasks recalculated.

---

#### UC-DL-02: View Daily Log List

**Actor:** Any authenticated user with project access.

**Flow:**
1. Actor `GET /api/dailylogs` with paging/filter params (by task, date range).
2. System returns paginated `DailyLogDto[]` (`TaskName`, `CreatorName`, `Images`, `CanEdit`, `EditWindowHours`).

---

#### UC-DL-03: View Progress History

**Actor:** Any authenticated user with project access.

**Flow:**
1. Actor `GET /api/dailylogs/progress-history` for a task.
2. System returns `TaskProgressLog` audit trail (old→new, reason, timestamp).

---

#### UC-DL-04: Edit Daily Log

**Actor:** Original author (same auth as create).

**Pre-condition:** Log exists, `UtcNow <= CreatedAt + EditWindowHours` (default 24h), same calendar day, task/ancestors not locked/obsolete.

**Flow:**
1. Actor `PUT /api/dailylogs/{id}` with new `Description` and/or `Images`.
2. System checks edit window, lock/obsolete status, authorization.
3. System updates only `Description` and `Images` — progress percent unchanged.
4. System sets `IsEdited = true`, `LastEditedAt = UtcNow`.

**Post-condition:** Description/images updated; progress unchanged; `IsEdited` flag set.

---

### Business Rules
- One log per task per day; progress is a snapshot, not cumulative.
- PUT edits only `Description`/`Images` — does NOT change progress.
- Edit window: `DailyLogEditWindowHours` (admin-configurable, default 24h) + same calendar day.
- No-delete policy — logs are kept as-is for audit.
- Concurrent creation serialized via app lock.

### Authorization
- `[Authorize]` on controller; fine-grained in handler.
- Non-Admin/TM must be Project Leader or assigned engineer.
- Progress decrease: Admin/TechnicalManager only.
- Edit requires same auth + ancestor lock/obsolete check.

### Code Refs
- `BPG.Api\Controllers\DailyLogsController.cs`
- `BPG.Application\Features\DailyLogs\Handlers\CreateDailyLogCommandHandler.cs`
- `BPG.Application\Features\DailyLogs\Handlers\UpdateDailyLogCommandHandler.cs`
- `BPG.Application\Features\DailyLogs\Handlers\GetDailyLogsQueryHandler.cs`, `GetTaskProgressHistoryQueryHandler.cs`
- `BPG.Application\Features\DailyLogs\Commands\CreateDailyLogCommandValidator.cs`

---

## 3. Comment Flow (Bình luận nhật ký) — 3 Use Cases

### Overview
Users discuss daily logs via threaded comments. Comments support soft-delete and realtime notifications to log participants.

### Use Cases

---

#### UC-CM-01: Add Comment

**Actor:** Admin, TechnicalManager, Project Member (of the log's project).

**Pre-condition:** Target `DailyLog` exists.

**Flow:**
1. Actor `POST /api/comments` with `LogId` and `Content`.
2. System verifies daily log exists, loads task → phase → project.
3. System checks authorization: Admin/TM unrestricted, otherwise must be `ProjectMember`.
4. System creates `Comment` (`AuthorId = currentUser`, `IsDeleted = false`).
5. System notifies: log creator (if different) + other commenters on same log.
6. System pushes SignalR `ReceiveCommentAdded` to group `Project_{ProjectId}`.
7. System returns `CommentDto`.

**Post-condition:** Comment created; notifications sent to relevant participants.

---

#### UC-CM-02: Edit Comment

**Actor:** Comment author.

**Pre-condition:** Comment exists and belongs to current user.

**Flow:**
1. Actor `PUT /api/comments/{id}` with new `Content`.
2. System verifies ownership; rejects if not the author.
3. System updates comment content.

**Post-condition:** Comment content updated.

---

#### UC-CM-03: Delete Comment

**Actor:** Comment author or Admin.

**Pre-condition:** Comment exists.

**Flow:**
1. Actor `DELETE /api/comments/{id}`.
2. System soft-deletes: sets `IsDeleted = true`.
3. Comment remains in DB but hidden from UI.

**Post-condition:** Comment soft-deleted (not physically removed).

---

### Business Rules
- Comments are threaded under a `DailyLog`, not standalone.
- Delete is soft (`IsDeleted = true`); no physical row removal.
- Notifications avoid duplicates (leader+assignee notified once; author not notified of own comment).

### Authorization
- Controller `[Authorize]` (any authenticated user).
- Handler: Admin/TM or `ProjectMember` of the log's project.
- Edit: author only. Delete: author or Admin.

### Code Refs
- `BPG.Application\Features\Comments\Handlers\AddCommentCommandHandler.cs`
- `BPG.Application\Features\Comments\Commands\AddCommentCommandValidator.cs`, `UpdateCommentCommandValidator.cs`
- `BPG.Application\Features\Comments\Handlers\UpdateCommentCommandHandler.cs`, `DeleteCommentCommandHandler.cs`

---

## 4. Supplier CRUD Flow (Quản lý nhà cung cấp)

### Actors
- **Admin** — governs supplier master data (create / update / delete) in practice.
- (Backend only enforces `[Authorize]`; any authenticated user can technically reach the endpoints.)

### Preconditions
- User is authenticated.
- For create/update: a valid `SupplierName` (trimmed) is supplied.

### Main Success Scenario
1. `GET /api/suppliers` (paged) → list active suppliers (`IsDeleted == false`).
2. `GET /api/suppliers/{id}` → single supplier.
3. `POST /api/suppliers` → create:
   - Name is trimmed; system checks for an **existing supplier with the same name** (case-insensitive, among non-deleted).
   - `Rating` is optional, constrained 1–5.
   - `CollaborationStatus` must be `Active` or `Inactive` (enum).
   - System inserts a new `Supplier` (`IsDeleted = false`).
4. `PUT /api/suppliers/{id}` → update name/contact/address/service-area/rating/note/status.
5. `DELETE /api/suppliers/{id}` → **soft delete**: sets `IsDeleted = true` (no physical row removal).

### Extensions
- *a.* Create with duplicate (case-insensitive) name → rejected (`CreateSupplierCommandHandler` duplicate check).
- *b.* `Rating` outside 1–5 or `CollaborationStatus` invalid → validation error.
- *c.* Update/Delete missing id → 404.
- *d.* Delete does **not** hard-block on linked purchase orders; handler performs soft delete only.

### Business Rules
- Suppliers are **soft-deleted** via `IsDeleted`; no hard-delete endpoint logic found.
- Name uniqueness is enforced at create (case-insensitive) among active suppliers.
- `Rating` is optional; when present, 1–5.
- `CollaborationStatus ∈ {Active, Inactive}`.

### Authorization
- Endpoints carry only `[Authorize]` → any authenticated user in the codebase.
- Operational policy: Admin owns Supplier CRUD. (The backend does not enforce a role gate here — a known gap vs. the intended Admin-only control.)

### Code Refs
- `BPG.Api\Controllers\SuppliersController.cs`
- `BPG.Application\Features\Suppliers\Handlers\CreateSupplierCommandHandler.cs` (trim + duplicate check + soft create)
- `BPG.Application\Features\Suppliers\Handlers\DeleteSupplierCommandHandler.cs` (soft delete `IsDeleted`)
- `BPG.Domain\Constants\TypeConstants.cs` — `SupplierRelationshipHealth`, `CollaborationStatus` semantics.

---

## 5. Goods Receipt Flow (Phiếu nhập kho) — 5 Use Cases

### Overview
Managers record goods received against a Purchase Order. Each receipt increases inventory and advances the PO's fulfillment status.

### Use Cases

---

#### UC-GR-01: Create Goods Receipt

**Actor:** Manager-or-above (Admin, Director, TechnicalManager).

**Pre-condition:** A `PurchaseOrder` (PO) exists; user is authenticated with `RequireManagerOrAbove` policy.

**Flow:**
1. Actor `POST /api/goodsreceipts` with `POId`, ≥1 `Items` (distinct `MaterialId`, `Quantity > 0`, `UnitPrice`), and ≥1 `Images`.
2. System validates: `POId > 0`, images not empty, distinct `MaterialId`s, `Quantity > 0`.
3. System verifies each item's `Quantity` ≤ remaining unreceived PO line quantity.
4. System creates `GoodsReceipt`, stores images, posts `InventoryTransaction` type `GoodsReceipt` (+).
5. System updates PO's received quantities and PO status.
6. System returns created receipt DTO.

**Post-condition:** Inventory increased; PO fulfillment advanced.

---

#### UC-GR-02: View Goods Receipt List

**Actor:** Any authenticated user.

**Flow:**
1. Actor `GET /api/goodsreceipts` with optional paging/filters.
2. System returns paginated list of receipts.

---

#### UC-GR-03: View Goods Receipt Detail

**Actor:** Any authenticated user.

**Flow:**
1. Actor `GET /api/goodsreceipts/{id}`.
2. System returns full receipt DTO with items, images, PO reference.

---

#### UC-GR-04: Update Goods Receipt

**Actor:** Manager-or-above.

**Pre-condition:** Receipt exists and is not cancelled.

**Flow:**
1. Actor `PATCH /api/goodsreceipts/{id}` with updated fields.
2. System validates and applies changes.

**Post-condition:** Receipt fields updated.

---

#### UC-GR-05: Cancel Goods Receipt

**Actor:** Manager-or-above.

**Pre-condition:** Receipt exists.

**Flow:**
1. Actor `DELETE /api/goodsreceipts/{id}`.
2. System cancels the receipt (soft or hard cancel depending on business rules).
3. Inventory is reversed if cancellation affects stock.

**Post-condition:** Receipt cancelled; inventory reduced if previously increased.

---

### Business Rules
- Receipt must have ≥1 item and ≥1 image.
- `MaterialId` must be distinct per receipt.
- Quantities capped at PO's remaining quantity (no over-receipt).
- Inventory increase is an immutable `InventoryTransaction` (`TransactionType.GoodsReceipt`).
- PO status advances automatically toward `Completed`.

### Authorization
- Create: `[Authorize(Policy = RequireManagerOrAbove)]` → Admin, Director, TechnicalManager.
- List/Detail: `[Authorize]` (authenticated).
- Update/Cancel: same as Create.

### Code Refs
- `BPG.Api\Controllers\GoodsReceiptsController.cs` (create `@64` RequireManagerOrAbove)
- `BPG.Application\Features\GoodsReceipts\*` (Commands/Validators/Handlers)
- `BPG.Domain\Constants\TypeConstants.cs` — `TransactionType.GoodsReceipt`

---

## 6. Material Return Flow (Phiếu hoàn trả) — 4 Use Cases

### Overview
Field staff return unused materials from a previous issuance. Returns increase inventory by reversing the original issuance's stock-out.

### Use Cases

---

#### UC-MR-01: Create Material Return

**Actor:** Field Staff (SiteEngineer, TechnicalManager, Admin, Director).

**Pre-condition:** A prior `MaterialIssuance` exists to reference (`OriginalIssuanceId`). User authenticated with `RequireFieldStaff`.

**Flow:**
1. Actor `POST /api/materialreturns` with `OriginalIssuanceId`, `Reason`, ≥1 `Items` (distinct `MaterialId`, `Quantity > 0`).
2. System validates: `OriginalIssuanceId > 0`, `Reason` required, distinct items, `Quantity > 0`.
3. System verifies referenced issuance exists.
4. System creates `MaterialReturn`, posts `InventoryTransaction` type `Return` (+), increasing inventory.
5. System returns created return DTO.

**Post-condition:** Inventory increased; return recorded against original issuance.

---

#### UC-MR-02: View Return List

**Actor:** Field Staff.

**Flow:**
1. Actor `GET /api/materialreturns` with optional filters/paging.
2. System returns paginated list of returns.

---

#### UC-MR-03: View Return Detail

**Actor:** Field Staff.

**Flow:**
1. Actor `GET /api/materialreturns/{id}`.
2. System returns full return DTO with items, reason, reference issuance.

---

#### UC-MR-04: Delete Material Return

**Actor:** Admin or original creator.

**Pre-condition:** Return exists.

**Flow:**
1. Actor `DELETE /api/materialreturns/{id}`.
2. System cancels the return; inventory is reversed (stock-out) if the return was already posted.

**Post-condition:** Return cancelled; inventory reverted.

---

### Business Rules
- Every return must reference the original issuance (`OriginalIssuanceId > 0`).
- `Reason` is mandatory.
- Returns increase inventory via immutable `Return` transaction.
- Immutable after creation; delete reverses the inventory effect.

### Authorization
- Create: `[Authorize(Policy = RequireFieldStaff)]` → SiteEngineer, TechnicalManager, Admin, Director.
- List/Detail/Delete: same policy.

### Code Refs
- `BPG.Api\Controllers\MaterialReturnsController.cs` (`@19` RequireFieldStaff)
- `BPG.Application\Features\MaterialReturns\*` (Commands/Validators/Handlers)
- `BPG.Domain\Constants\TypeConstants.cs` — `TransactionType.Return`

---

## 7. Current Inventory Flow (Tồn kho hiện tại) — 3 Use Cases

### Overview
Any authenticated user can view the current virtual inventory for a project. Inventory is derived from the append-only transaction ledger, not stored as a mutable column.

### Use Cases

---

#### UC-CI-01: View Current Inventory by Project

**Actor:** Any authenticated user with project access.

**Pre-condition:** `ProjectId` is valid.

**Flow:**
1. Actor `GET /api/inventory/current?projectId=...`.
2. System computes virtual inventory per material: sum of all `InventoryTransaction` deltas (receipts `+`, issuances `−`, returns `+`, adjustments `±`, transfers `±`).
3. System returns paged list of `{ MaterialId, MaterialName, CurrentQuantity, Unit }`.

**Post-condition:** None (read-only query).

---

#### UC-CI-02: Filter Current Inventory by Material

**Actor:** Any authenticated user.

**Pre-condition:** As above.

**Flow:**
1. Actor `GET /api/inventory/current?projectId=...&materialId=...`.
2. System narrows to a single material's current quantity.

---

#### UC-CI-03: Search Current Inventory by Keyword

**Actor:** Any authenticated user.

**Pre-condition:** As above.

**Flow:**
1. Actor `GET /api/inventory/current?projectId=...&search=...`.
2. System filters by material name/code keyword match.

---

### Business Rules
- Inventory is **derived** (running sum of append-only `InventoryTransaction` ledger).
- `CurrentInventory` is never negative — guaranteed by issuance hard-block (flow 9).
- Concurrency uses `RowVersion` optimistic locking.

### Authorization
- Controller `[Authorize]` (any authenticated user).
- Project-membership scoping enforced at query/handler level.

### Code Refs
- `BPG.Api\Controllers\InventoryController.cs`
- `BPG.Application\Features\Inventory\Queries\GetCurrentInventoryQuery.cs` (params: `ProjectId`, optional `MaterialId?`, optional `Search`)
- `BPG.Domain\Entities\InventoryTransaction.cs`, material/stock entities with `RowVersion`

---

## 8. Inventory History Flow (Lịch sử giao dịch kho) — 1 Use Case

### Overview
Users query the append-only inventory transaction ledger. History is the source of truth that feeds the Current Inventory view (flow 7).

### Use Cases

---

#### UC-IH-01: View Inventory Transaction History

**Actor:** Any authenticated user with project access.

**Pre-condition:** `ProjectId` is supplied and valid.

**Flow:**
1. Actor `GET /api/inventory/transactions?projectId=...&materialId=...&transactionType=...`.
2. System returns the `InventoryTransaction` ledger, optionally filtered by `MaterialId` and/or `TransactionType` (byte enum).
3. Each row: `TransactionType` (GoodsReceipt, Issuance, Return, Adjustment, Transfer), quantity delta, reference ID, timestamp, actor.

**Post-condition:** None (read-only query).

---

### Business Rules
- The ledger is **append-only**; transactions never edited/deleted.
- Corrections use new `Adjustment` or `Transfer` transactions.
- `TransactionType` values: `GoodsReceipt`, `Issuance`, `Return`, `Adjustment`, `Transfer`.

### Authorization
- Controller `[Authorize]` (any authenticated user).

### Code Refs
- `BPG.Api\Controllers\InventoryController.cs`
- `BPG.Application\Features\Inventory\Queries\GetInventoryTransactionsQuery.cs` (params: `ProjectId`, optional `MaterialId?`, optional `TransactionType?` byte)
- `BPG.Domain\Constants\TypeConstants.cs` — `TransactionType`

---

## 9. Material Issuance Flow (Phiếu xuất kho) — 3 Use Cases

### Overview
Field staff issue materials from the project's inventory for a specific task. Issuances are immutable and hard-blocked against insufficient stock to guarantee non-negative inventory.

### Use Cases

---

#### UC-MI-01: Create Material Issuance

**Actor:** Field Staff (SiteEngineer, TechnicalManager, Admin, Director).

**Pre-condition:** A `ProjectTask` exists in an active project; sufficient inventory for all items; user has `RequireFieldStaff` policy.

**Flow:**
1. Actor `POST /api/materialissuances` with `TaskId`, `Purpose`, ≥1 `Items` (distinct `MaterialId`, `Quantity > 0`).
2. System validates: `TaskId > 0`, `Purpose` required, distinct items, `Quantity > 0`.
3. System **hard-blocks** if any item's `Quantity` would make `CurrentInventory < 0`.
4. System creates `MaterialIssuance`, posts `InventoryTransaction` type `Issuance` (−), decreasing inventory.
5. System returns created issuance DTO.

**Post-condition:** Inventory decreased; issuance recorded (immutable).

---

#### UC-MI-02: View Issuance List

**Actor:** Field Staff.

**Flow:**
1. Actor `GET /api/materialissuances` with optional filters/paging.
2. System returns paginated list of issuances.

---

#### UC-MI-03: View Issuance Detail

**Actor:** Field Staff.

**Flow:**
1. Actor `GET /api/materialissuances/{id}`.
2. System returns full issuance DTO with items, purpose, task reference.

---

### Business Rules
- `Purpose` is mandatory.
- `MaterialId` must be distinct per issuance.
- Issuances decrease inventory via immutable `Issuance` transaction.
- Hard stock check guarantees `CurrentInventory >= 0` always.
- Issuances are immutable; returns handled via separate Return flow referencing the original issuance.

### Authorization
- `[Authorize(Policy = RequireFieldStaff)]` → SiteEngineer, TechnicalManager, Admin, Director.

### Code Refs
- `BPG.Api\Controllers\MaterialIssuancesController.cs` (`@19` RequireFieldStaff)
- `BPG.Application\Features\MaterialIssuances\*` (Commands/Validators/Handlers)
- `BPG.Domain\Constants\TypeConstants.cs` — `TransactionType.Issuance`

---

## Cross-Flow Inventory Invariant (applies to flows 5, 6, 7, 8, 9)

- **Virtual inventory:** `CurrentInventory(material, project) = Σ InventoryTransaction.QuantityDelta` where `GoodsReceipt:+`, `Issuance:−`, `Return:+`, `Adjustment:±`, `Transfer:±`.
- **Never negative:** guaranteed by the issuAPIance hard-block (flow 9), not by clamping.
- **Append-only ledger:** transactions are never updated/deleted; corrections use new `Adjustment`/`Transfer` rows.
- **Optimistic concurrency:** inventory/material entities use `RowVersion` to prevent lost updates under concurrent issuAPIance/receipt.
