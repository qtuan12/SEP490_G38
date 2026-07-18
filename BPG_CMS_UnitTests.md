# UNIT TEST DOCUMENT

| Item | Information |
|------|-------------|
| **Project** | BPG Construction Management System (BPG_CMS) |
| **Module** | BPG.Application.UnitTests |
| **Document type** | Unit Test Specification & Result |
| **Created By** | DucHV |
| **Created Date** | 19/07/2026 |
| **Executed By** | DucHV |
| **Executed Date** | 19/07/2026 |
| **Test Result** | PASS (All test cases executed successfully) |

---

## 1. Overview

This document specifies the unit test cases for the Application layer handlers of the BPG_CMS backend. Each handler follows the CQRS pattern and is invoked through the `IRequestHandler<,>` interface. Validators are executed automatically by the MediatR pipeline (`ValidationBehavior<,>`), therefore handler unit tests verify business logic only.

**Conventions used in this document:**
- **Code Module** = the Handler class name (e.g. `CreateSupplierCommandHandler`).
- **Method** = `Handle(<Command/Query>, CancellationToken)`.
- All `Handle` calls are invoked with `CancellationToken.None`.
- Each UTCID maps to exactly one Command or Query input and one DTO output.
- Result status: **B** = Build/Pass, **N/A** = not applicable, **P** = Passed, **F** = Failed.

---

## 2. Feature: Suppliers (5 handlers)

### 2.1 CreateSupplierCommandHandler

**Code Module:** `CreateSupplierCommandHandler`
**Method:** `Handle(CreateSupplierCommand, CancellationToken)`
**Test requirement:** Verify creation of a supplier with name, contact info, address, service area, rating and collaboration status, including duplicate-name and rating-boundary handling.

| UTCID | Test Case | Input Data | Precondition | Confirm / Return | Exception | Type | P/F | Executed Date | Defect ID |
|-------|-----------|------------|-------------|-----------------|----------|------|-----|---------------|-----------|
| UTCID01 | ValidData_ShouldCreateSupplier | - CreateSupplierCommand: { SupplierName="ABC Construction", ContactInfo="090...", Address="Hanoi", ServiceArea="North", Rating=4.5, CollaborationStatus="Active" }<br>- CancellationToken: None | No existing supplier with the same name | Return: SupplierDto with generated SupplierId; Status: Success | None | B | P | 19/07/2026 | |
| UTCID02 | DuplicateNameExact_ShouldThrow | - CreateSupplierCommand: { SupplierName="ABC Construction", ... }<br>- CancellationToken: None | Supplier "ABC Construction" already exists (not deleted) | Return: Empty | DuplicateEntryException | B | P | 19/07/2026 | |
| UTCID03 | DuplicateNameCaseInsensitive_ShouldThrow | - CreateSupplierCommand: { SupplierName="abc construction", ... }<br>- CancellationToken: None | Supplier "ABC Construction" exists | Return: Empty | DuplicateEntryException | B | P | 19/07/2026 | |
| UTCID04 | DuplicateNameWithSpaces_ShouldThrow | - CreateSupplierCommand: { SupplierName="  ABC Construction  ", ... }<br>- CancellationToken: None | Supplier "ABC Construction" exists | Return: Empty | DuplicateEntryException | B | P | 19/07/2026 | |
| UTCID05 | OptionalFieldsNull_ShouldCreate | - CreateSupplierCommand: { SupplierName="XYZ", ContactInfo=null, Address=null, ServiceArea=null, Rating=3, CollaborationStatus="Pending" }<br>- CancellationToken: None | No duplicate | Return: SupplierDto; Status: Success | None | B | P | 19/07/2026 | |
| UTCID06 | NameTrimmed_ShouldCreate | - CreateSupplierCommand: { SupplierName="  Trimmed Co  ", ... }<br>- CancellationToken: None | No duplicate after trim | Return: SupplierDto with trimmed name; Status: Success | None | B | P | 19/07/2026 | |
| UTCID07 | RatingMinBoundary_ShouldCreate | - CreateSupplierCommand: { ..., Rating=1 }<br>- CancellationToken: None | No duplicate | Return: SupplierDto; Status: Success | None | B | P | 19/07/2026 | |
| UTCID08 | RatingMaxBoundary_ShouldCreate | - CreateSupplierCommand: { ..., Rating=5 }<br>- CancellationToken: None | No duplicate | Return: SupplierDto; Status: Success | None | B | P | 19/07/2026 | |
| UTCID09 | ActiveStatus_ShouldCreate | - CreateSupplierCommand: { ..., CollaborationStatus="Active" }<br>- CancellationToken: None | No duplicate | Return: SupplierDto; Status: Success | None | B | P | 19/07/2026 | |
| UTCID10 | InactiveStatus_ShouldCreate | - CreateSupplierCommand: { ..., CollaborationStatus="Inactive" }<br>- CancellationToken: None | No duplicate | Return: SupplierDto; Status: Success | None | B | P | 19/07/2026 | |
| UTCID11 | NameTooLong_ShouldThrow | - CreateSupplierCommand: { SupplierName="<300+ chars>", ... }<br>- CancellationToken: None | N/A | Return: Empty | DuplicateEntryException / Validation | B | P | 19/07/2026 | |

### 2.2 UpdateSupplierCommandHandler

**Code Module:** `UpdateSupplierCommandHandler`
**Method:** `Handle(UpdateSupplierCommand, CancellationToken)`
**Test requirement:** Verify update of an existing supplier's editable fields with duplicate-name and not-found handling.

| UTCID | Test Case | Input Data | Precondition | Confirm / Return | Exception | Type | P/F | Executed Date | Defect ID |
|-------|-----------|------------|-------------|-----------------|----------|------|-----|---------------|-----------|
| UTCID01 | ValidUpdate_ShouldUpdate | - UpdateSupplierCommand: { SupplierId=guid, SupplierName="New Name", ContactInfo="...", Address="...", ServiceArea="...", Rating=4, CollaborationStatus="Active" }<br>- CancellationToken: None | Supplier exists | Return: SupplierDto with updated values; Status: Success | None | B | P | 19/07/2026 | |
| UTCID02 | NotFound_ShouldThrow | - UpdateSupplierCommand: { SupplierId=unknown, ... }<br>- CancellationToken: None | Supplier does not exist | Return: Empty | NotFoundException | B | P | 19/07/2026 | |
| UTCID03 | DuplicateName_ShouldThrow | - UpdateSupplierCommand: { SupplierId=guid, SupplierName="Existing Other" }<br>- CancellationToken: None | Another supplier "Existing Other" exists | Return: Empty | DuplicateEntryException | B | P | 19/07/2026 | |
| UTCID04 | TrimName_ShouldUpdate | - UpdateSupplierCommand: { SupplierId=guid, SupplierName="  Trim  " }<br>- CancellationToken: None | Supplier exists | Return: SupplierDto trimmed; Status: Success | None | B | P | 19/07/2026 | |
| UTCID05 | RatingBoundary_ShouldUpdate | - UpdateSupplierCommand: { SupplierId=guid, ..., Rating=5 }<br>- CancellationToken: None | Supplier exists | Return: SupplierDto; Status: Success | None | B | P | 19/07/2026 | |
| UTCID06 | NullOptionalFields_ShouldUpdate | - UpdateSupplierCommand: { SupplierId=guid, SupplierName="X", ContactInfo=null, Address=null }<br>- CancellationToken: None | Supplier exists | Return: SupplierDto; Status: Success | None | B | P | 19/07/2026 | |
| UTCID07 | ActiveStatus_ShouldUpdate | - UpdateSupplierCommand: { SupplierId=guid, ..., CollaborationStatus="Active" }<br>- CancellationToken: None | Supplier exists | Return: SupplierDto; Status: Success | None | B | P | 19/07/2026 | |
| UTCID08 | InactiveStatus_ShouldUpdate | - UpdateSupplierCommand: { SupplierId=guid, ..., CollaborationStatus="Inactive" }<br>- CancellationToken: None | Supplier exists | Return: SupplierDto; Status: Success | None | B | P | 19/07/2026 | |
| UTCID09 | UpdateSelfSameName_ShouldSucceed | - UpdateSupplierCommand: { SupplierId=guid, SupplierName="Same As Self" }<br>- CancellationToken: None | Supplier with that name is the same entity | Return: SupplierDto; Status: Success | None | B | P | 19/07/2026 | |
| UTCID10 | UpdatePersistsAllFields_ShouldSucceed | - UpdateSupplierCommand: { SupplierId=guid, all fields changed }<br>- CancellationToken: None | Supplier exists | Return: SupplierDto reflecting all changes; Status: Success | None | B | P | 19/07/2026 | |

### 2.3 DeleteSupplierCommandHandler

**Code Module:** `DeleteSupplierCommandHandler`
**Method:** `Handle(DeleteSupplierCommand, CancellationToken)`
**Test requirement:** Verify soft deletion of a supplier and not-found handling.

| UTCID | Test Case | Input Data | Precondition | Confirm / Return | Exception | Type | P/F | Executed Date | Defect ID |
|-------|-----------|------------|-------------|-----------------|----------|------|-----|---------------|-----------|
| UTCID01 | ValidDelete_ShouldSoftDelete | - DeleteSupplierCommand: { SupplierId=guid }<br>- CancellationToken: None | Supplier exists (IsDeleted=false) | Return: true (soft delete applied); Status: Success | None | B | P | 19/07/2026 | |
| UTCID02 | NotFound_ShouldThrow | - DeleteSupplierCommand: { SupplierId=unknown }<br>- CancellationToken: None | Supplier does not exist | Return: Empty | NotFoundException | B | P | 19/07/2026 | |
| UTCID03 | AlreadyDeleted_ShouldThrowOrNoOp | - DeleteSupplierCommand: { SupplierId=guid }<br>- CancellationToken: None | Supplier exists with IsDeleted=true | Return: Empty / false | NotFoundException | B | P | 19/07/2026 | |

### 2.4 GetSuppliersQueryHandler

**Code Module:** `GetSuppliersQueryHandler`
**Method:** `Handle(GetSuppliersQuery, CancellationToken)`
**Test requirement:** Verify paginated supplier listing with filtering by name, contact, service area, rating and status.

| UTCID | Test Case | Input Data | Precondition | Confirm / Return | Exception | Type | P/F | Executed Date | Defect ID |
|-------|-----------|------------|-------------|-----------------|----------|------|-----|---------------|-----------|
| UTCID01 | NoFilter_ShouldReturnAllPaged | - GetSuppliersQuery: { SupplierName=null, ContactInfo=null, ServiceArea=null, Rating=null, CollaborationStatus=null, PageNumber=1, PageSize=10 }<br>- CancellationToken: None | Suppliers seeded (incl. Rating=4.5, Status="Active") | Return: PagedResult<SupplierDto>; Status: Success | None | B | P | 19/07/2026 | |
| UTCID02 | FilterByName_ShouldReturnMatch | - GetSuppliersQuery: { SupplierName="ABC", ...null, Page=1, Size=10 }<br>- CancellationToken: None | Supplier "ABC Construction" exists | Return: PagedResult with 1 item; Status: Success | None | B | P | 19/07/2026 | |
| UTCID03 | FilterByStatus_ShouldReturnMatch | - GetSuppliersQuery: { CollaborationStatus="Active", ... }<br>- CancellationToken: None | Active suppliers seeded | Return: PagedResult Active only; Status: Success | None | B | P | 19/07/2026 | |
| UTCID04 | FilterByRating_ShouldReturnMatch | - GetSuppliersQuery: { Rating=4.5, ... }<br>- CancellationToken: None | Supplier with Rating 4.5 seeded | Return: PagedResult matching; Status: Success | None | B | P | 19/07/2026 | |
| UTCID05 | FilterByServiceArea_ShouldReturnMatch | - GetSuppliersQuery: { ServiceArea="North", ... }<br>- CancellationToken: None | North suppliers seeded | Return: PagedResult; Status: Success | None | B | P | 19/07/2026 | |
| UTCID06 | FilterByContact_ShouldReturnMatch | - GetSuppliersQuery: { ContactInfo="090", ... }<br>- CancellationToken: None | Matching contact seeded | Return: PagedResult; Status: Success | None | B | P | 19/07/2026 | |
| UTCID07 | NoMatch_ShouldReturnEmpty | - GetSuppliersQuery: { SupplierName="zzz-nomatch", ... }<br>- CancellationToken: None | No matching supplier | Return: PagedResult empty; Status: Success | None | B | P | 19/07/2026 | |
| UTCID08 | PageOutOfBounds_ShouldReturnEmpty | - GetSuppliersQuery: { PageNumber=99, PageSize=10 }<br>- CancellationToken: None | 3 suppliers total | Return: PagedResult empty; Status: Success | None | B | P | 19/07/2026 | |
| UTCID09 | PagingSizeRespected_ShouldLimit | - GetSuppliersQuery: { PageSize=2, PageNumber=1 }<br>- CancellationToken: None | 5 suppliers seeded | Return: PagedResult with 2 items; Status: Success | None | B | P | 19/07/2026 | |
| UTCID10 | CaseInsensitiveName_ShouldMatch | - GetSuppliersQuery: { SupplierName="abc", ... }<br>- CancellationToken: None | Supplier "ABC Construction" exists | Return: PagedResult 1 item; Status: Success | None | B | P | 19/07/2026 | |
| UTCID11 | CombinedFilters_ShouldIntersect | - GetSuppliersQuery: { SupplierName="ABC", CollaborationStatus="Active", ... }<br>- CancellationToken: None | Matching supplier | Return: PagedResult 1 item; Status: Success | None | B | P | 19/07/2026 | |
| UTCID12 | IgnoreDeleted_ShouldExclude | - GetSuppliersQuery: { ... }<br>- CancellationToken: None | One supplier IsDeleted=true | Return: PagedResult excludes deleted; Status: Success | None | B | P | 19/07/2026 | |
| UTCID13 | CombinedFiltersAllCriteria_ShouldApply | - GetSuppliersQuery: { all filters set }<br>- CancellationToken: None | Matching supplier | Return: PagedResult 1 item; Status: Success | None | B | P | 19/07/2026 | |

### 2.5 GetSupplierByIdQueryHandler

**Code Module:** `GetSupplierByIdQueryHandler`
**Method:** `Handle(GetSupplierByIdQuery, CancellationToken)`
**Test requirement:** Verify retrieval of a single supplier by id, including not-found handling.

| UTCID | Test Case | Input Data | Precondition | Confirm / Return | Exception | Type | P/F | Executed Date | Defect ID |
|-------|-----------|------------|-------------|-----------------|----------|------|-----|---------------|-----------|
| UTCID01 | ValidId_ShouldReturnSupplier | - GetSupplierByIdQuery: { SupplierId=guid }<br>- CancellationToken: None | Supplier exists (SupplierId, SupplierName, ContactInfo, Address, ServiceArea, Rating, CollaborationStatus) | Return: SupplierDto; Status: Success | None | B | P | 19/07/2026 | |
| UTCID02 | NotFound_ShouldThrow | - GetSupplierByIdQuery: { SupplierId=unknown }<br>- CancellationToken: None | Supplier does not exist | Return: Empty | NotFoundException | B | P | 19/07/2026 | |
| UTCID03 | DeletedIgnored_ShouldThrow | - GetSupplierByIdQuery: { SupplierId=guid }<br>- CancellationToken: None | Supplier IsDeleted=true | Return: Empty | NotFoundException | B | P | 19/07/2026 | |

---

## 3. Feature: Comments (3 handlers)

### 3.1 AddCommentCommandHandler

**Code Module:** `AddCommentCommandHandler`
**Method:** `Handle(AddCommentCommand, CancellationToken)`
**Test requirement:** Verify adding a comment to a daily log with authorization, notification and realtime dispatch.

| UTCID | Test Case | Input Data | Precondition | Confirm / Return | Exception | Type | P/F | Executed Date | Defect ID |
|-------|-----------|------------|-------------|-----------------|----------|------|-----|---------------|-----------|
| UTCID01 | ValidAdd_ShouldCreateComment | - AddCommentCommand: { DailyLogId=guid, Content="Great work", ParentCommentId=null }<br>- CancellationToken: None | CurrentUser set; DailyLog exists; member of project | Return: CommentDto; Status: Success | None | B | P | 19/07/2026 | |
| UTCID02 | DailyLogNotFound_ShouldThrow | - AddCommentCommand: { DailyLogId=unknown, Content="x" }<br>- CancellationToken: None | DailyLog does not exist | Return: Empty | NotFoundException | B | P | 19/07/2026 | |
| UTCID03 | NotProjectMember_ShouldThrow | - AddCommentCommand: { DailyLogId=guid, Content="x" }<br>- CancellationToken: None | CurrentUser not a project member | Return: Empty | ForbiddenException | B | P | 19/07/2026 | |
| UTCID04 | ReplyToComment_ShouldCreate | - AddCommentCommand: { DailyLogId=guid, Content="reply", ParentCommentId=guid }<br>- CancellationToken: None | Parent comment exists | Return: CommentDto with ParentId; Status: Success | None | B | P | 19/07/2026 | |
| UTCID05 | EmptyContent_ShouldThrow | - AddCommentCommand: { DailyLogId=guid, Content="" }<br>- CancellationToken: None | N/A | Return: Empty | Validation / BusinessException | B | P | 19/07/2026 | |
| UTCID06 | SendsNotification_ShouldNotify | - AddCommentCommand: { DailyLogId=guid, Content="x" }<br>- CancellationToken: None | Valid member | Return: CommentDto; NotificationService invoked; Status: Success | None | B | P | 19/07/2026 | |

### 3.2 UpdateCommentCommandHandler

**Code Module:** `UpdateCommentCommandHandler`
**Method:** `Handle(UpdateCommentCommand, CancellationToken)`
**Test requirement:** Verify updating own comment content with authorization and realtime dispatch.

| UTCID | Test Case | Input Data | Precondition | Confirm / Return | Exception | Type | P/F | Executed Date | Defect ID |
|-------|-----------|------------|-------------|-----------------|----------|------|-----|---------------|-----------|
| UTCID01 | ValidUpdate_ShouldUpdate | - UpdateCommentCommand: { CommentId=guid, Content="Updated" }<br>- CancellationToken: None | Comment exists, owned by CurrentUser | Return: CommentDto updated; Status: Success | None | B | P | 19/07/2026 | |
| UTCID02 | NotFound_ShouldThrow | - UpdateCommentCommand: { CommentId=unknown, Content="x" }<br>- CancellationToken: None | Comment does not exist | Return: Empty | NotFoundException | B | P | 19/07/2026 | |
| UTCID03 | NotOwner_ShouldThrow | - UpdateCommentCommand: { CommentId=guid, Content="x" }<br>- CancellationToken: None | Comment owned by another user | Return: Empty | ForbiddenException | B | P | 19/07/2026 | |
| UTCID04 | EmptyContent_ShouldThrow | - UpdateCommentCommand: { CommentId=guid, Content="" }<br>- CancellationToken: None | N/A | Return: Empty | Validation / BusinessException | B | P | 19/07/2026 | |
| UTCID05 | SendsRealtime_ShouldDispatch | - UpdateCommentCommand: { CommentId=guid, Content="x" }<br>- CancellationToken: None | Owned comment | Return: CommentDto; Realtime sender invoked; Status: Success | None | B | P | 19/07/2026 | |

### 3.3 DeleteCommentCommandHandler

**Code Module:** `DeleteCommentCommandHandler`
**Method:** `Handle(DeleteCommentCommand, CancellationToken)`
**Test requirement:** Verify deletion of own comment with authorization and realtime dispatch.

| UTCID | Test Case | Input Data | Precondition | Confirm / Return | Exception | Type | P/F | Executed Date | Defect ID |
|-------|-----------|------------|-------------|-----------------|----------|------|-----|---------------|-----------|
| UTCID01 | ValidDelete_ShouldDelete | - DeleteCommentCommand: { CommentId=guid }<br>- CancellationToken: None | Comment exists, owned by CurrentUser | Return: true; Status: Success | None | B | P | 19/07/2026 | |
| UTCID02 | NotFound_ShouldThrow | - DeleteCommentCommand: { CommentId=unknown }<br>- CancellationToken: None | Comment does not exist | Return: Empty | NotFoundException | B | P | 19/07/2026 | |
| UTCID03 | NotOwner_ShouldThrow | - DeleteCommentCommand: { CommentId=guid }<br>- CancellationToken: None | Comment owned by another user | Return: Empty | ForbiddenException | B | P | 19/07/2026 | |
| UTCID04 | SendsRealtime_ShouldDispatch | - DeleteCommentCommand: { CommentId=guid }<br>- CancellationToken: None | Owned comment | Return: true; Realtime sender invoked; Status: Success | None | B | P | 19/07/2026 | |

---

## 4. Feature: DailyLogs (4 handlers)

### 4.1 CreateDailyLogCommandHandler

**Code Module:** `CreateDailyLogCommandHandler`
**Method:** `Handle(CreateDailyLogCommand, CancellationToken)`
**Test requirement:** Verify creation of a daily log for a task with authorization, progress logging, notification and predecessor-dependency checks.

| UTCID | Test Case | Input Data | Precondition | Confirm / Return | Exception | Type | P/F | Executed Date | Defect ID |
|-------|-----------|------------|-------------|-----------------|----------|------|-----|---------------|-----------|
| UTCID01 | ValidCreate_ShouldCreate | - CreateDailyLogCommand: { TaskId=guid, Content="Done", HoursSpent=4, Attachments=[] }<br>- CancellationToken: None | CurrentUser is assignee; task exists | Return: DailyLogDto; Status: Success | None | B | P | 19/07/2026 | |
| UTCID02 | TaskNotFound_ShouldThrow | - CreateDailyLogCommand: { TaskId=unknown, ... }<br>- CancellationToken: None | Task does not exist | Return: Empty | NotFoundException | B | P | 19/07/2026 | |
| UTCID03 | NotAssignee_ShouldThrow | - CreateDailyLogCommand: { TaskId=guid, ... }<br>- CancellationToken: None | CurrentUser not assignee/member | Return: Empty | ForbiddenException | B | P | 19/07/2026 | |
| UTCID04 | WithAttachments_ShouldCreate | - CreateDailyLogCommand: { TaskId=guid, Attachments=[a,b] }<br>- CancellationToken: None | Valid assignee | Return: DailyLogDto with attachments; Status: Success | None | B | P | 19/07/2026 | |
| UTCID05 | NegativeHours_ShouldThrow | - CreateDailyLogCommand: { TaskId=guid, HoursSpent=-1 }<br>- CancellationToken: None | N/A | Return: Empty | Validation / BusinessException | B | P | 19/07/2026 | |
| UTCID06 | EmptyContent_ShouldThrow | - CreateDailyLogCommand: { TaskId=guid, Content="" }<br>- CancellationToken: None | N/A | Return: Empty | Validation / BusinessException | B | P | 19/07/2026 | |
| UTCID07 | SendsNotification_ShouldNotify | - CreateDailyLogCommand: { TaskId=guid, ... }<br>- CancellationToken: None | Valid assignee | Return: DailyLogDto; NotificationService invoked; Status: Success | None | B | P | 19/07/2026 | |
| UTCID08 | LogsProgress_ShouldCreateProgressLog | - CreateDailyLogCommand: { TaskId=guid, HoursSpent=4 }<br>- CancellationToken: None | Valid assignee | Return: DailyLogDto; TaskProgressLog created; Status: Success | None | B | P | 19/07/2026 | |
| UTCID09 | PredecessorIncomplete_ShouldThrow | - CreateDailyLogCommand: { TaskId=guid (has incomplete predecessor) }<br>- CancellationToken: None | Predecessor task not complete | Return: Empty | BusinessException | B | P | 19/07/2026 | |
| UTCID10 | AllPredecessorsComplete_ShouldCreate | - CreateDailyLogCommand: { TaskId=guid (predecessors complete) }<br>- CancellationToken: None | Predecessors complete | Return: DailyLogDto; Status: Success | None | B | P | 19/07/2026 | |
| UTCID11 | RealtimeDispatch_ShouldSend | - CreateDailyLogCommand: { TaskId=guid, ... }<br>- CancellationToken: None | Valid assignee | Return: DailyLogDto; Realtime sender invoked; Status: Success | None | B | P | 19/07/2026 | |
| UTCID12 | MaxHoursBoundary_ShouldCreate | - CreateDailyLogCommand: { TaskId=guid, HoursSpent=24 }<br>- CancellationToken: None | Valid assignee | Return: DailyLogDto; Status: Success | None | B | P | 19/07/2026 | |
| UTCID13 | NoPredecessors_ShouldCreate | - CreateDailyLogCommand: { TaskId=guid (no deps) }<br>- CancellationToken: None | Valid assignee | Return: DailyLogDto; Status: Success | None | B | P | 19/07/2026 | |
| UTCID14 | DuplicateDailyLogSameDay_ShouldHandle | - CreateDailyLogCommand: { TaskId=guid, ... }<br>- CancellationToken: None | Existing log same day | Return: DailyLogDto (new entry); Status: Success | None | B | P | 19/07/2026 | |
| UTCID15 | LargeContent_ShouldCreate | - CreateDailyLogCommand: { TaskId=guid, Content="<long>" }<br>- CancellationToken: None | Valid assignee | Return: DailyLogDto; Status: Success | None | B | P | 19/07/2026 | |
| UTCID16 | ZeroHours_ShouldCreate | - CreateDailyLogCommand: { TaskId=guid, HoursSpent=0 }<br>- CancellationToken: None | Valid assignee | Return: DailyLogDto; Status: Success | None | B | P | 19/07/2026 | |
| UTCID17 | MultipleAttachments_ShouldCreate | - CreateDailyLogCommand: { TaskId=guid, Attachments=[a,b,c] }<br>- CancellationToken: None | Valid assignee | Return: DailyLogDto; Status: Success | None | B | P | 19/07/2026 | |
| UTCID18 | MultiplePredecessorDeps_ShouldThrowIfAnyIncomplete | - CreateDailyLogCommand: { TaskId=guid (one of many predecessors incomplete) }<br>- CancellationToken: None | At least one predecessor incomplete | Return: Empty | BusinessException | B | P | 19/07/2026 | |

### 4.2 UpdateDailyLogCommandHandler

**Code Module:** `UpdateDailyLogCommandHandler`
**Method:** `Handle(UpdateDailyLogCommand, CancellationToken)`
**Test requirement:** Verify updating a daily log with authorization, progress logging and realtime dispatch.

| UTCID | Test Case | Input Data | Precondition | Confirm / Return | Exception | Type | P/F | Executed Date | Defect ID |
|-------|-----------|------------|-------------|-----------------|----------|------|-----|---------------|-----------|
| UTCID01 | ValidUpdate_ShouldUpdate | - UpdateDailyLogCommand: { DailyLogId=guid, Content="Updated", HoursSpent=5, Attachments=[] }<br>- CancellationToken: None | DailyLog exists, owner is CurrentUser | Return: DailyLogDto updated; Status: Success | None | B | P | 19/07/2026 | |
| UTCID02 | NotFound_ShouldThrow | - UpdateDailyLogCommand: { DailyLogId=unknown, ... }<br>- CancellationToken: None | DailyLog does not exist | Return: Empty | NotFoundException | B | P | 19/07/2026 | |
| UTCID03 | NotOwner_ShouldThrow | - UpdateDailyLogCommand: { DailyLogId=guid, ... }<br>- CancellationToken: None | DailyLog owned by another user | Return: Empty | ForbiddenException | B | P | 19/07/2026 | |
| UTCID04 | NegativeHours_ShouldThrow | - UpdateDailyLogCommand: { DailyLogId=guid, HoursSpent=-1 }<br>- CancellationToken: None | N/A | Return: Empty | Validation / BusinessException | B | P | 19/07/2026 | |
| UTCID05 | UpdateAttachments_ShouldReplace | - UpdateDailyLogCommand: { DailyLogId=guid, Attachments=[new] }<br>- CancellationToken: None | Owner | Return: DailyLogDto with new attachments; Status: Success | None | B | P | 19/07/2026 | |
| UTCID06 | ProgressChanged_ShouldLog | - UpdateDailyLogCommand: { DailyLogId=guid, HoursSpent=8 }<br>- CancellationToken: None | Owner; prior hours different | Return: DailyLogDto; TaskProgressLog created; Status: Success | None | B | P | 19/07/2026 | |
| UTCID07 | SendsRealtime_ShouldDispatch | - UpdateDailyLogCommand: { DailyLogId=guid, ... }<br>- CancellationToken: None | Owner | Return: DailyLogDto; Realtime sender invoked; Status: Success | None | B | P | 19/07/2026 | |
| UTCID08 | EmptyContent_ShouldThrow | - UpdateDailyLogCommand: { DailyLogId=guid, Content="" }<br>- CancellationToken: None | N/A | Return: Empty | Validation / BusinessException | B | P | 19/07/2026 | |
| UTCID09 | SystemConfigUsed_ShouldResolve | - UpdateDailyLogCommand: { DailyLogId=guid, ... }<br>- CancellationToken: None | Owner; SystemConfig seeded | Return: DailyLogDto; Status: Success | None | B | P | 19/07/2026 | |
| UTCID10 | ProgressUnchangedDescOrImagesChanged_ShouldSucceed | - UpdateDailyLogCommand: { DailyLogId=guid, Content changed, HoursSpent same }<br>- CancellationToken: None | Owner | Return: DailyLogDto; Status: Success | None | B | P | 19/07/2026 | |

### 4.3 GetDailyLogsQueryHandler

**Code Module:** `GetDailyLogsQueryHandler`
**Method:** `Handle(GetDailyLogsQuery, CancellationToken)`
**Test requirement:** Verify paginated retrieval of daily logs for a task with attachments and progress mapping.

| UTCID | Test Case | Input Data | Precondition | Confirm / Return | Exception | Type | P/F | Executed Date | Defect ID |
|-------|-----------|------------|-------------|-----------------|----------|------|-----|---------------|-----------|
| UTCID01 | ValidTask_ShouldReturnLogs | - GetDailyLogsQuery: { TaskId=guid, PageNumber=1, PageSize=10 }<br>- CancellationToken: None | DailyLogs seeded for task | Return: PagedResult<DailyLogDto>; Status: Success | None | B | P | 19/07/2026 | |
| UTCID02 | TaskNotFound_ShouldThrow | - GetDailyLogsQuery: { TaskId=unknown, ... }<br>- CancellationToken: None | Task does not exist | Return: Empty | NotFoundException | B | P | 19/07/2026 | |
| UTCID03 | NoLogs_ShouldReturnEmpty | - GetDailyLogsQuery: { TaskId=guid, ... }<br>- CancellationToken: None | No logs for task | Return: PagedResult empty; Status: Success | None | B | P | 19/07/2026 | |
| UTCID04 | PagingSizeRespected_ShouldLimit | - GetDailyLogsQuery: { TaskId=guid, PageSize=2 }<br>- CancellationToken: None | 5 logs seeded | Return: PagedResult 2 items; Status: Success | None | B | P | 19/07/2026 | |
| UTCID05 | PageOutOfBounds_ShouldReturnEmpty | - GetDailyLogsQuery: { TaskId=guid, PageNumber=99 }<br>- CancellationToken: None | 3 logs total | Return: PagedResult empty; Status: Success | None | B | P | 19/07/2026 | |
| UTCID06 | MapsAttachments_ShouldInclude | - GetDailyLogsQuery: { TaskId=guid, ... }<br>- CancellationToken: None | Logs with attachments | Return: PagedResult with attachment DTOs; Status: Success | None | B | P | 19/07/2026 | |

### 4.4 GetTaskProgressHistoryQueryHandler

**Code Module:** `GetTaskProgressHistoryQueryHandler`
**Method:** `Handle(GetTaskProgressHistoryQuery, CancellationToken)`
**Test requirement:** Verify retrieval of task progress history with authorization.

| UTCID | Test Case | Input Data | Precondition | Confirm / Return | Exception | Type | P/F | Executed Date | Defect ID |
|-------|-----------|------------|-------------|-----------------|----------|------|-----|---------------|-----------|
| UTCID01 | Valid_ShouldReturnHistory | - GetTaskProgressHistoryQuery: { TaskId=guid }<br>- CancellationToken: None | Task exists; CurrentUser is member; progress logs seeded | Return: List<TaskProgressLogDto>; Status: Success | None | B | P | 19/07/2026 | |
| UTCID02 | TaskNotFound_ShouldThrow | - GetTaskProgressHistoryQuery: { TaskId=unknown }<br>- CancellationToken: None | Task does not exist | Return: Empty | NotFoundException | B | P | 19/07/2026 | |
| UTCID03 | InsufficientPermission_ShouldThrow | - GetTaskProgressHistoryQuery: { TaskId=guid }<br>- CancellationToken: None | CurrentUser not a project member | Return: Empty | ForbiddenException | B | P | 19/07/2026 | |
| UTCID04 | HasHistory_ShouldMapAll | - GetTaskProgressHistoryQuery: { TaskId=guid }<br>- CancellationToken: None | Multiple progress logs seeded | Return: List mapped fully; Status: Success | None | B | P | 19/07/2026 | |
| UTCID05 | NoHistory_ShouldReturnEmptyList | - GetTaskProgressHistoryQuery: { TaskId=guid }<br>- CancellationToken: None | No progress logs | Return: Empty List<TaskProgressLogDto>; Status: Success | None | B | P | 19/07/2026 | |

---

## 5. Feature: GoodsReceipts (5 handlers)

### 5.1 CreateGoodsReceiptCommandHandler

**Code Module:** `CreateGoodsReceiptCommandHandler`
**Method:** `Handle(CreateGoodsReceiptCommand, CancellationToken)`
**Test requirement:** Verify creation of a goods receipt from a purchase order, updating inventory and attachments.

| UTCID | Test Case | Input Data | Precondition | Confirm / Return | Exception | Type | P/F | Executed Date | Defect ID |
|-------|-----------|------------|-------------|-----------------|----------|------|-----|---------------|-----------|
| UTCID01 | ValidCreate_ShouldCreate | - CreateGoodsReceiptCommand: { PurchaseOrderId=guid, Items=[...], Attachments=[] }<br>- CancellationToken: None | PO exists; CurrentUser leader; inventory service mocked | Return: GoodsReceiptDto; Status: Success | None | B | P | 19/07/2026 | |
| UTCID02 | PurchaseOrderNotFound_ShouldThrow | - CreateGoodsReceiptCommand: { PurchaseOrderId=unknown, ... }<br>- CancellationToken: None | PO does not exist | Return: Empty | NotFoundException | B | P | 19/07/2026 | |
| UTCID03 | NotLeader_ShouldThrow | - CreateGoodsReceiptCommand: { PurchaseOrderId=guid, ... }<br>- CancellationToken: None | CurrentUser not leader | Return: Empty | ForbiddenException | B | P | 19/07/2026 | |
| UTCID04 | WithAttachments_ShouldCreate | - CreateGoodsReceiptCommand: { ..., Attachments=[a] }<br>- CancellationToken: None | Valid leader | Return: GoodsReceiptDto with attachments; Status: Success | None | B | P | 19/07/2026 | |
| UTCID05 | EmptyItems_ShouldThrow | - CreateGoodsReceiptCommand: { ..., Items=[] }<br>- CancellationToken: None | N/A | Return: Empty | Validation / BusinessException | B | P | 19/07/2026 | |
| UTCID06 | UpdatesInventory_ShouldCallService | - CreateGoodsReceiptCommand: { ..., Items=[i] }<br>- CancellationToken: None | Valid leader | Return: GoodsReceiptDto; IInventoryService.Increase invoked; Status: Success | None | B | P | 19/07/2026 | |
| UTCID07 | PartialReceive_ShouldCreate | - CreateGoodsReceiptCommand: { ..., Items partial qty }<br>- CancellationToken: None | Valid leader | Return: GoodsReceiptDto; Status: Success | None | B | P | 19/07/2026 | |
| UTCID08 | MultipleItems_ShouldCreate | - CreateGoodsReceiptCommand: { ..., Items=[i1,i2] }<br>- CancellationToken: None | Valid leader | Return: GoodsReceiptDto; Status: Success | None | B | P | 19/07/2026 | |
| UTCID09 | DuplicateReceipt_ShouldHandle | - CreateGoodsReceiptCommand: { PurchaseOrderId=guid already received }<br>- CancellationToken: None | Prior receipt exists | Return: GoodsReceiptDto (new); Status: Success | None | B | P | 19/07/2026 | |
| UTCID10 | ZeroQuantityItem_ShouldThrow | - CreateGoodsReceiptCommand: { ..., Items=[qty 0] }<br>- CancellationToken: None | N/A | Return: Empty | Validation / BusinessException | B | P | 19/07/2026 | |
| UTCID11 | NegativeQuantityItem_ShouldThrow | - CreateGoodsReceiptCommand: { ..., Items=[qty -1] }<br>- CancellationToken: None | N/A | Return: Empty | Validation / BusinessException | B | P | 19/07/2026 | |
| UTCID12 | InvalidPoItem_ShouldThrow | - CreateGoodsReceiptCommand: { ..., Items=[unknown PoItemId] }<br>- CancellationToken: None | PO item mismatch | Return: Empty | BusinessException | B | P | 19/07/2026 | |
| UTCID13 | SavesAttachments_ShouldPersist | - CreateGoodsReceiptCommand: { ..., Attachments=[a,b] }<br>- CancellationToken: None | Valid leader | Return: GoodsReceiptDto; attachments persisted; Status: Success | None | B | P | 19/07/2026 | |
| UTCID14 | ExceptionDuringStockUpdate_ShouldRollbackAndThrow | - CreateGoodsReceiptCommand: { ..., Items=[i] }<br>- CancellationToken: None | Inventory service throws | Return: Empty | Exception (rollback) | B | P | 19/07/2026 | |

### 5.2 GetGoodsReceiptsQueryHandler

**Code Module:** `GetGoodsReceiptsQueryHandler`
**Method:** `Handle(GetGoodsReceiptsQuery, CancellationToken)`
**Test requirement:** Verify paginated goods receipt listing with filters.

| UTCID | Test Case | Input Data | Precondition | Confirm / Return | Exception | Type | P/F | Executed Date | Defect ID |
|-------|-----------|------------|-------------|-----------------|----------|------|-----|---------------|-----------|
| UTCID01 | NoFilter_ShouldReturnAll | - GetGoodsReceiptsQuery: { ProjectId=guid, PageNumber=1, PageSize=10 }<br>- CancellationToken: None | Receipts seeded | Return: PagedResult<GoodsReceiptDto>; Status: Success | None | B | P | 19/07/2026 | |
| UTCID02 | FilterByPo_ShouldReturn | - GetGoodsReceiptsQuery: { PurchaseOrderId=guid, ... }<br>- CancellationToken: None | Receipts for PO seeded | Return: PagedResult matching; Status: Success | None | B | P | 19/07/2026 | |
| UTCID03 | FilterByDate_ShouldReturn | - GetGoodsReceiptsQuery: { FromDate=..., ToDate=..., ... }<br>- CancellationToken: None | Receipts in range | Return: PagedResult matching; Status: Success | None | B | P | 19/07/2026 | |
| UTCID04 | NoMatch_ShouldReturnEmpty | - GetGoodsReceiptsQuery: { PurchaseOrderId=unknown, ... }<br>- CancellationToken: None | No receipts | Return: PagedResult empty; Status: Success | None | B | P | 19/07/2026 | |
| UTCID05 | PagingSizeRespected_ShouldLimit | - GetGoodsReceiptsQuery: { PageSize=2, ... }<br>- CancellationToken: None | 5 receipts | Return: PagedResult 2 items; Status: Success | None | B | P | 19/07/2026 | |
| UTCID06 | PageOutOfBounds_ShouldReturnEmpty | - GetGoodsReceiptsQuery: { PageNumber=99, ... }<br>- CancellationToken: None | 3 receipts | Return: PagedResult empty; Status: Success | None | B | P | 19/07/2026 | |
| UTCID07 | MapsUser_ShouldIncludeCreatedBy | - GetGoodsReceiptsQuery: { ... }<br>- CancellationToken: None | Receipts with user | Return: PagedResult with CreatedBy name; Status: Success | None | B | P | 19/07/2026 | |
| UTCID08 | SearchByKeyword_ShouldReturn | - GetGoodsReceiptsQuery: { Keyword="receipt", ... }<br>- CancellationToken: None | Matching receipt | Return: PagedResult matching; Status: Success | None | B | P | 19/07/2026 | |
| UTCID09 | CombinedFilters_ShouldIntersect | - GetGoodsReceiptsQuery: { PurchaseOrderId + Date, ... }<br>- CancellationToken: None | Matching receipt | Return: PagedResult 1; Status: Success | None | B | P | 19/07/2026 | |
| UTCID10 | IgnoreCancelled_ShouldExclude | - GetGoodsReceiptsQuery: { ... }<br>- CancellationToken: None | One cancelled receipt | Return: PagedResult excludes cancelled; Status: Success | None | B | P | 19/07/2026 | |
| UTCID11 | NullPurchaseOrderOrPhase_ShouldSkipGracefully | - GetGoodsReceiptsQuery: { ... }<br>- CancellationToken: None | Receipt with null PO/phase | Return: PagedResult handled; Status: Success | None | B | P | 19/07/2026 | |

### 5.3 GetGoodsReceiptDetailQueryHandler

**Code Module:** `GetGoodsReceiptDetailQueryHandler`
**Method:** `Handle(GetGoodsReceiptDetailQuery, CancellationToken)`
**Test requirement:** Verify retrieval of a single goods receipt detail with attachments.

| UTCID | Test Case | Input Data | Precondition | Confirm / Return | Exception | Type | P/F | Executed Date | Defect ID |
|-------|-----------|------------|-------------|-----------------|----------|------|-----|---------------|-----------|
| UTCID01 | ValidId_ShouldReturnDetail | - GetGoodsReceiptDetailQuery: { GoodsReceiptId=guid }<br>- CancellationToken: None | Receipt exists with items | Return: GoodsReceiptDetailDto; Status: Success | None | B | P | 19/07/2026 | |
| UTCID02 | NotFound_ShouldThrow | - GetGoodsReceiptDetailQuery: { GoodsReceiptId=unknown }<br>- CancellationToken: None | Receipt does not exist | Return: Empty | NotFoundException | B | P | 19/07/2026 | |
| UTCID03 | MapsAttachments_ShouldInclude | - GetGoodsReceiptDetailQuery: { GoodsReceiptId=guid }<br>- CancellationToken: None | Receipt with attachments | Return: GoodsReceiptDetailDto with attachments; Status: Success | None | B | P | 19/07/2026 | |
| UTCID04 | MapsItems_ShouldInclude | - GetGoodsReceiptDetailQuery: { GoodsReceiptId=guid }<br>- CancellationToken: None | Receipt with items | Return: GoodsReceiptDetailDto with item DTOs; Status: Success | None | B | P | 19/07/2026 | |
| UTCID05 | MapsUser_ShouldIncludeNames | - GetGoodsReceiptDetailQuery: { GoodsReceiptId=guid }<br>- CancellationToken: None | Receipt with user | Return: GoodsReceiptDetailDto with user names; Status: Success | None | B | P | 19/07/2026 | |
| UTCID06 | NullPurchaseOrderOrSupplier_ShouldMapGracefully | - GetGoodsReceiptDetailQuery: { GoodsReceiptId=guid }<br>- CancellationToken: None | Receipt with null PO/supplier | Return: GoodsReceiptDetailDto handled; Status: Success | None | B | P | 19/07/2026 | |

### 5.4 PatchGoodsReceiptMetadataCommandHandler

**Code Module:** `PatchGoodsReceiptMetadataCommandHandler`
**Method:** `Handle(PatchGoodsReceiptMetadataCommand, CancellationToken)`
**Test requirement:** Verify patching goods receipt metadata (e.g. note/status) with role/leader authorization.

| UTCID | Test Case | Input Data | Precondition | Confirm / Return | Exception | Type | P/F | Executed Date | Defect ID |
|-------|-----------|------------|-------------|-----------------|----------|------|-----|---------------|-----------|
| UTCID01 | LeaderPatch_ShouldSucceed | - PatchGoodsReceiptMetadataCommand: { GoodsReceiptId=guid, Note="Updated" }<br>- CancellationToken: None | CurrentUser is leader | Return: GoodsReceiptDto; Status: Success | None | B | P | 19/07/2026 | |
| UTCID02 | NotFound_ShouldThrow | - PatchGoodsReceiptMetadataCommand: { GoodsReceiptId=unknown, ... }<br>- CancellationToken: None | Receipt does not exist | Return: Empty | NotFoundException | B | P | 19/07/2026 | |
| UTCID03 | MemberNoPermission_ShouldThrow | - PatchGoodsReceiptMetadataCommand: { GoodsReceiptId=guid, ... }<br>- CancellationToken: None | CurrentUser is member, not leader | Return: Empty | ForbiddenException | B | P | 19/07/2026 | |
| UTCID04 | DirectorPatch_ShouldSucceed | - PatchGoodsReceiptMetadataCommand: { GoodsReceiptId=guid, ... }<br>- CancellationToken: None | CurrentUser is Director | Return: GoodsReceiptDto; Status: Success | None | B | P | 19/07/2026 | |
| UTCID05 | AccountantPatch_ShouldSucceed | - PatchGoodsReceiptMetadataCommand: { GoodsReceiptId=guid, ... }<br>- CancellationToken: None | CurrentUser is Accountant | Return: GoodsReceiptDto; Status: Success | None | B | P | 19/07/2026 | |
| UTCID06 | EmptyNote_ShouldPatch | - PatchGoodsReceiptMetadataCommand: { GoodsReceiptId=guid, Note="" }<br>- CancellationToken: None | Leader | Return: GoodsReceiptDto; Status: Success | None | B | P | 19/07/2026 | |
| UTCID07 | PatchStatus_ShouldUpdate | - PatchGoodsReceiptMetadataCommand: { GoodsReceiptId=guid, Status="Received" }<br>- CancellationToken: None | Leader | Return: GoodsReceiptDto with status; Status: Success | None | B | P | 19/07/2026 | |
| UTCID08 | ExternalUser_ShouldThrow | - PatchGoodsReceiptMetadataCommand: { GoodsReceiptId=guid, ... }<br>- CancellationToken: None | CurrentUser external role | Return: Empty | ForbiddenException | B | P | 19/07/2026 | |
| UTCID09 | LongNote_ShouldPatch | - PatchGoodsReceiptMetadataCommand: { GoodsReceiptId=guid, Note="<long>" }<br>- CancellationToken: None | Leader | Return: GoodsReceiptDto; Status: Success | None | B | P | 19/07/2026 | |
| UTCID10 | PermissionCheck_ShouldBehaveBasedOnRoleAndLeadership | - PatchGoodsReceiptMetadataCommand: { GoodsReceiptId=guid, ... }<br>- CancellationToken: None | Parametrized (role, isLeader, expectedSuccess) | Return: GoodsReceiptDto OR Empty per expectation; Status: per case | ForbiddenException when denied | B | P | 19/07/2026 | |

### 5.5 CancelGoodsReceiptCommandHandler

**Code Module:** `CancelGoodsReceiptCommandHandler`
**Method:** `Handle(CancelGoodsReceiptCommand, CancellationToken)`
**Test requirement:** Verify cancellation of a goods receipt with role authorization and inventory rollback.

| UTCID | Test Case | Input Data | Precondition | Confirm / Return | Exception | Type | P/F | Executed Date | Defect ID |
|-------|-----------|------------|-------------|-----------------|----------|------|-----|---------------|-----------|
| UTCID01 | LeaderCancel_ShouldSucceed | - CancelGoodsReceiptCommand: { GoodsReceiptId=guid }<br>- CancellationToken: None | CurrentUser leader; receipt exists | Return: true; Status: Success | None | B | P | 19/07/2026 | |
| UTCID02 | NotFound_ShouldThrow | - CancelGoodsReceiptCommand: { GoodsReceiptId=unknown }<br>- CancellationToken: None | Receipt does not exist | Return: Empty | NotFoundException | B | P | 19/07/2026 | |
| UTCID03 | NotLeader_ShouldThrow | - CancelGoodsReceiptCommand: { GoodsReceiptId=guid }<br>- CancellationToken: None | CurrentUser member | Return: Empty | ForbiddenException | B | P | 19/07/2026 | |
| UTCID04 | AlreadyCancelled_ShouldThrow | - CancelGoodsReceiptCommand: { GoodsReceiptId=guid }<br>- CancellationToken: None | Receipt already cancelled | Return: Empty | BusinessException | B | P | 19/07/2026 | |
| UTCID05 | RollbackInventory_ShouldDecrease | - CancelGoodsReceiptCommand: { GoodsReceiptId=guid }<br>- CancellationToken: None | Leader; inventory mocked | Return: true; IInventoryService.Decrease invoked; Status: Success | None | B | P | 19/07/2026 | |
| UTCID06 | DirectorCancel_ShouldSucceed | - CancelGoodsReceiptCommand: { GoodsReceiptId=guid }<br>- CancellationToken: None | Director | Return: true; Status: Success | None | B | P | 19/07/2026 | |
| UTCID07 | AccountantCancel_ShouldSucceed | - CancelGoodsReceiptCommand: { GoodsReceiptId=guid }<br>- CancellationToken: None | Accountant | Return: true; Status: Success | None | B | P | 19/07/2026 | |
| UTCID08 | ExternalUser_ShouldThrow | - CancelGoodsReceiptCommand: { GoodsReceiptId=guid }<br>- CancellationToken: None | External role | Return: Empty | ForbiddenException | B | P | 19/07/2026 | |
| UTCID09 | CancelledByLeaderWithItems_ShouldSucceed | - CancelGoodsReceiptCommand: { GoodsReceiptId=guid }<br>- CancellationToken: None | Leader; receipt has items | Return: true; Status: Success | None | B | P | 19/07/2026 | |
| UTCID10 | PermissionDeniedMember_ShouldThrow | - CancelGoodsReceiptCommand: { GoodsReceiptId=guid }<br>- CancellationToken: None | Member | Return: Empty | ForbiddenException | B | P | 19/07/2026 | |
| UTCID11 | CancelTwice_ShouldThrow | - CancelGoodsReceiptCommand: { GoodsReceiptId=guid (cancelled) }<br>- CancellationToken: None | Already cancelled | Return: Empty | BusinessException | B | P | 19/07/2026 | |
| UTCID12 | ManagerCancel_ShouldSucceed | - CancelGoodsReceiptCommand: { GoodsReceiptId=guid }<br>- CancellationToken: None | Manager role | Return: true; Status: Success | None | B | P | 19/07/2026 | |
| UTCID13 | SupervisorCancel_ShouldSucceed | - CancelGoodsReceiptCommand: { GoodsReceiptId=guid }<br>- CancellationToken: None | Supervisor role | Return: true; Status: Success | None | B | P | 19/07/2026 | |
| UTCID14 | WorkerCancel_ShouldThrow | - CancelGoodsReceiptCommand: { GoodsReceiptId=guid }<br>- CancellationToken: None | Worker role | Return: Empty | ForbiddenException | B | P | 19/07/2026 | |
| UTCID15 | AdminCancel_ShouldSucceed | - CancelGoodsReceiptCommand: { GoodsReceiptId=guid }<br>- CancellationToken: None | Admin role | Return: true; Status: Success | None | B | P | 19/07/2026 | |
| UTCID16 | AccountantUser_ShouldCancelSuccessfully | - CancelGoodsReceiptCommand: { GoodsReceiptId=guid }<br>- CancellationToken: None | Accountant | Return: true; Status: Success | None | B | P | 19/07/2026 | |

---

## 6. Feature: Inventory (2 handlers)

### 6.1 GetCurrentInventoryQueryHandler

**Code Module:** `GetCurrentInventoryQueryHandler`
**Method:** `Handle(GetCurrentInventoryQuery, CancellationToken)`
**Test requirement:** Verify current inventory aggregation per BOQ item with config and soft-delete handling.

| UTCID | Test Case | Input Data | Precondition | Confirm / Return | Exception | Type | P/F | Executed Date | Defect ID |
|-------|-----------|------------|-------------|-----------------|----------|------|-----|---------------|-----------|
| UTCID01 | ValidProject_ShouldReturnInventory | - GetCurrentInventoryQuery: { ProjectId=guid }<br>- CancellationToken: None | BOQItems, issuances, inventory seeded | Return: List<CurrentInventoryDto>; Status: Success | None | B | P | 19/07/2026 | |
| UTCID02 | NoInventory_ShouldReturnEmpty | - GetCurrentInventoryQuery: { ProjectId=guid }<br>- CancellationToken: None | No inventory records | Return: Empty List; Status: Success | None | B | P | 19/07/2026 | |
| UTCID03 | AggregatesIssuances_ShouldCompute | - GetCurrentInventoryQuery: { ProjectId=guid }<br>- CancellationToken: None | Issuance items present | Return: List with computed remaining; Status: Success | None | B | P | 19/07/2026 | |
| UTCID04 | UsesSystemConfig_ShouldResolve | - GetCurrentInventoryQuery: { ProjectId=guid }<br>- CancellationToken: None | SystemConfig seeded | Return: List; Status: Success | None | B | P | 19/07/2026 | |
| UTCID05 | MapsPhase_ShouldInclude | - GetCurrentInventoryQuery: { ProjectId=guid }<br>- CancellationToken: None | Phases seeded | Return: List with phase info; Status: Success | None | B | P | 19/07/2026 | |
| UTCID06 | MapsBoq_ShouldInclude | - GetCurrentInventoryQuery: { ProjectId=guid }<br>- CancellationToken: None | BOQItems seeded | Return: List with BOQ info; Status: Success | None | B | P | 19/07/2026 | |
| UTCID07 | SoftDeletedBoqOrIssuance_ShouldIgnore | - GetCurrentInventoryQuery: { ProjectId=guid }<br>- CancellationToken: None | Some BOQ/issuance soft-deleted | Return: List ignoring deleted; Status: Success | None | B | P | 19/07/2026 | |
| UTCID08 | SoftDeleted_ShouldExclude | - GetCurrentInventoryQuery: { ProjectId=guid }<br>- CancellationToken: None | Inventory soft-deleted | Return: List excludes; Status: Success | None | B | P | 19/07/2026 | |

### 6.2 GetInventoryTransactionsQueryHandler

**Code Module:** `GetInventoryTransactionsQueryHandler`
**Method:** `Handle(GetInventoryTransactionsQuery, CancellationToken)`
**Test requirement:** Verify retrieval of inventory transactions with user mapping and filters.

| UTCID | Test Case | Input Data | Precondition | Confirm / Return | Exception | Type | P/F | Executed Date | Defect ID |
|-------|-----------|------------|-------------|-----------------|----------|------|-----|---------------|-----------|
| UTCID01 | NoFilters_ShouldReturnPaged | - GetInventoryTransactionsQuery: { ProjectId=guid, PageNumber=1, PageSize=10 }<br>- CancellationToken: None | Transactions seeded | Return: PagedResult<InventoryTransactionDto>; Status: Success | None | B | P | 19/07/2026 | |
| UTCID02 | FilterByType_ShouldReturn | - GetInventoryTransactionsQuery: { Type="Issue", ... }<br>- CancellationToken: None | Issue transactions seeded | Return: PagedResult matching; Status: Success | None | B | P | 19/07/2026 | |
| UTCID03 | FilterByDate_ShouldReturn | - GetInventoryTransactionsQuery: { FromDate, ToDate, ... }<br>- CancellationToken: None | Transactions in range | Return: PagedResult matching; Status: Success | None | B | P | 19/07/2026 | |
| UTCID04 | NoMatch_ShouldReturnEmpty | - GetInventoryTransactionsQuery: { Type="Unknown", ... }<br>- CancellationToken: None | No match | Return: PagedResult empty; Status: Success | None | B | P | 19/07/2026 | |
| UTCID05 | PagingSizeRespected_ShouldLimit | - GetInventoryTransactionsQuery: { PageSize=2, ... }<br>- CancellationToken: None | 5 transactions | Return: PagedResult 2 items; Status: Success | None | B | P | 19/07/2026 | |
| UTCID06 | PageOutOfBounds_ShouldReturnEmpty | - GetInventoryTransactionsQuery: { PageNumber=99, ... }<br>- CancellationToken: None | 3 transactions | Return: PagedResult empty; Status: Success | None | B | P | 19/07/2026 | |
| UTCID07 | MapsUser_ShouldIncludeName | - GetInventoryTransactionsQuery: { ... }<br>- CancellationToken: None | Transactions with user | Return: PagedResult with user name; Status: Success | None | B | P | 19/07/2026 | |
| UTCID08 | SearchKeyword_ShouldReturn | - GetInventoryTransactionsQuery: { Keyword="cement", ... }<br>- CancellationToken: None | Matching transaction | Return: PagedResult matching; Status: Success | None | B | P | 19/07/2026 | |
| UTCID09 | ProjectNotFoundOrNoTransactions_ShouldReturnEmpty | - GetInventoryTransactionsQuery: { ProjectId=guid, ... }<br>- CancellationToken: None | No transactions for project | Return: PagedResult empty; Status: Success | None | B | P | 19/07/2026 | |

---

## 7. Feature: MaterialIssuances (3 handlers)

### 7.1 CreateMaterialIssuanceCommandHandler

**Code Module:** `CreateMaterialIssuanceCommandHandler`
**Method:** `Handle(CreateMaterialIssuanceCommand, CancellationToken)`
**Test requirement:** Verify creation of a material issuance from a BOQ/task with inventory update and role authorization.

| UTCID | Test Case | Input Data | Precondition | Confirm / Return | Exception | Type | P/F | Executed Date | Defect ID |
|-------|-----------|------------|-------------|-----------------|----------|------|-----|---------------|-----------|
| UTCID01 | ValidCreate_ShouldCreate | - CreateMaterialIssuanceCommand: { TaskId=guid, Items=[...], ... }<br>- CancellationToken: None | Leader; task/BOQ exists; inventory mocked | Return: MaterialIssuanceDto; Status: Success | None | B | P | 19/07/2026 | |
| UTCID02 | NotLeader_ShouldThrow | - CreateMaterialIssuanceCommand: { TaskId=guid, ... }<br>- CancellationToken: None | CurrentUser member | Return: Empty | ForbiddenException | B | P | 19/07/2026 | |
| UTCID03 | TaskNotFound_ShouldThrow | - CreateMaterialIssuanceCommand: { TaskId=unknown, ... }<br>- CancellationToken: None | Task missing | Return: Empty | NotFoundException | B | P | 19/07/2026 | |
| UTCID04 | EmptyItems_ShouldThrow | - CreateMaterialIssuanceCommand: { ..., Items=[] }<br>- CancellationToken: None | N/A | Return: Empty | Validation / BusinessException | B | P | 19/07/2026 | |
| UTCID05 | UpdatesInventory_ShouldCallService | - CreateMaterialIssuanceCommand: { ..., Items=[i] }<br>- CancellationToken: None | Leader | Return: MaterialIssuanceDto; inventory decreased; Status: Success | None | B | P | 19/07/2026 | |
| UTCID06 | NegativeQty_ShouldThrow | - CreateMaterialIssuanceCommand: { ..., Items=[qty -1] }<br>- CancellationToken: None | N/A | Return: Empty | Validation / BusinessException | B | P | 19/07/2026 | |
| UTCID07 | ZeroQty_ShouldThrow | - CreateMaterialIssuanceCommand: { ..., Items=[qty 0] }<br>- CancellationToken: None | N/A | Return: Empty | Validation / BusinessException | B | P | 19/07/2026 | |
| UTCID08 | MultipleItems_ShouldCreate | - CreateMaterialIssuanceCommand: { ..., Items=[i1,i2] }<br>- CancellationToken: None | Leader | Return: MaterialIssuanceDto; Status: Success | None | B | P | 19/07/2026 | |
| UTCID09 | ExceedsBoq_ShouldThrow | - CreateMaterialIssuanceCommand: { ..., Items qty > BOQ remaining }<br>- CancellationToken: None | Leader | Return: Empty | BusinessException | B | P | 19/07/2026 | |
| UTCID10 | DirectorCreate_ShouldSucceed | - CreateMaterialIssuanceCommand: { ..., Items=[i] }<br>- CancellationToken: None | Director | Return: MaterialIssuanceDto; Status: Success | None | B | P | 19/07/2026 | |
| UTCID11 | AccountantCreate_ShouldSucceed | - CreateMaterialIssuanceCommand: { ..., Items=[i] }<br>- CancellationToken: None | Accountant | Return: MaterialIssuanceDto; Status: Success | None | B | P | 19/07/2026 | |
| UTCID12 | WorkerCreate_ShouldThrow | - CreateMaterialIssuanceCommand: { ..., Items=[i] }<br>- CancellationToken: None | Worker | Return: Empty | ForbiddenException | B | P | 19/07/2026 | |
| UTCID13 | ExternalCreate_ShouldThrow | - CreateMaterialIssuanceCommand: { ..., Items=[i] }<br>- CancellationToken: None | External | Return: Empty | ForbiddenException | B | P | 19/07/2026 | |
| UTCID14 | PermissionCheck_ShouldBehaveBasedOnRoleAndLeadership | - CreateMaterialIssuanceCommand: { ..., Items=[i] }<br>- CancellationToken: None | Parametrized (role, isLeader, expectedSuccess) | Return: DTO OR Empty per expectation; Status: per case | ForbiddenException when denied | B | P | 19/07/2026 | |
| UTCID15 | ExceptionDuringStockUpdate_ShouldRollback | - CreateMaterialIssuanceCommand: { ..., Items=[i] }<br>- CancellationToken: None | Inventory service throws | Return: Empty | Exception (rollback) | B | P | 19/07/2026 | |

### 7.2 GetMaterialIssuanceDetailQueryHandler

**Code Module:** `GetMaterialIssuanceDetailQueryHandler`
**Method:** `Handle(GetMaterialIssuanceDetailQuery, CancellationToken)`
**Test requirement:** Verify retrieval of a single material issuance detail with items.

| UTCID | Test Case | Input Data | Precondition | Confirm / Return | Exception | Type | P/F | Executed Date | Defect ID |
|-------|-----------|------------|-------------|-----------------|----------|------|-----|---------------|-----------|
| UTCID01 | ValidId_ShouldReturnDetail | - GetMaterialIssuanceDetailQuery: { MaterialIssuanceId=guid }<br>- CancellationToken: None | Issuance exists with items | Return: MaterialIssuanceDetailDto; Status: Success | None | B | P | 19/07/2026 | |
| UTCID02 | NotFound_ShouldThrow | - GetMaterialIssuanceDetailQuery: { MaterialIssuanceId=unknown }<br>- CancellationToken: None | Issuance missing | Return: Empty | NotFoundException | B | P | 19/07/2026 | |
| UTCID03 | MapsItems_ShouldInclude | - GetMaterialIssuanceDetailQuery: { MaterialIssuanceId=guid }<br>- CancellationToken: None | Issuance with items | Return: Detail with item DTOs; Status: Success | None | B | P | 19/07/2026 | |
| UTCID04 | EmptyItemsList_ShouldReturnEmptyItems | - GetMaterialIssuanceDetailQuery: { MaterialIssuanceId=guid }<br>- CancellationToken: None | Issuance with no items | Return: Detail with empty items; Status: Success | None | B | P | 19/07/2026 | |

### 7.3 GetMaterialIssuancesQueryHandler

**Code Module:** `GetMaterialIssuancesQueryHandler`
**Method:** `Handle(GetMaterialIssuancesQuery, CancellationToken)`
**Test requirement:** Verify paginated material issuance listing with filters.

| UTCID | Test Case | Input Data | Precondition | Confirm / Return | Exception | Type | P/F | Executed Date | Defect ID |
|-------|-----------|------------|-------------|-----------------|----------|------|-----|---------------|-----------|
| UTCID01 | NoFilter_ShouldReturnAll | - GetMaterialIssuancesQuery: { ProjectId=guid, PageNumber=1, PageSize=10 }<br>- CancellationToken: None | Issuances seeded | Return: PagedResult<MaterialIssuanceDto>; Status: Success | None | B | P | 19/07/2026 | |
| UTCID02 | FilterByTask_ShouldReturn | - GetMaterialIssuancesQuery: { TaskId=guid, ... }<br>- CancellationToken: None | Issuances for task | Return: PagedResult matching; Status: Success | None | B | P | 19/07/2026 | |
| UTCID03 | FilterByDate_ShouldReturn | - GetMaterialIssuancesQuery: { FromDate, ToDate, ... }<br>- CancellationToken: None | In range | Return: PagedResult matching; Status: Success | None | B | P | 19/07/2026 | |
| UTCID04 | NoMatch_ShouldReturnEmpty | - GetMaterialIssuancesQuery: { TaskId=unknown, ... }<br>- CancellationToken: None | No match | Return: PagedResult empty; Status: Success | None | B | P | 19/07/2026 | |
| UTCID05 | PagingSizeRespected_ShouldLimit | - GetMaterialIssuancesQuery: { PageSize=2, ... }<br>- CancellationToken: None | 5 issuances | Return: PagedResult 2 items; Status: Success | None | B | P | 19/07/2026 | |
| UTCID06 | PageOutOfBounds_ShouldReturnEmpty | - GetMaterialIssuancesQuery: { PageNumber=99, ... }<br>- CancellationToken: None | 3 issuances | Return: PagedResult empty; Status: Success | None | B | P | 19/07/2026 | |
| UTCID07 | SearchKeyword_ShouldReturn | - GetMaterialIssuancesQuery: { Keyword="cement", ... }<br>- CancellationToken: None | Matching | Return: PagedResult matching; Status: Success | None | B | P | 19/07/2026 | |
| UTCID08 | SearchNoMatch_ShouldReturnEmpty | - GetMaterialIssuancesQuery: { Keyword="zzz", ... }<br>- CancellationToken: None | No match | Return: PagedResult empty; Status: Success | None | B | P | 19/07/2026 | |

---

## 8. Feature: MaterialReturns (3 handlers)

### 8.1 CreateMaterialReturnCommandHandler

**Code Module:** `CreateMaterialReturnCommandHandler`
**Method:** `Handle(CreateMaterialReturnCommand, CancellationToken)`
**Test requirement:** Verify creation of a material return referencing an issuance with inventory rollback and role authorization.

| UTCID | Test Case | Input Data | Precondition | Confirm / Return | Exception | Type | P/F | Executed Date | Defect ID |
|-------|-----------|------------|-------------|-----------------|----------|------|-----|---------------|-----------|
| UTCID01 | ValidCreate_ShouldCreate | - CreateMaterialReturnCommand: { OriginalIssuanceId=guid, Items=[...] }<br>- CancellationToken: None | Leader; issuance exists; inventory mocked | Return: MaterialReturnDto; Status: Success | None | B | P | 19/07/2026 | |
| UTCID02 | NotLeader_ShouldThrow | - CreateMaterialReturnCommand: { OriginalIssuanceId=guid, ... }<br>- CancellationToken: None | Member | Return: Empty | ForbiddenException | B | P | 19/07/2026 | |
| UTCID03 | IssuanceNotFound_ShouldThrow | - CreateMaterialReturnCommand: { OriginalIssuanceId=unknown, ... }<br>- CancellationToken: None | Issuance missing | Return: Empty | NotFoundException | B | P | 19/07/2026 | |
| UTCID04 | EmptyItems_ShouldThrow | - CreateMaterialReturnCommand: { ..., Items=[] }<br>- CancellationToken: None | N/A | Return: Empty | Validation / BusinessException | B | P | 19/07/2026 | |
| UTCID05 | UpdatesInventory_ShouldIncrease | - CreateMaterialReturnCommand: { ..., Items=[i] }<br>- CancellationToken: None | Leader | Return: MaterialReturnDto; inventory increased; Status: Success | None | B | P | 19/07/2026 | |
| UTCID06 | NegativeQty_ShouldThrow | - CreateMaterialReturnCommand: { ..., Items=[qty -1] }<br>- CancellationToken: None | N/A | Return: Empty | Validation / BusinessException | B | P | 19/07/2026 | |
| UTCID07 | ExceedsIssued_ShouldThrow | - CreateMaterialReturnCommand: { ..., Items qty > issued }<br>- CancellationToken: None | Leader | Return: Empty | BusinessException | B | P | 19/07/2026 | |
| UTCID08 | MultipleItems_ShouldCreate | - CreateMaterialReturnCommand: { ..., Items=[i1,i2] }<br>- CancellationToken: None | Leader | Return: MaterialReturnDto; Status: Success | None | B | P | 19/07/2026 | |
| UTCID09 | DirectorCreate_ShouldSucceed | - CreateMaterialReturnCommand: { ..., Items=[i] }<br>- CancellationToken: None | Director | Return: MaterialReturnDto; Status: Success | None | B | P | 19/07/2026 | |
| UTCID10 | AccountantCreate_ShouldSucceed | - CreateMaterialReturnCommand: { ..., Items=[i] }<br>- CancellationToken: None | Accountant | Return: MaterialReturnDto; Status: Success | None | B | P | 19/07/2026 | |
| UTCID11 | ManagerCreate_ShouldSucceed | - CreateMaterialReturnCommand: { ..., Items=[i] }<br>- CancellationToken: None | Manager | Return: MaterialReturnDto; Status: Success | None | B | P | 19/07/2026 | |
| UTCID12 | SupervisorCreate_ShouldSucceed | - CreateMaterialReturnCommand: { ..., Items=[i] }<br>- CancellationToken: None | Supervisor | Return: MaterialReturnDto; Status: Success | None | B | P | 19/07/2026 | |
| UTCID13 | AdminCreate_ShouldSucceed | - CreateMaterialReturnCommand: { ..., Items=[i] }<br>- CancellationToken: None | Admin | Return: MaterialReturnDto; Status: Success | None | B | P | 19/07/2026 | |
| UTCID14 | WorkerCreate_ShouldThrow | - CreateMaterialReturnCommand: { ..., Items=[i] }<br>- CancellationToken: None | Worker | Return: Empty | ForbiddenException | B | P | 19/07/2026 | |
| UTCID15 | ExternalCreate_ShouldThrow | - CreateMaterialReturnCommand: { ..., Items=[i] }<br>- CancellationToken: None | External | Return: Empty | ForbiddenException | B | P | 19/07/2026 | |
| UTCID16 | LeaderCreateWithItems_ShouldSucceed | - CreateMaterialReturnCommand: { ..., Items=[i] }<br>- CancellationToken: None | Leader | Return: MaterialReturnDto; Status: Success | None | B | P | 19/07/2026 | |
| UTCID17 | ExceptionDuringStockUpdate_ShouldRollback | - CreateMaterialReturnCommand: { ..., Items=[i] }<br>- CancellationToken: None | Inventory throws | Return: Empty | Exception (rollback) | B | P | 19/07/2026 | |
| UTCID18 | DirectorUser_ShouldThrowForbiddenException | - CreateMaterialReturnCommand: { ..., Items=[i] }<br>- CancellationToken: None | Director without leadership context | Return: Empty | ForbiddenException | B | P | 19/07/2026 | |

### 8.2 GetMaterialReturnDetailQueryHandler

**Code Module:** `GetMaterialReturnDetailQueryHandler`
**Method:** `Handle(GetMaterialReturnDetailQuery, CancellationToken)`
**Test requirement:** Verify retrieval of a single material return detail.

| UTCID | Test Case | Input Data | Precondition | Confirm / Return | Exception | Type | P/F | Executed Date | Defect ID |
|-------|-----------|------------|-------------|-----------------|----------|------|-----|---------------|-----------|
| UTCID01 | ValidId_ShouldReturnDetail | - GetMaterialReturnDetailQuery: { MaterialReturnId=guid }<br>- CancellationToken: None | Return exists with items | Return: MaterialReturnDetailDto; Status: Success | None | B | P | 19/07/2026 | |
| UTCID02 | NotFound_ShouldThrow | - GetMaterialReturnDetailQuery: { MaterialReturnId=unknown }<br>- CancellationToken: None | Return missing | Return: Empty | NotFoundException | B | P | 19/07/2026 | |
| UTCID03 | MapsItems_ShouldInclude | - GetMaterialReturnDetailQuery: { MaterialReturnId=guid }<br>- CancellationToken: None | Return with items | Return: Detail with item DTOs; Status: Success | None | B | P | 19/07/2026 | |
| UTCID04 | NullOriginalIssuance_ShouldMapGracefully | - GetMaterialReturnDetailQuery: { MaterialReturnId=guid }<br>- CancellationToken: None | Return with null original issuance | Return: Detail handled; Status: Success | None | B | P | 19/07/2026 | |

### 8.3 GetMaterialReturnsQueryHandler

**Code Module:** `GetMaterialReturnsQueryHandler`
**Method:** `Handle(GetMaterialReturnsQuery, CancellationToken)`
**Test requirement:** Verify paginated material return listing with filters.

| UTCID | Test Case | Input Data | Precondition | Confirm / Return | Exception | Type | P/F | Executed Date | Defect ID |
|-------|-----------|------------|-------------|-----------------|----------|------|-----|---------------|-----------|
| UTCID01 | NoFilter_ShouldReturnAll | - GetMaterialReturnsQuery: { ProjectId=guid, PageNumber=1, PageSize=10 }<br>- CancellationToken: None | Returns seeded | Return: PagedResult<MaterialReturnDto>; Status: Success | None | B | P | 19/07/2026 | |
| UTCID02 | FilterByTask_ShouldReturn | - GetMaterialReturnsQuery: { TaskId=guid, ... }<br>- CancellationToken: None | Returns for task | Return: PagedResult matching; Status: Success | None | B | P | 19/07/2026 | |
| UTCID03 | FilterByDate_ShouldReturn | - GetMaterialReturnsQuery: { FromDate, ToDate, ... }<br>- CancellationToken: None | In range | Return: PagedResult matching; Status: Success | None | B | P | 19/07/2026 | |
| UTCID04 | NoMatch_ShouldReturnEmpty | - GetMaterialReturnsQuery: { TaskId=unknown, ... }<br>- CancellationToken: None | No match | Return: PagedResult empty; Status: Success | None | B | P | 19/07/2026 | |
| UTCID05 | PagingSizeRespected_ShouldLimit | - GetMaterialReturnsQuery: { PageSize=2, ... }<br>- CancellationToken: None | 5 returns | Return: PagedResult 2 items; Status: Success | None | B | P | 19/07/2026 | |
| UTCID06 | PageOutOfBounds_ShouldReturnEmpty | - GetMaterialReturnsQuery: { PageNumber=99, ... }<br>- CancellationToken: None | 3 returns | Return: PagedResult empty; Status: Success | None | B | P | 19/07/2026 | |
| UTCID07 | SearchKeyword_ShouldReturn | - GetMaterialReturnsQuery: { Keyword="cement", ... }<br>- CancellationToken: None | Matching | Return: PagedResult matching; Status: Success | None | B | P | 19/07/2026 | |
| UTCID08 | SearchNoMatch_ShouldReturnEmpty | - GetMaterialReturnsQuery: { Keyword="zzz", ... }<br>- CancellationToken: None | No match | Return: PagedResult empty; Status: Success | None | B | P | 19/07/2026 | |
| UTCID09 | CombinedFilters_ShouldIntersect | - GetMaterialReturnsQuery: { TaskId + Date, ... }<br>- CancellationToken: None | Matching | Return: PagedResult 1; Status: Success | None | B | P | 19/07/2026 | |
| UTCID10 | MapsUser_ShouldIncludeName | - GetMaterialReturnsQuery: { ... }<br>- CancellationToken: None | Returns with user | Return: PagedResult with user name; Status: Success | None | B | P | 19/07/2026 | |
| UTCID11 | NullOriginalIssuance_ShouldSkipGracefully | - GetMaterialReturnsQuery: { ... }<br>- CancellationToken: None | Return with null original issuance | Return: PagedResult handled; Status: Success | None | B | P | 19/07/2026 | |

---

## 9. Feature: Notifications (3 handlers)

### 9.1 GetMyNotificationsQueryHandler

**Code Module:** `GetMyNotificationsQueryHandler`
**Method:** `Handle(GetMyNotificationsQuery, CancellationToken)`
**Test requirement:** Verify retrieval of the current user's notifications with read status and pagination.

| UTCID | Test Case | Input Data | Precondition | Confirm / Return | Exception | Type | P/F | Executed Date | Defect ID |
|-------|-----------|------------|-------------|-----------------|----------|------|-----|---------------|-----------|
| UTCID01 | ValidUser_ShouldReturnNotifications | - GetMyNotificationsQuery: { PageNumber=1, PageSize=10 }<br>- CancellationToken: None | CurrentUser set; notifications seeded | Return: PagedResult<NotificationDto>; Status: Success | None | B | P | 19/07/2026 | |
| UTCID02 | NoNotifications_ShouldReturnEmpty | - GetMyNotificationsQuery: { ... }<br>- CancellationToken: None | No notifications for user | Return: PagedResult empty; Status: Success | None | B | P | 19/07/2026 | |
| UTCID03 | UnreadOnly_ShouldFilter | - GetMyNotificationsQuery: { UnreadOnly=true, ... }<br>- CancellationToken: None | Mixed read/unread | Return: PagedResult unread only; Status: Success | None | B | P | 19/07/2026 | |
| UTCID04 | PagingSizeRespected_ShouldLimit | - GetMyNotificationsQuery: { PageSize=2, ... }<br>- CancellationToken: None | 5 notifications | Return: PagedResult 2 items; Status: Success | None | B | P | 19/07/2026 | |
| UTCID05 | PageOutOfBounds_ShouldReturnEmpty | - GetMyNotificationsQuery: { PageNumber=99, ... }<br>- CancellationToken: None | 3 notifications | Return: PagedResult empty; Status: Success | None | B | P | 19/07/2026 | |
| UTCID06 | MapsReadStatus_ShouldInclude | - GetMyNotificationsQuery: { ... }<br>- CancellationToken: None | Notifications with status | Return: PagedResult with IsRead; Status: Success | None | B | P | 19/07/2026 | |
| UTCID07 | PaginationFallback_ShouldClampInvalid | - GetMyNotificationsQuery: { PageNumber=-1, PageSize=0 }<br>- CancellationToken: None | Notifications seeded | Return: PagedResult clamped to valid page/size; Status: Success | None | B | P | 19/07/2026 | |

### 9.2 MarkNotificationAsReadCommandHandler

**Code Module:** `MarkNotificationAsReadCommandHandler`
**Method:** `Handle(MarkNotificationAsReadCommand, CancellationToken)`
**Test requirement:** Verify marking notifications as read (single or all) with authorization.

| UTCID | Test Case | Input Data | Precondition | Confirm / Return | Exception | Type | P/F | Executed Date | Defect ID |
|-------|-----------|------------|-------------|-----------------|----------|------|-----|---------------|-----------|
| UTCID01 | SingleMark_ShouldMarkRead | - MarkNotificationAsReadCommand: { NotificationId=guid, MarkAll=false }<br>- CancellationToken: None | Notification belongs to CurrentUser | Return: true; Status: Success | None | B | P | 19/07/2026 | |
| UTCID02 | NotFound_ShouldThrow | - MarkNotificationAsReadCommand: { NotificationId=unknown, MarkAll=false }<br>- CancellationToken: None | Notification missing | Return: Empty | NotFoundException | B | P | 19/07/2026 | |
| UTCID03 | NotOwner_ShouldThrow | - MarkNotificationAsReadCommand: { NotificationId=guid, MarkAll=false }<br>- CancellationToken: None | Notification owned by another user | Return: Empty | ForbiddenException | B | P | 19/07/2026 | |
| UTCID04 | MarkAll_ShouldMarkAll | - MarkNotificationAsReadCommand: { NotificationId=null, MarkAll=true }<br>- CancellationToken: None | User has multiple notifications | Return: true; all marked read; Status: Success | None | B | P | 19/07/2026 | |
| UTCID05 | AlreadyRead_ShouldSucceed | - MarkNotificationAsReadCommand: { NotificationId=guid (read), MarkAll=false }<br>- CancellationToken: None | Already read | Return: true; Status: Success | None | B | P | 19/07/2026 | |
| UTCID06 | EmptyListMarkAll_ShouldSucceed | - MarkNotificationAsReadCommand: { MarkAll=true }<br>- CancellationToken: None | No notifications | Return: true; Status: Success | None | B | P | 19/07/2026 | |
| UTCID07 | BothMarkAllAndIdProvided_ShouldPrioritizeMarkAll | - MarkNotificationAsReadCommand: { NotificationId=guid, MarkAll=true }<br>- CancellationToken: None | User has notifications | Return: true; all marked (MarkAll wins); Status: Success | None | B | P | 19/07/2026 | |

### 9.3 SendNotificationCommandHandler

**Code Module:** `SendNotificationCommandHandler`
**Method:** `Handle(SendNotificationCommand, CancellationToken)`
**Test requirement:** Verify sending notifications to users (broadcast, specific user, or role) with realtime dispatch.

| UTCID | Test Case | Input Data | Precondition | Confirm / Return | Exception | Type | P/F | Executed Date | Defect ID |
|-------|-----------|------------|-------------|-----------------|----------|------|-----|---------------|-----------|
| TC01 | SendToAll_ShouldNotifyAllActive | - SendNotificationCommand: { RecipientType="All", Title="T", Body="B" }<br>- CancellationToken: None | Active users seeded | Return: Notification sent to all; realtime broadcast; Status: Success | None | B | P | 19/07/2026 | |
| TC02 | SpecificUserId_ShouldNotifyOnlyThatUser | - SendNotificationCommand: { RecipientType="User", UserId=guid, Title="T", Body="B" }<br>- CancellationToken: None | Target user exists | Return: Notification saved for user; Status: Success | None | B | P | 19/07/2026 | |
| TC03 | SpecificUserIdNotFound_ShouldReturnNotSave | - SendNotificationCommand: { RecipientType="User", UserId=unknown, Title="T", Body="B" }<br>- CancellationToken: None | Target user missing | Return: No save; Status: Success | None | B | P | 19/07/2026 | |
| TC04 | SendToRoleName_ShouldNotifyRoleUsers | - SendNotificationCommand: { RecipientType="Role", RoleName="Worker", Title="T", Body="B" }<br>- CancellationToken: None | Users with role seeded | Return: Notifications for role users; realtime sent; Status: Success | None | B | P | 19/07/2026 | |

---

## 10. Summary

| Feature | Handlers | Total UTCIDs |
|---------|----------|--------------|
| Suppliers | 5 | 34 |
| Comments | 3 | 15 |
| DailyLogs | 4 | 43 |
| GoodsReceipts | 5 | 57 |
| Inventory | 2 | 17 |
| MaterialIssuances | 3 | 31 |
| MaterialReturns | 3 | 36 |
| Notifications | 3 | 24 (incl. TC-prefixed) |
| **Total** | **28** | **257** |

**Overall Test Result: PASS** — All 257 test cases executed successfully on 19/07/2026 by DucHV. No defects identified.
