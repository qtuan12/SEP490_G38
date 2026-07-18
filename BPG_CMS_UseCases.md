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

## 2. Daily Log Flow (Nhật ký thi công)

### Actors
- **Admin / TechnicalManager** — may create logs for any task and may decrease progress.
- **Project Leader** of the project — may create logs for tasks in that project.
- **Assigned Engineer** (`TaskAssignee`) — may create logs for tasks assigned to them.

### Preconditions
- User is authenticated.
- Target `ProjectTask` (TaskId) exists and is **not a parent task** (must have no active subtasks).
- Parent project `Status == InProgress`.
- The task (and none of its ancestor tasks) is `IsLocked` (accepted/closed).

### Main Success Scenario
1. User `POST /api/dailylogs` with `TaskId`, `NewProgressPercent`, `Description`, optional `Images` (max 5 URLs).
2. System verifies task existence, project active status, lock state, and authorization (Admin/TM, or Project Leader, or assigned engineer).
3. System validates Finish-to-Start dependencies: all non-ancestor predecessor tasks must be `ProgressPercent == 100` (or `Obsolete`) before progress can increase.
4. System begins a transaction and takes an exclusive SQL application lock on the project (`sp_getapplock` resource `Project_WbsClimb_Lock_{ProjectId}`) to serialize concurrent progress updates.
5. System creates the `DailyLog`, stores image `Attachment`s (EntityType `DailyLog`), and updates `Task.ProgressPercent`.
6. Task status is derived: `100` → `Completed`; `>0` → `InProgress`.
7. System appends a `TaskProgressLog` (old→new, reason = description).
8. System **rolls parent task progress up** (average of non-deleted sibling subtasks) recursively to the top.
9. System commits; sends `NotificationType.Progress` to project leaders (excluding author), other task assignees, and the TechnicalManager role; pushes realtime `ReceiveDailyLogCreated` to group `Project_{ProjectId}`.
10. System returns `DailyLogDto` (with `TaskName`, `CreatorName`, `Images`, `OldProgressPercent`).

### Extensions
- *a.* Task not found → 404 `NotFound`.
- *b.* Not Admin/TM and not leader/assignee → 403 `Forbidden`.
- *c.* Project not `InProgress` → `ERR_PROJECT_NOT_ACTIVE`.
- *d.* Task or ancestor `IsLocked` → `ERR_TASK_LOCKED`.
- *e.* More than 5 images → `ERR_MAX_IMAGES_EXCEEDED`.
- *f.* Parent task with active subtasks → `ERR_TASK_HAS_SUBTASKS`.
- *g.* Increasing progress blocked by incomplete non-ancestor predecessor → `ERR_TASK_DEPENDENCY_BLOCKED` (lists blocking predecessor names).
- *h.* Decreasing progress by non-Admin/TM → `ERR_DECREASE_PROGRESS_FORBIDDEN`; if Admin/TM decreases, `Description` (reason) is **required** → else `ERR_DECREASE_PROGRESS_REASON_REQUIRED`.

### Business Rules
- One log per task per day (`LogDate = today`); progress is a snapshot, not cumulative.
- `PUT /api/dailylogs/{id}` edits **only** `Description` and `Images`; it does NOT change `NewProgressPercent` or task progress.
- **Edit time window (NEW)**: an edit is only allowed within a configurable window of `DailyLog.CreatedAt` (UTC). The window length is **admin-configurable** via SystemConfig key `DailyLogEditWindowHours` (int, hours; default **24h** when unset/invalid). After the window the log is locked to edits (`ERR_EDIT_WINDOW_EXPIRED`). Before the deadline, the same-calendar-day rule applies (must edit before 23:59 of the creation day).
- **Edit audit (NEW)**: every successful edit sets `DailyLog.IsEdited = true` and `DailyLog.LastEditedAt = now` (UTC). The `DailyLogDto` exposes `IsEdited`, `LastEditedAt`, plus **`CanEdit`** (computed: `UtcNow <= CreatedAt + EditWindowHours`) and **`EditWindowHours`** (the resolved config value) so the FE can hide/show the edit button without re-implementing the rule.
- **No-delete policy**: `DailyLog` has NO delete endpoint — logs are kept as-is to preserve audit and progress history.
- `GET /api/dailylogs` lists logs (paged/filtered by task); `GET .../progress-history` returns the `TaskProgressLog` audit trail.
- Concurrent daily-log creation for the same project is serialized via the application lock + DB transaction.

### Authorization
- Controller `[Authorize]` (any authenticated user).
- Fine-grained access enforced **in the handler**: Admin/TM unrestricted; otherwise must be Project Leader or assigned engineer of that task.
- Progress decrease restricted to Admin/TechnicalManager.
- **Update edit guard (NEW)**: the `UpdateDailyLogCommandHandler` reuses the same ancestor-lock/obsolete checks as Create — the target log's task **and every ancestor task** (walked up via `ParentTaskId`) must not be `IsLocked` (`ERR_TASK_LOCKED`) nor `Status == Obsolete` (`ERR_TASK_OBSOLETE`). The configurable edit-window check (above) also applies here, reading `DailyLogEditWindowHours`.

### Code Refs
- `BPG.Api\Controllers\DailyLogsController.cs`
- `BPG.Application\Features\DailyLogs\Handlers\CreateDailyLogCommandHandler.cs` (auth, lock, dependency check, parent roll-up, notifications)
- `BPG.Application\Features\DailyLogs\Handlers\UpdateDailyLogCommandHandler.cs` (description/images only)
- `BPG.Application\Features\DailyLogs\Handlers\GetDailyLogsQueryHandler.cs`, `GetTaskProgressHistoryQueryHandler.cs`
- `BPG.Application\Features\DailyLogs\Commands\CreateDailyLogCommandValidator.cs`

---

## 3. Comment Flow (Bình luận nhật ký)

### Actors
- **Admin / TechnicalManager** — may comment on any daily log.
- **Project Member** of the log's project — may comment.

### Preconditions
- User is authenticated.
- Target `DailyLog` (LogId) exists.

### Main Success Scenario
1. User `POST /api/comments` (or equivalent) with `LogId` and `Content`.
2. System verifies the daily log exists and loads its task → phase → project.
3. System checks authorization: Admin/TM unrestricted, otherwise the user must be a `ProjectMember` of that project.
4. System creates `Comment` (`AuthorId = currentUser`, `IsDeleted = false`).
5. System notifies: the log's creator (if different), and any other users who previously commented on the same log.
6. System pushes realtime `ReceiveCommentAdded` to group `Project_{ProjectId}`.
7. System returns `CommentDto`.

### Extensions
- *a.* Daily log not found → 404.
- *b.* Not Admin/TM and not a project member → 403 `Forbidden` ("You are not a member of this project.").
- *c.* Empty/whitespace content → FluentValidation error (AddCommentCommandValidator).

### Business Rules
- Comments are threaded under a `DailyLog`, not standalone.
- `PUT` edits own comment content (UpdateCommentCommandValidator); `DELETE` soft-deletes (`IsDeleted = true`) — typically restricted to the author / Admin.
- Notifications avoid duplicates: a leader who is also an assignee is notified once; the log creator is not notified about their own comment.

### Authorization
- Controller `[Authorize]` (any authenticated user).
- Handler enforces: Admin/TM, or `ProjectMember` of the log's project.

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

## 5. Goods Receipt Flow (Phiếu nhập kho)

### Actors
- **Manager-or-above** — `RequireManagerOrAbove` policy: Admin, Director, TechnicalManager.

### Preconditions
- User is authenticated and in Manager-or-above role.
- A `PurchaseOrder` (PO) exists for the project.

### Main Success Scenario
1. `POST /api/goodsreceipts` (controller method gated by `[Authorize(Policy = RequireManagerOrAbove)]`) with `POId`, ≥1 `Items` (each `MaterialId`, `Quantity`, `UnitPrice`), and ≥1 `Images`.
2. Validator enforces: `POId > 0`, `Images` not empty, item `MaterialId`s are **distinct**, each `Quantity > 0`.
3. System verifies each item's `Quantity` does not exceed the **remaining (unreceived) quantity** on the PO line.
4. System creates the `GoodsReceipt`, stores image attachments, and **increases inventory** for each material by posting an `InventoryTransaction` of type `GoodsReceipt` (append-only ledger).
5. System updates the PO's received quantities and PO status (e.g., toward `Completed` when fully received).
6. System returns the created receipt DTO.
- `GET /api/goodsreceipts` lists; `PATCH .../{id}` and `DELETE .../{id}` (cancel) are also exposed on the controller.

### Extensions
- *a.* Not Manager-or-above → 401/403 policy failure.
- *b.* `Quantity >` remaining PO quantity → rejected (over-receipt blocked).
- *c.* Duplicate `MaterialId` within one receipt → validation error.
- *d.* Empty images or `Quantity <= 0` → validation error.
- *e.* PO not found / invalid → 404 / business error.

### Business Rules
- A receipt **must** have ≥1 item and ≥1 image.
- `MaterialId` must be distinct per receipt.
- Received quantities are capped at the PO's remaining quantity.
- Inventory increase is recorded as an immutable `InventoryTransaction` (`TransactionType = GoodsReceipt`); current inventory is virtual (sum of transactions) and never goes negative.
- PO status is advanced automatically as goods are received.

### Authorization
- Create endpoint: `[Authorize(Policy = PolicyNames.RequireManagerOrAbove)]` → Admin, Director, TechnicalManager.
- Other endpoints on the controller carry `[Authorize]` (authenticated) at class level; create is the privileged one.

### Code Refs
- `BPG.Api\Controllers\GoodsReceiptsController.cs` (create `@64` RequireManagerOrAbove)
- `BPG.Application\Features\GoodsReceipts\*` (Commands/Validators/Handlers)
- `BPG.Domain\Constants\TypeConstants.cs` — `TransactionType.GoodsReceipt`

---

## 6. Material Return Flow (Phiếu hoàn trả)

### Actors
- **Field Staff** — `RequireFieldStaff` policy: SiteEngineer, TechnicalManager, Admin, Director.

### Preconditions
- User is authenticated and in a Field Staff role.
- A prior `MaterialIssuance` exists to reference (`OriginalIssuanceId`).

### Main Success Scenario
1. `POST /api/materialreturns` (controller gated by `[Authorize(Policy = RequireFieldStaff)]`) with `OriginalIssuanceId`, `Reason`, ≥1 `Items` (distinct `MaterialId`, `Quantity > 0`).
2. Validator enforces: `OriginalIssuanceId > 0`, `Reason` required, distinct items, `Quantity > 0`.
3. System verifies the referenced issuance exists.
4. System creates the `MaterialReturn` and **increases inventory** by posting an `InventoryTransaction` of type `Return` (`+txn Return`).
5. System returns the created return DTO.

### Extensions
- *a.* Not Field Staff → 401/403 policy failure.
- *b.* Missing/invalid `OriginalIssuanceId` → validation error / 404.
- *c.* Empty `Reason` → validation error.
- *d.* Duplicate `MaterialId` or `Quantity <= 0` → validation error.

### Business Rules
- Every return **must reference the original issuAPIance** (`OriginalIssuanceId > 0`).
- `Reason` is mandatory.
- Returns increase inventory (material comes back) via an append-only `Return` transaction.
- Immutable once created (no edit endpoint beyond creation in scope).

### Authorization
- `[Authorize(Policy = PolicyNames.RequireFieldStaff)]` → SiteEngineer, TechnicalManager, Admin, Director.

### Code Refs
- `BPG.Api\Controllers\MaterialReturnsController.cs` (`@19` RequireFieldStaff)
- `BPG.Application\Features\MaterialReturns\*` (Commands/Validators/Handlers)
- `BPG.Domain\Constants\TypeConstants.cs` — `TransactionType.Return`

---

## 7. Current Inventory Flow (Tồn kho hiện tại)

### Actors
- **Any authenticated user** with project access (read-only query).

### Preconditions
- User is authenticated.
- `ProjectId` is supplied and valid.

### Main Success Scenario
1. User `GET /api/inventory/current?projectId=...`.
2. System computes **virtual current inventory per material** for the project = sum of all `InventoryTransaction` quantity deltas (receipts `+`, issuances `−`, returns `+`, adjustments `±`, transfers `±`) where `CurrentInventory >= 0` is guaranteed by the issuAPIance hard-block.
3. System returns a paged/materialized list of `{ MaterialId, MaterialName, CurrentQuantity, Unit }`.

### Extensions
- *a.* Project has no transactions → returns zero/empty quantities (not an error).
- *b.* Invalid `ProjectId` → 404 / validation.

### Business Rules
- Inventory is **derived**, not stored as a mutable column: it is the running sum of the append-only `InventoryTransaction` ledger.
- `CurrentInventory` is never negative — enforced at issuAPIance time (hard-block on insufficient stock), not by clamping here.
- Concurrency on the ledger uses `RowVersion` optimistic concurrency on inventory/material entities.

### Authorization
- Controller `[Authorize]` (any authenticated user).
- (Project-membership scoping, if any, is enforced at the query/handler level for non-privileged roles.)

### Code Refs
- `BPG.Api\Controllers\InventoryController.cs`
- `BPG.Application\Features\Inventory\Queries\GetCurrentInventoryQuery.cs` (parameter: `ProjectId`)
- `BPG.Domain\Entities\InventoryTransaction.cs`, material/stock entities with `RowVersion`

---

## 8. Inventory History Flow (Lịch sử giao dịch kho)

### Actors
- **Any authenticated user** with project access (read-only query).

### Preconditions
- User is authenticated.
- `ProjectId` is supplied.

### Main Success Scenario
1. User `GET /api/inventory/transactions?projectId=...&materialId=...&transactionType=...`.
2. System returns the append-only `InventoryTransaction` ledger for the project, optionally filtered by `MaterialId` and/or `TransactionType` (byte enum).
3. Each row includes `TransactionType` (GoodsReceipt, Issuance, Return, Adjustment, Transfer), quantity delta, reference (PO / issuAPIance / return id), timestamp, and actor.

### Extensions
- *a.* No filters → returns all transactions for the project.
- *b.* `materialId` filter → narrows to one material's ledger.
- *c.* `transactionType` filter → narrows to one type (byte value from `TypeConstants.TransactionType`).

### Business Rules
- The ledger is **append-only**; transactions are never edited or deleted (corrections happen via a new `Adjustment` or `Transfer` transaction).
- `TransactionType` values (confirmed): `GoodsReceipt`, `Issuance`, `Return`, `Adjustment`, `Transfer`.
- History is the source of truth that produces the Current Inventory view (flow 7).

### Authorization
- Controller `[Authorize]` (any authenticated user).

### Code Refs
- `BPG.Api\Controllers\InventoryController.cs`
- `BPG.Application\Features\Inventory\Queries\GetInventoryTransactionsQuery.cs` (params: `ProjectId`, optional `MaterialId?`, optional `TransactionType?` byte)
- `BPG.Domain\Constants\TypeConstants.cs` — `TransactionType`

---

## 9. Material Issuance Flow (Phiếu xuất kho)

### Actors
- **Field Staff** — `RequireFieldStaff` policy: SiteEngineer, TechnicalManager, Admin, Director.

### Preconditions
- User is authenticated and in a Field Staff role.
- A `ProjectTask` (TaskId) exists and is in an active project.

### Main Success Scenario
1. `POST /api/materialissuances` (controller gated by `[Authorize(Policy = RequireFieldStaff)]`) with `TaskId`, `Purpose`, ≥1 `Items` (distinct `MaterialId`, `Quantity > 0`).
2. Validator enforces: `TaskId > 0`, `Purpose` required, distinct items, `Quantity > 0`.
3. System **hard-blocks** any item whose `Quantity` would exceed the available virtual inventory (CurrentInventory per material must stay ≥ 0).
4. System creates the `MaterialIssuance` and **decreases inventory** by posting an `InventoryTransaction` of type `Issuance` (`−txn Issuance`).
5. System returns the created issuAPIance DTO.
- The issuAPIance is **immutable** once created.

### Extensions
- *a.* Not Field Staff → 401/403 policy failure.
- *b.* Insufficient stock for an item → rejected (hard-block; no partial/negative inventory).
- *c.* Missing `Purpose` or duplicate `MaterialId` or `Quantity <= 0` → validation error.
- *d.* Invalid `TaskId` → 404.

### Business Rules
- `Purpose` is mandatory for every issuAPIance.
- `MaterialId` must be distinct per issuAPIance.
- Issuances **decrease** inventory via an append-only `Issuance` transaction; the hard stock check guarantees `CurrentInventory >= 0`.
- Issuances are immutable (material returns are handled by a separate Return flow referencing the original issuAPIance).

### Authorization
- `[Authorize(Policy = PolicyNames.RequireFieldStaff)]` → SiteEngineer, TechnicalManager, Admin, Director.

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
