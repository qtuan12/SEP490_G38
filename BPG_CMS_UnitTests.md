# BPG_CMS Unit Test Specification

**Project:** BPG_CMS
**Module:** BPG.Application.UnitTests
**Document Type:** Unit Test Specification
**Author:** DucHV
**Date:** 19/07/2026

**Conventions:**
- Each test case is identified by a UTCID (Unit Test Case ID).
- Test results use P (Passed) / F (Failed) / N/A (Not Applicable).
- Black-box (B) or White-box (W) test technique is noted per case.
- All handlers are tested through MediatR; validators run automatically via the pipeline.
- CancellationToken.None is passed in all handler calls.
- The `Input data (CancellationToken.None)` row is ticked (O) for every UTCID since all handler calls pass CancellationToken.None.

## 2. Feature: Comments (3 handlers)


### 2.1 AddCommentCommandHandler

**Code Module:** `AddCommentCommandHandler`
**Method:** `Handle(AddCommentCommand, CancellationToken)`
**Test requirement:** Verify AddCommentCommandHandler behavior covering access, add, admin, authenticated, boundary, but, comment, commenter.

**Created By:** DucHV &nbsp;&nbsp; **Executed By:** DucHV

| Passed | Failed | Untested | N/A/B | Total Test Cases |
|--------|--------|----------|-------|------------------|
| 11 | 0 | 0 | 0 | 11 |

| Condition | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 | UTCID06 | UTCID07 | UTCID08 | UTCID09 | UTCID10 | UTCID11 |
|-----------|------|------|------|------|------|------|------|------|------|------|------|
| Precondition | O | O | O | O | O | O | O | O | O | O | O |
| Input data | O | O | O | O | O | O | O | O | O | O | O |
| Input data (CancellationToken.None) | O | O | O | O | O | O | O | O | O | O | O |
| Confirm &rarr; Return | O | O |  |  | O | O | O | O |  | O | O |
| Exception |  |  | O | O |  |  |  |  | O |  |  |
| Result &rarr; Type (N/A/B) | B | B | B | B | B | B | B | B | B | B | B |
| Passed / Failed | P | P | P | P | P | P | P | P | P | P | P |
| Executed Date | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 |
| Defect ID |  |  |  |  |  |  |  |  |  |  |  |


### 2.2 DeleteCommentCommandHandler

**Code Module:** `DeleteCommentCommandHandler`
**Method:** `Handle(DeleteCommentCommand, CancellationToken)`
**Test requirement:** Verify DeleteCommentCommandHandler behavior covering access, already, authenticated, author, comment, delete, deleted, exception.

**Created By:** DucHV &nbsp;&nbsp; **Executed By:** DucHV

| Passed | Failed | Untested | N/A/B | Total Test Cases |
|--------|--------|----------|-------|------------------|
| 6 | 0 | 0 | 0 | 6 |

| Condition | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 | UTCID06 |
|-----------|------|------|------|------|------|------|
| Precondition | O | O | O | O | O | O |
| Input data | O | O | O | O | O | O |
| Input data (CancellationToken.None) | O | O | O | O | O | O |
| Confirm &rarr; Return | O |  |  |  | O |  |
| Exception |  | O | O | O |  | O |
| Result &rarr; Type (N/A/B) | B | B | B | B | B | B |
| Passed / Failed | P | P | P | P | P | P |
| Executed Date | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 |
| Defect ID |  |  |  |  |  |  |


### 2.3 UpdateCommentCommandHandler

**Code Module:** `UpdateCommentCommandHandler`
**Method:** `Handle(UpdateCommentCommand, CancellationToken)`
**Test requirement:** Verify UpdateCommentCommandHandler behavior covering access, already, authenticated, author, boundary, comment, content, deleted.

**Created By:** DucHV &nbsp;&nbsp; **Executed By:** DucHV

| Passed | Failed | Untested | N/A/B | Total Test Cases |
|--------|--------|----------|-------|------------------|
| 6 | 0 | 0 | 0 | 6 |

| Condition | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 | UTCID06 |
|-----------|------|------|------|------|------|------|
| Precondition | O | O | O | O | O | O |
| Input data | O | O | O | O | O | O |
| Input data (CancellationToken.None) | O | O | O | O | O | O |
| Confirm &rarr; Return | O |  |  |  | O |  |
| Exception |  | O | O | O |  | O |
| Result &rarr; Type (N/A/B) | B | B | B | B | B | B |
| Passed / Failed | P | P | P | P | P | P |
| Executed Date | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 |
| Defect ID |  |  |  |  |  |  |

## 3. Feature: DailyLogs (4 handlers)


### 3.1 CreateDailyLogCommandHandler

**Code Module:** `CreateDailyLogCommandHandler`
**Method:** `Handle(CreateDailyLogCommand, CancellationToken)`
**Test requirement:** Verify CreateDailyLogCommandHandler behavior covering active, admin, already, ancestor, and, business, by, completed.

**Created By:** DucHV &nbsp;&nbsp; **Executed By:** DucHV

| Passed | Failed | Untested | N/A/B | Total Test Cases |
|--------|--------|----------|-------|------------------|
| 17 | 0 | 0 | 0 | 17 |

| Condition | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 | UTCID06 | UTCID07 | UTCID08 | UTCID09 | UTCID10 | UTCID11 | UTCID12 | UTCID13 | UTCID14 | UTCID15 | UTCID16 | UTCID17 |
|-----------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|
| Precondition | O | O | O | O | O | O | O | O | O | O | O | O | O | O | O | O | O |
| Input data | O | O | O | O | O | O | O | O | O | O | O | O | O | O | O | O | O |
| Input data (CancellationToken.None) | O | O | O | O | O | O | O | O | O | O | O | O | O | O | O | O | O |
| Confirm &rarr; Return | O | O |  |  |  |  |  | O | O |  | O | O |  |  | O | O | O |
| Exception |  |  | O | O | O | O | O |  |  | O |  |  | O | O |  |  |  |
| Result &rarr; Type (N/A/B) | B | B | B | B | B | B | B | B | B | B | B | B | B | B | B | B | B |
| Passed / Failed | P | P | P | P | P | P | P | P | P | P | P | P | P | P | P | P | P |
| Executed Date | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 |
| Defect ID |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |


### 3.2 GetDailyLogsQueryHandler

**Code Module:** `GetDailyLogsQueryHandler`
**Method:** `Handle(GetDailyLogsQuery, CancellationToken)`
**Test requirement:** Verify GetDailyLogsQueryHandler behavior covering bounds, by, children, combined, created, date, empty, filter.

**Created By:** DucHV &nbsp;&nbsp; **Executed By:** DucHV

| Passed | Failed | Untested | N/A/B | Total Test Cases |
|--------|--------|----------|-------|------------------|
| 6 | 0 | 0 | 0 | 6 |

| Condition | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 | UTCID06 |
|-----------|------|------|------|------|------|------|
| Precondition | O | O | O | O | O | O |
| Input data | O | O | O | O | O | O |
| Input data (CancellationToken.None) | O | O | O | O | O | O |
| Confirm &rarr; Return | O | O | O | O | O | O |
| Exception |  |  |  |  |  |  |
| Result &rarr; Type (N/A/B) | B | B | B | B | B | B |
| Passed / Failed | P | P | P | P | P | P |
| Executed Date | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 |
| Defect ID |  |  |  |  |  |  |


### 3.3 GetTaskProgressHistoryQueryHandler

**Code Module:** `GetTaskProgressHistoryQueryHandler`
**Method:** `Handle(GetTaskProgressHistoryQuery, CancellationToken)`
**Test requirement:** Verify GetTaskProgressHistoryQueryHandler behavior covering admin, empty, exception, exists, forbidden, found, handle, history.

**Created By:** DucHV &nbsp;&nbsp; **Executed By:** DucHV

| Passed | Failed | Untested | N/A/B | Total Test Cases |
|--------|--------|----------|-------|------------------|
| 5 | 0 | 0 | 0 | 5 |

| Condition | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 |
|-----------|------|------|------|------|------|
| Precondition | O | O | O | O | O |
| Input data | O | O | O | O | O |
| Input data (CancellationToken.None) | O | O | O | O | O |
| Confirm &rarr; Return | O |  |  | O | O |
| Exception |  | O | O |  |  |
| Result &rarr; Type (N/A/B) | B | B | B | B | B |
| Passed / Failed | P | P | P | P | P |
| Executed Date | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 |
| Defect ID |  |  |  |  |  |


### 3.4 UpdateDailyLogCommandHandler

**Code Module:** `UpdateDailyLogCommandHandler`
**Method:** `Handle(UpdateDailyLogCommand, CancellationToken)`
**Test requirement:** Verify UpdateDailyLogCommandHandler behavior covering active, all, and, assignee, attachments, business, changed, daily.

**Created By:** DucHV &nbsp;&nbsp; **Executed By:** DucHV

| Passed | Failed | Untested | N/A/B | Total Test Cases |
|--------|--------|----------|-------|------------------|
| 10 | 0 | 0 | 0 | 10 |

| Condition | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 | UTCID06 | UTCID07 | UTCID08 | UTCID09 | UTCID10 |
|-----------|------|------|------|------|------|------|------|------|------|------|
| Precondition | O | O | O | O | O | O | O | O | O | O |
| Input data | O | O | O | O | O | O | O | O | O | O |
| Input data (CancellationToken.None) | O | O | O | O | O | O | O | O | O | O |
| Confirm &rarr; Return | O |  |  |  |  | O | O | O |  | O |
| Exception |  | O | O | O | O |  |  |  | O |  |
| Result &rarr; Type (N/A/B) | B | B | B | B | B | B | B | B | B | B |
| Passed / Failed | P | P | P | P | P | P | P | P | P | P |
| Executed Date | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 |
| Defect ID |  |  |  |  |  |  |  |  |  |  |

## 4. Feature: GoodsReceipts (5 handlers)


### 4.1 CancelGoodsReceiptCommandHandler

**Code Module:** `CancelGoodsReceiptCommandHandler`
**Method:** `Handle(CancelGoodsReceiptCommand, CancellationToken)`
**Test requirement:** Verify CancelGoodsReceiptCommandHandler behavior covering accountant, active, all, already, and, business, cancel, cancelled.

**Created By:** DucHV &nbsp;&nbsp; **Executed By:** DucHV

| Passed | Failed | Untested | N/A/B | Total Test Cases |
|--------|--------|----------|-------|------------------|
| 16 | 0 | 0 | 0 | 16 |

| Condition | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 | UTCID06 | UTCID07 | UTCID08 | UTCID09 | UTCID10 | UTCID11 | UTCID12 | UTCID13 | UTCID14 | UTCID15 | UTCID16 |
|-----------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|
| Precondition | O | O | O | O | O | O | O | O | O | O | O | O | O | O | O | O |
| Input data | O | O | O | O | O | O | O | O | O | O | O | O | O | O | O | O |
| Input data (CancellationToken.None) | O | O | O | O | O | O | O | O | O | O | O | O | O | O | O | O |
| Confirm &rarr; Return | O | O |  |  |  |  |  |  |  | O | O | O | O | O | O | O |
| Exception |  |  | O | O | O | O | O | O | O |  |  |  |  |  |  |  |
| Result &rarr; Type (N/A/B) | B | B | B | B | B | B | B | B | B | B | B | B | B | B | B | B |
| Passed / Failed | P | P | P | P | P | P | P | P | P | P | P | P | P | P | P | P |
| Executed Date | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 |
| Defect ID |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |


### 4.2 CreateGoodsReceiptCommandHandler

**Code Module:** `CreateGoodsReceiptCommandHandler`
**Method:** `Handle(CreateGoodsReceiptCommand, CancellationToken)`
**Test requirement:** Verify CreateGoodsReceiptCommandHandler behavior covering active, and, business, create, during, empty, exceeded, exception.

**Created By:** DucHV &nbsp;&nbsp; **Executed By:** DucHV

| Passed | Failed | Untested | N/A/B | Total Test Cases |
|--------|--------|----------|-------|------------------|
| 14 | 0 | 0 | 0 | 14 |

| Condition | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 | UTCID06 | UTCID07 | UTCID08 | UTCID09 | UTCID10 | UTCID11 | UTCID12 | UTCID13 | UTCID14 |
|-----------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|
| Precondition | O | O | O | O | O | O | O | O | O | O | O | O | O | O |
| Input data | O | O | O | O | O | O | O | O | O | O | O | O | O | O |
| Input data (CancellationToken.None) | O | O | O | O | O | O | O | O | O | O | O | O | O | O |
| Confirm &rarr; Return | O | O |  |  |  |  |  | O |  |  | O | O | O | O |
| Exception |  |  | O | O | O | O | O |  | O | O |  |  |  |  |
| Result &rarr; Type (N/A/B) | B | B | B | B | B | B | B | B | B | B | B | B | B | B |
| Passed / Failed | P | P | P | P | P | P | P | P | P | P | P | P | P | P |
| Executed Date | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 |
| Defect ID |  |  |  |  |  |  |  |  |  |  |  |  |  |  |


### 4.3 GetGoodsReceiptDetailQueryHandler

**Code Module:** `GetGoodsReceiptDetailQueryHandler`
**Method:** `Handle(GetGoodsReceiptDetailQuery, CancellationToken)`
**Test requirement:** Verify GetGoodsReceiptDetailQueryHandler behavior covering all, and, attachment, by, correctly, created, creator, deleted.

**Created By:** DucHV &nbsp;&nbsp; **Executed By:** DucHV

| Passed | Failed | Untested | N/A/B | Total Test Cases |
|--------|--------|----------|-------|------------------|
| 6 | 0 | 0 | 0 | 6 |

| Condition | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 | UTCID06 |
|-----------|------|------|------|------|------|------|
| Precondition | O | O | O | O | O | O |
| Input data | O | O | O | O | O | O |
| Input data (CancellationToken.None) | O | O | O | O | O | O |
| Confirm &rarr; Return | O |  | O | O | O | O |
| Exception |  | O |  |  |  |  |
| Result &rarr; Type (N/A/B) | B | B | B | B | B | B |
| Passed / Failed | P | P | P | P | P | P |
| Executed Date | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 |
| Defect ID |  |  |  |  |  |  |


### 4.4 GetGoodsReceiptsQueryHandler

**Code Module:** `GetGoodsReceiptsQueryHandler`
**Method:** `Handle(GetGoodsReceiptsQuery, CancellationToken)`
**Test requirement:** Verify GetGoodsReceiptsQueryHandler behavior covering and, by, combined, correct, correctly, created, deliverer, empty.

**Created By:** DucHV &nbsp;&nbsp; **Executed By:** DucHV

| Passed | Failed | Untested | N/A/B | Total Test Cases |
|--------|--------|----------|-------|------------------|
| 11 | 0 | 0 | 0 | 11 |

| Condition | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 | UTCID06 | UTCID07 | UTCID08 | UTCID09 | UTCID10 | UTCID11 |
|-----------|------|------|------|------|------|------|------|------|------|------|------|
| Precondition | O | O | O | O | O | O | O | O | O | O | O |
| Input data | O | O | O | O | O | O | O | O | O | O | O |
| Input data (CancellationToken.None) | O | O | O | O | O | O | O | O | O | O | O |
| Confirm &rarr; Return | O | O | O | O | O | O | O | O | O | O | O |
| Exception |  |  |  |  |  |  |  |  |  |  |  |
| Result &rarr; Type (N/A/B) | B | B | B | B | B | B | B | B | B | B | B |
| Passed / Failed | P | P | P | P | P | P | P | P | P | P | P |
| Executed Date | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 |
| Defect ID |  |  |  |  |  |  |  |  |  |  |  |


### 4.5 PatchGoodsReceiptMetadataCommandHandler

**Code Module:** `PatchGoodsReceiptMetadataCommandHandler`
**Method:** `Handle(PatchGoodsReceiptMetadataCommand, CancellationToken)`
**Test requirement:** Verify PatchGoodsReceiptMetadataCommandHandler behavior covering active, add, all, and, attachments, based, behave, business.

**Created By:** DucHV &nbsp;&nbsp; **Executed By:** DucHV

| Passed | Failed | Untested | N/A/B | Total Test Cases |
|--------|--------|----------|-------|------------------|
| 10 | 0 | 0 | 0 | 10 |

| Condition | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 | UTCID06 | UTCID07 | UTCID08 | UTCID09 | UTCID10 |
|-----------|------|------|------|------|------|------|------|------|------|------|
| Precondition | O | O | O | O | O | O | O | O | O | O |
| Input data | O | O | O | O | O | O | O | O | O | O |
| Input data (CancellationToken.None) | O | O | O | O | O | O | O | O | O | O |
| Confirm &rarr; Return | O |  |  |  | O | O | O | O |  | O |
| Exception |  | O | O | O |  |  |  |  | O |  |
| Result &rarr; Type (N/A/B) | B | B | B | B | B | B | B | B | B | B |
| Passed / Failed | P | P | P | P | P | P | P | P | P | P |
| Executed Date | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 |
| Defect ID |  |  |  |  |  |  |  |  |  |  |

## 5. Feature: Inventory (2 handlers)


### 5.1 GetCurrentInventoryQueryHandler

**Code Module:** `GetCurrentInventoryQueryHandler`
**Method:** `Handle(GetCurrentInventoryQuery, CancellationToken)`
**Test requirement:** Verify GetCurrentInventoryQueryHandler behavior covering and, average, boq, by, calculate, config, conversion, correctly.

**Created By:** DucHV &nbsp;&nbsp; **Executed By:** DucHV

| Passed | Failed | Untested | N/A/B | Total Test Cases |
|--------|--------|----------|-------|------------------|
| 7 | 0 | 0 | 0 | 7 |

| Condition | UTCID02 | UTCID03 | UTCID04 | UTCID05 | UTCID06 | UTCID07 | UTCID08 |
|-----------|------|------|------|------|------|------|------|
| Precondition | O | O | O | O | O | O | O |
| Input data | O | O | O | O | O | O | O |
| Input data (CancellationToken.None) | O | O | O | O | O | O | O |
| Confirm &rarr; Return | O | O | O | O | O | O | O |
| Exception |  |  |  |  |  |  |  |
| Result &rarr; Type (N/A/B) | B | B | B | B | B | B | B |
| Passed / Failed | P | P | P | P | P | P | P |
| Executed Date | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 |
| Defect ID |  |  |  |  |  |  |  |


### 5.2 GetInventoryTransactionsQueryHandler

**Code Module:** `GetInventoryTransactionsQueryHandler`
**Method:** `Handle(GetInventoryTransactionsQuery, CancellationToken)`
**Test requirement:** Verify GetInventoryTransactionsQueryHandler behavior covering and, by, clamp, code, created, empty, fallback, filter.

**Created By:** DucHV &nbsp;&nbsp; **Executed By:** DucHV

| Passed | Failed | Untested | N/A/B | Total Test Cases |
|--------|--------|----------|-------|------------------|
| 9 | 0 | 0 | 0 | 9 |

| Condition | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 | UTCID06 | UTCID07 | UTCID08 | UTCID09 |
|-----------|------|------|------|------|------|------|------|------|------|
| Precondition | O | O | O | O | O | O | O | O | O |
| Input data | O | O | O | O | O | O | O | O | O |
| Input data (CancellationToken.None) | O | O | O | O | O | O | O | O | O |
| Confirm &rarr; Return | O | O | O | O | O | O | O | O | O |
| Exception |  |  |  |  |  |  |  |  |  |
| Result &rarr; Type (N/A/B) | B | B | B | B | B | B | B | B | B |
| Passed / Failed | P | P | P | P | P | P | P | P | P |
| Executed Date | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 |
| Defect ID |  |  |  |  |  |  |  |  |  |

## 6. Feature: MaterialIssuances (3 handlers)


### 6.1 CreateMaterialIssuanceCommandHandler

**Code Module:** `CreateMaterialIssuanceCommandHandler`
**Method:** `Handle(CreateMaterialIssuanceCommand, CancellationToken)`
**Test requirement:** Verify CreateMaterialIssuanceCommandHandler behavior covering active, and, applied, available, base, based, behave, business.

**Created By:** DucHV &nbsp;&nbsp; **Executed By:** DucHV

| Passed | Failed | Untested | N/A/B | Total Test Cases |
|--------|--------|----------|-------|------------------|
| 14 | 0 | 0 | 0 | 14 |

| Condition | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 | UTCID06 | UTCID07 | UTCID08 | UTCID09 | UTCID11 | UTCID12 | UTCID13 | UTCID14 | UTCID15 |
|-----------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|
| Precondition | O | O | O | O | O | O | O | O | O | O | O | O | O | O |
| Input data | O | O | O | O | O | O | O | O | O | O | O | O | O | O |
| Input data (CancellationToken.None) | O | O | O | O | O | O | O | O | O | O | O | O | O | O |
| Confirm &rarr; Return | O |  |  |  |  |  |  | O | O | O | O | O | O | O |
| Exception |  | O | O | O | O | O | O |  |  |  |  |  |  |  |
| Result &rarr; Type (N/A/B) | B | B | B | B | B | B | B | B | B | B | B | B | B | B |
| Passed / Failed | P | P | P | P | P | P | P | P | P | P | P | P | P | P |
| Executed Date | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 |
| Defect ID |  |  |  |  |  |  |  |  |  |  |  |  |  |  |


### 6.2 GetMaterialIssuanceDetailQueryHandler

**Code Module:** `GetMaterialIssuanceDetailQueryHandler`
**Method:** `Handle(GetMaterialIssuanceDetailQuery, CancellationToken)`
**Test requirement:** Verify GetMaterialIssuanceDetailQueryHandler behavior covering crash, details, empty, exception, found, handle, id, items.

**Created By:** DucHV &nbsp;&nbsp; **Executed By:** DucHV

| Passed | Failed | Untested | N/A/B | Total Test Cases |
|--------|--------|----------|-------|------------------|
| 4 | 0 | 0 | 0 | 4 |

| Condition | UTCID01 | UTCID02 | UTCID03 | UTCID04 |
|-----------|------|------|------|------|
| Precondition | O | O | O | O |
| Input data | O | O | O | O |
| Input data (CancellationToken.None) | O | O | O | O |
| Confirm &rarr; Return | O |  | O | O |
| Exception |  | O |  |  |
| Result &rarr; Type (N/A/B) | B | B | B | B |
| Passed / Failed | P | P | P | P |
| Executed Date | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 |
| Defect ID |  |  |  |  |


### 6.3 GetMaterialIssuancesQueryHandler

**Code Module:** `GetMaterialIssuancesQueryHandler`
**Method:** `Handle(GetMaterialIssuancesQuery, CancellationToken)`
**Test requirement:** Verify GetMaterialIssuancesQueryHandler behavior covering by, combined, correct, created, creator, empty, filter, filtered.

**Created By:** DucHV &nbsp;&nbsp; **Executed By:** DucHV

| Passed | Failed | Untested | N/A/B | Total Test Cases |
|--------|--------|----------|-------|------------------|
| 8 | 0 | 0 | 0 | 8 |

| Condition | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 | UTCID06 | UTCID07 | UTCID08 |
|-----------|------|------|------|------|------|------|------|------|
| Precondition | O | O | O | O | O | O | O | O |
| Input data | O | O | O | O | O | O | O | O |
| Input data (CancellationToken.None) | O | O | O | O | O | O | O | O |
| Confirm &rarr; Return | O | O | O | O | O | O | O | O |
| Exception |  |  |  |  |  |  |  |  |
| Result &rarr; Type (N/A/B) | B | B | B | B | B | B | B | B |
| Passed / Failed | P | P | P | P | P | P | P | P |
| Executed Date | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 |
| Defect ID |  |  |  |  |  |  |  |  |

## 7. Feature: MaterialReturns (3 handlers)


### 7.1 CreateMaterialReturnCommandHandler

**Code Module:** `CreateMaterialReturnCommandHandler`
**Method:** `Handle(CreateMaterialReturnCommand, CancellationToken)`
**Test requirement:** Verify CreateMaterialReturnCommandHandler behavior covering accountant, active, add, admin, and, applied, base, business.

**Created By:** DucHV &nbsp;&nbsp; **Executed By:** DucHV

| Passed | Failed | Untested | N/A/B | Total Test Cases |
|--------|--------|----------|-------|------------------|
| 18 | 0 | 0 | 0 | 18 |

| Condition | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 | UTCID06 | UTCID07 | UTCID08 | UTCID09 | UTCID10 | UTCID11 | UTCID12 | UTCID13 | UTCID14 | UTCID15 | UTCID16 | UTCID17 | UTCID18 |
|-----------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|
| Precondition | O | O | O | O | O | O | O | O | O | O | O | O | O | O | O | O | O | O |
| Input data | O | O | O | O | O | O | O | O | O | O | O | O | O | O | O | O | O | O |
| Input data (CancellationToken.None) | O | O | O | O | O | O | O | O | O | O | O | O | O | O | O | O | O | O |
| Confirm &rarr; Return | O |  |  |  |  |  |  |  | O | O | O | O | O | O |  |  |  |  |
| Exception |  | O | O | O | O | O | O | O |  |  |  |  |  |  | O | O | O | O |
| Result &rarr; Type (N/A/B) | B | B | B | B | B | B | B | B | B | B | B | B | B | B | B | B | B | B |
| Passed / Failed | P | P | P | P | P | P | P | P | P | P | P | P | P | P | P | P | P | P |
| Executed Date | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 |
| Defect ID |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |


### 7.2 GetMaterialReturnDetailQueryHandler

**Code Module:** `GetMaterialReturnDetailQueryHandler`
**Method:** `Handle(GetMaterialReturnDetailQuery, CancellationToken)`
**Test requirement:** Verify GetMaterialReturnDetailQueryHandler behavior covering by, created, creator, details, exception, for, found, gracefully.

**Created By:** DucHV &nbsp;&nbsp; **Executed By:** DucHV

| Passed | Failed | Untested | N/A/B | Total Test Cases |
|--------|--------|----------|-------|------------------|
| 4 | 0 | 0 | 0 | 4 |

| Condition | UTCID01 | UTCID02 | UTCID03 | UTCID04 |
|-----------|------|------|------|------|
| Precondition | O | O | O | O |
| Input data | O | O | O | O |
| Input data (CancellationToken.None) | O | O | O | O |
| Confirm &rarr; Return | O |  | O | O |
| Exception |  | O |  |  |
| Result &rarr; Type (N/A/B) | B | B | B | B |
| Passed / Failed | P | P | P | P |
| Executed Date | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 |
| Defect ID |  |  |  |  |


### 7.3 GetMaterialReturnsQueryHandler

**Code Module:** `GetMaterialReturnsQueryHandler`
**Method:** `Handle(GetMaterialReturnsQuery, CancellationToken)`
**Test requirement:** Verify GetMaterialReturnsQueryHandler behavior covering and, by, combined, created, creator, empty, filter, filtered.

**Created By:** DucHV &nbsp;&nbsp; **Executed By:** DucHV

| Passed | Failed | Untested | N/A/B | Total Test Cases |
|--------|--------|----------|-------|------------------|
| 11 | 0 | 0 | 0 | 11 |

| Condition | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 | UTCID06 | UTCID07 | UTCID08 | UTCID09 | UTCID10 | UTCID11 |
|-----------|------|------|------|------|------|------|------|------|------|------|------|
| Precondition | O | O | O | O | O | O | O | O | O | O | O |
| Input data | O | O | O | O | O | O | O | O | O | O | O |
| Input data (CancellationToken.None) | O | O | O | O | O | O | O | O | O | O | O |
| Confirm &rarr; Return | O | O | O | O | O | O | O | O | O | O | O |
| Exception |  |  |  |  |  |  |  |  |  |  |  |
| Result &rarr; Type (N/A/B) | B | B | B | B | B | B | B | B | B | B | B |
| Passed / Failed | P | P | P | P | P | P | P | P | P | P | P |
| Executed Date | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 |
| Defect ID |  |  |  |  |  |  |  |  |  |  |  |

## 8. Feature: Notifications (2 handlers)


### 8.1 GetMyNotificationsQueryHandler

**Code Module:** `GetMyNotificationsQueryHandler`
**Method:** `Handle(GetMyNotificationsQuery, CancellationToken)`
**Test requirement:** Verify GetMyNotificationsQueryHandler behavior covering and, clamp, empty, exception, exclude, fallback, first, handle.

**Created By:** DucHV &nbsp;&nbsp; **Executed By:** DucHV

| Passed | Failed | Untested | N/A/B | Total Test Cases |
|--------|--------|----------|-------|------------------|
| 7 | 0 | 0 | 0 | 7 |

| Condition | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 | UTCID06 | UTCID07 |
|-----------|------|------|------|------|------|------|------|
| Precondition | O | O | O | O | O | O | O |
| Input data | O | O | O | O | O | O | O |
| Input data (CancellationToken.None) | O | O | O | O | O | O | O |
| Confirm &rarr; Return | O | O | O | O | O |  | O |
| Exception |  |  |  |  |  | O |  |
| Result &rarr; Type (N/A/B) | B | B | B | B | B | B | B |
| Passed / Failed | P | P | P | P | P | P | P |
| Executed Date | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 |
| Defect ID |  |  |  |  |  |  |  |


### 8.2 MarkNotificationAsReadCommandHandler

**Code Module:** `MarkNotificationAsReadCommandHandler`
**Method:** `Handle(MarkNotificationAsReadCommand, CancellationToken)`
**Test requirement:** Verify MarkNotificationAsReadCommandHandler behavior covering action, all, already, and, as, both, do, exception.

**Created By:** DucHV &nbsp;&nbsp; **Executed By:** DucHV

| Passed | Failed | Untested | N/A/B | Total Test Cases |
|--------|--------|----------|-------|------------------|
| 7 | 0 | 0 | 0 | 7 |

| Condition | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 | UTCID06 | UTCID07 |
|-----------|------|------|------|------|------|------|------|
| Precondition | O | O | O | O | O | O | O |
| Input data | O | O | O | O | O | O | O |
| Input data (CancellationToken.None) | O | O | O | O | O | O | O |
| Confirm &rarr; Return | O | O | O | O |  | O | O |
| Exception |  |  |  |  | O |  |  |
| Result &rarr; Type (N/A/B) | B | B | B | B | B | B | B |
| Passed / Failed | P | P | P | P | P | P | P |
| Executed Date | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 |
| Defect ID |  |  |  |  |  |  |  |

## 9. Feature: Suppliers (5 handlers)


### 9.1 CreateSupplierCommandHandler

**Code Module:** `CreateSupplierCommandHandler`
**Method:** `Handle(CreateSupplierCommand, CancellationToken)`
**Test requirement:** Verify CreateSupplierCommandHandler behavior covering active, and, boundary, case, character, collaboration, create, data.

**Created By:** DucHV &nbsp;&nbsp; **Executed By:** DucHV

| Passed | Failed | Untested | N/A/B | Total Test Cases |
|--------|--------|----------|-------|------------------|
| 10 | 0 | 0 | 0 | 10 |

| Condition | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 | UTCID06 | UTCID07 | UTCID08 | UTCID09 | UTCID10 |
|-----------|------|------|------|------|------|------|------|------|------|------|
| Precondition | O | O | O | O | O | O | O | O | O | O |
| Input data | O | O | O | O | O | O | O | O | O | O |
| Input data (CancellationToken.None) | O | O | O | O | O | O | O | O | O | O |
| Confirm &rarr; Return | O |  |  | O | O | O | O | O | O | O |
| Exception |  | O | O |  |  |  |  |  |  |  |
| Result &rarr; Type (N/A/B) | B | B | B | B | B | B | B | B | B | B |
| Passed / Failed | P | P | P | P | P | P | P | P | P | P |
| Executed Date | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 |
| Defect ID |  |  |  |  |  |  |  |  |  |  |


### 9.2 DeleteSupplierCommandHandler

**Code Module:** `DeleteSupplierCommandHandler`
**Method:** `Handle(DeleteSupplierCommand, CancellationToken)`
**Test requirement:** Verify DeleteSupplierCommandHandler behavior covering already, delete, deleted, exception, existing, found, handle, not.

**Created By:** DucHV &nbsp;&nbsp; **Executed By:** DucHV

| Passed | Failed | Untested | N/A/B | Total Test Cases |
|--------|--------|----------|-------|------------------|
| 3 | 0 | 0 | 0 | 3 |

| Condition | UTCID01 | UTCID02 | UTCID03 |
|-----------|------|------|------|
| Precondition | O | O | O |
| Input data | O | O | O |
| Input data (CancellationToken.None) | O | O | O |
| Confirm &rarr; Return | O |  |  |
| Exception |  | O | O |
| Result &rarr; Type (N/A/B) | B | B | B |
| Passed / Failed | P | P | P |
| Executed Date | 19/07/2026 | 19/07/2026 | 19/07/2026 |
| Defect ID |  |  |  |


### 9.3 GetSupplierByIdQueryHandler

**Code Module:** `GetSupplierByIdQueryHandler`
**Method:** `Handle(GetSupplierByIdQuery, CancellationToken)`
**Test requirement:** Verify GetSupplierByIdQueryHandler behavior covering deleted, dto, exception, existing, found, handle, not, return.

**Created By:** DucHV &nbsp;&nbsp; **Executed By:** DucHV

| Passed | Failed | Untested | N/A/B | Total Test Cases |
|--------|--------|----------|-------|------------------|
| 3 | 0 | 0 | 0 | 3 |

| Condition | UTCID01 | UTCID02 | UTCID03 |
|-----------|------|------|------|
| Precondition | O | O | O |
| Input data | O | O | O |
| Input data (CancellationToken.None) | O | O | O |
| Confirm &rarr; Return | O |  |  |
| Exception |  | O | O |
| Result &rarr; Type (N/A/B) | B | B | B |
| Passed / Failed | P | P | P |
| Executed Date | 19/07/2026 | 19/07/2026 | 19/07/2026 |
| Defect ID |  |  |  |


### 9.4 GetSuppliersQueryHandler

**Code Module:** `GetSuppliersQueryHandler`
**Method:** `Handle(GetSuppliersQuery, CancellationToken)`
**Test requirement:** Verify GetSuppliersQueryHandler behavior covering active, all, and, apply, area, ascending, at, by.

**Created By:** DucHV &nbsp;&nbsp; **Executed By:** DucHV

| Passed | Failed | Untested | N/A/B | Total Test Cases |
|--------|--------|----------|-------|------------------|
| 13 | 0 | 0 | 0 | 13 |

| Condition | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 | UTCID06 | UTCID07 | UTCID08 | UTCID09 | UTCID10 | UTCID11 | UTCID12 | UTCID13 |
|-----------|------|------|------|------|------|------|------|------|------|------|------|------|------|
| Precondition | O | O | O | O | O | O | O | O | O | O | O | O | O |
| Input data | O | O | O | O | O | O | O | O | O | O | O | O | O |
| Input data (CancellationToken.None) | O | O | O | O | O | O | O | O | O | O | O | O | O |
| Confirm &rarr; Return | O | O | O | O | O | O | O | O | O | O | O | O | O |
| Exception |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Result &rarr; Type (N/A/B) | B | B | B | B | B | B | B | B | B | B | B | B | B |
| Passed / Failed | P | P | P | P | P | P | P | P | P | P | P | P | P |
| Executed Date | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 |
| Defect ID |  |  |  |  |  |  |  |  |  |  |  |  |  |


### 9.5 UpdateSupplierCommandHandler

**Code Module:** `UpdateSupplierCommandHandler`
**Method:** `Handle(UpdateSupplierCommand, CancellationToken)`
**Test requirement:** Verify UpdateSupplierCommandHandler behavior covering another, as, before, boundary, case, collaboration, data, different.

**Created By:** DucHV &nbsp;&nbsp; **Executed By:** DucHV

| Passed | Failed | Untested | N/A/B | Total Test Cases |
|--------|--------|----------|-------|------------------|
| 10 | 0 | 0 | 0 | 10 |

| Condition | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 | UTCID06 | UTCID07 | UTCID08 | UTCID09 | UTCID10 |
|-----------|------|------|------|------|------|------|------|------|------|------|
| Precondition | O | O | O | O | O | O | O | O | O | O |
| Input data | O | O | O | O | O | O | O | O | O | O |
| Input data (CancellationToken.None) | O | O | O | O | O | O | O | O | O | O |
| Confirm &rarr; Return | O |  |  |  | O | O | O | O | O | O |
| Exception |  | O | O | O |  |  |  |  |  |  |
| Result &rarr; Type (N/A/B) | B | B | B | B | B | B | B | B | B | B |
| Passed / Failed | P | P | P | P | P | P | P | P | P | P |
| Executed Date | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 | 19/07/2026 |
| Defect ID |  |  |  |  |  |  |  |  |  |  |

---

## 10. Summary

| Feature | Handlers | Total Test Cases | Passed | Failed | Untested |
|---------|----------|-----------------|--------|--------|----------|
| Comments | 3 | 23 | 23 | 0 | 0 |
| DailyLogs | 4 | 38 | 38 | 0 | 0 |
| GoodsReceipts | 5 | 57 | 57 | 0 | 0 |
| Inventory | 2 | 16 | 16 | 0 | 0 |
| MaterialIssuances | 3 | 26 | 26 | 0 | 0 |
| MaterialReturns | 3 | 33 | 33 | 0 | 0 |
| Notifications | 2 | 14 | 14 | 0 | 0 |
| Suppliers | 5 | 39 | 39 | 0 | 0 |
| **Total** | 27 | 246 | 246 | 0 | 0 |
