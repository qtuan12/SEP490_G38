# GetDirectPurchaseRequestsQueryHandler.Handle - Unit Test Suite Matrix

Class Name: `GetDirectPurchaseRequestsQueryHandler`  
Function Name: `Handle(GetDirectPurchaseRequestsQuery request, CancellationToken ct)`  
Created By: `qtuan12`  
Executed By: `qtuan12`

Test requirement: Passed `11`, Failed `0`, Untested `0`, N/A/B `9 / 1 / 1`, Total Test Cases `11`

| Condition | Precondition / Input / Output | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 | UTCID06 | UTCID07 | UTCID08 | UTCID09 | UTCID10 | UTCID11 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Condition | Current user is authenticated (UserId 10, role Accountant) | O | O | O | O | O | O | O | O | O | O | O |
|  | Accessible project ids = {100} | O | O | O | O | O | O | O | O | O | O | O |
|  | DP 700 (project 100, WaitingApproval, Audited, WithinBOQ, RequestedBy 10) | O | O | O | O |  | O | O | O | O | O | O |
|  | DP 700 status Draft, RequestedBy = current user (10) |  |  |  |  | O |  |  |  |  |  |  |
|  | DP 701 thuộc project 101 (ngoài quyền) |  |  | O |  |  |  |  |  |  |  |  |
|  | DP 701 status Draft, RequestedBy = người khác (11) |  |  |  | O |  |  |  |  |  |  |  |
|  | DP 701 status Approved |  |  |  |  |  | O |  |  |  |  |  |
|  | DP 701 AuditStatus PendingAudit |  |  |  |  |  |  | O |  |  |  |  |
|  | DP 701 BOQCheckStatus OverBOQ |  |  |  |  |  |  |  | O |  |  |  |
|  | DP 701 RequestedBy = người khác (11) |  |  |  |  |  |  |  |  | O |  |  |
|  | DP 701 Reason = "Mua gấp thép đai cho tổ cốt thép." |  |  |  |  |  |  |  |  |  | O |  |
|  | DP 700 CreatedAt 01/03/2026, DP 701 CreatedAt 05/03/2026 |  |  |  |  |  |  |  |  |  |  | O |
| Input | GetDirectPurchaseRequestsQuery |  |  |  |  |  |  |  |  |  |  |  |
|  | `{ ProjectId = 100 }` | O |  |  | O | O |  |  |  |  |  |  |
|  | `{ ProjectId = 101 }` |  | O |  |  |  |  |  |  |  |  |  |
|  | `{ ProjectId = null }` |  |  | O |  |  |  |  |  |  |  |  |
|  | `{ ProjectId = 100, Status = "Approved" }` |  |  |  |  |  | O |  |  |  |  |  |
|  | `{ ProjectId = 100, AuditStatus = "PendingAudit" }` |  |  |  |  |  |  | O |  |  |  |  |
|  | `{ ProjectId = 100, BOQCheckStatus = "OverBOQ" }` |  |  |  |  |  |  |  | O |  |  |  |
|  | `{ ProjectId = 100, RequestedBy = 11 }` |  |  |  |  |  |  |  |  | O |  |  |
|  | `{ ProjectId = 100, SearchTerm = "thép đai" }` |  |  |  |  |  |  |  |  |  | O |  |
|  | `{ ProjectId = 100, PageNumber = 2, PageSize = 1 }` |  |  |  |  |  |  |  |  |  |  | O |
| Input | CancellationToken.None | O | O | O | O | O | O | O | O | O | O | O |
| Confirm | Return |  |  |  |  |  |  |  |  |  |  |  |
|  | `PagedList<DirectPurchaseRequestDto>`<br>`{`<br>`  TotalCount = 1, PageNumber = 1, TotalPages = 1,`<br>`  Items = [{ DirectPurchaseId = 700, RequestNumber = "DP-000700",`<br>`    ProjectId = 100, ProjectName = "Nhà máy Bắc Ninh", PhaseName = "Phần thô",`<br>`    RequestedBy = 10, RequesterName = "Lê Kỹ Sư",`<br>`    Reason = "Hết xi măng giữa ca đổ sàn, phải mua gấp ngoài.",`<br>`    TotalAmount = 15000000, PurchaseDate = 10/03/2026,`<br>`    Status = "WaitingApproval", AuditStatus = "Audited",`<br>`    BOQCheckStatus = "WithinBOQ", AuditorName = "Phạm Kế Toán", ItemCount = 1 }]`<br>`}` | O |  |  |  |  |  |  |  |  |  |  |
|  | `TotalCount = 1`, `Items` chỉ chứa DP 700 |  |  | O | O |  |  |  |  |  |  |  |
|  | `Items` chỉ chứa DP 700 với `Status = "Draft"` |  |  |  |  | O |  |  |  |  |  |  |
|  | `Items` chỉ chứa DP 701 |  |  |  |  |  | O | O | O | O | O |  |
|  | `{ TotalCount = 2, TotalPages = 2, HasPreviousPage = true, HasNextPage = false, Items = [DP 700] }` |  |  |  |  |  |  |  |  |  |  | O |
| Confirm | Exception |  |  |  |  |  |  |  |  |  |  |  |
|  | Throws `ForbiddenException` — `AUTH_002`: `Bạn không có quyền xem phiếu mua khẩn cấp của dự án này.` |  | O |  |  |  |  |  |  |  |  |  |
| Confirm | Log message |  |  |  |  |  |  |  |  |  |  |  |
| Result | Type(N : Normal, A : Abnormal, B : Boundary) | N | A | N | N | N | N | N | N | N | N | B |
|  | Passed/Failed | P | P | P | P | P | P | P | P | P | P | P |
|  | Executed Date | 08/06 | 08/06 | 08/06 | 08/06 | 08/06 | 08/06 | 08/06 | 08/06 | 08/06 | 08/06 | 08/06 |
|  | Defect ID |  |  |  |  |  |  |  |  |  |  |  |

Note: UTCID04 và UTCID05 phủ rule "phiếu nháp là việc riêng của người soạn" trên danh sách: nháp của người khác bị loại khỏi kết quả, nháp của chính mình vẫn hiện.  
Note: UTCID03 phủ nhánh không truyền `ProjectId` — kết quả bị giới hạn theo danh sách dự án được cấp quyền, nếu thiếu bước này sẽ trả về phiếu của toàn hệ thống.  
Note: UTCID11 là boundary trang cuối (sắp xếp `CreatedAt` giảm dần nên phiếu cũ hơn nằm ở trang 2).
