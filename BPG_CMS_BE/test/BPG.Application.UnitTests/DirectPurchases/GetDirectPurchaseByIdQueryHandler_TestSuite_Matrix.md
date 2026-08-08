# GetDirectPurchaseByIdQueryHandler.Handle - Unit Test Suite Matrix

Class Name: `GetDirectPurchaseByIdQueryHandler`  
Function Name: `Handle(GetDirectPurchaseByIdQuery request, CancellationToken ct)`  
Created By: `qtuan12`  
Executed By: `qtuan12`

Test requirement: Passed `6`, Failed `0`, Untested `0`, N/A/B `2 / 3 / 1`, Total Test Cases `6`

| Condition | Precondition / Input / Output | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 | UTCID06 |
|---|---|---|---|---|---|---|---|
| Condition | Current user is authenticated (UserId 10, role Accountant) | O | O | O | O | O | O |
|  | DirectPurchase 700 thuộc project 100 tồn tại | O |  | O | O | O | O |
|  | DirectPurchase 700 does NOT exist |  | O |  |  |  |  |
|  | Accessible project ids = {100} | O | O |  | O | O | O |
|  | Accessible project ids = {101} (không chứa project của phiếu) |  |  | O |  |  |  |
|  | Status là WaitingApproval (đã gửi) | O |  | O |  |  | O |
|  | Status là Draft và RequestedBy = người khác (11) |  |  |  | O |  |  |
|  | Status là Draft và RequestedBy = current user (10) |  |  |  |  | O |  |
|  | Phiếu đã sinh PO 300 (PO-20260310-0001) và GR 400 (GR-20260310-0001) | O |  |  |  |  |  |
|  | Phiếu chưa sinh PO/GR (AutoPOId = null, AutoReceiptId = null) |  |  |  |  |  | O |
|  | Có 1 ảnh hóa đơn chưa xóa | O |  |  |  |  |  |
|  | Không có ảnh hóa đơn nào |  |  |  |  |  | O |
| Input | GetDirectPurchaseByIdQuery |  |  |  |  |  |  |
|  | `{ DirectPurchaseId = 700 }` | O | O | O | O | O | O |
| Input | CancellationToken.None | O | O | O | O | O | O |
| Confirm | Return |  |  |  |  |  |  |
|  | `DirectPurchaseDetailDto`<br>`{`<br>`  DirectPurchaseId = 700, RequestNumber = "DP-000700",`<br>`  ProjectId = 100, ProjectName = "Nhà máy Bắc Ninh",`<br>`  PhaseId = 10, PhaseName = "Phần thô",`<br>`  RequestedBy = 10, RequesterName = "Lê Kỹ Sư",`<br>`  Reason = "Hết xi măng giữa ca đổ sàn, phải mua gấp ngoài.",`<br>`  TotalAmount = 15000000, PurchaseDate = 10/03/2026,`<br>`  Status = "WaitingApproval", AuditStatus = "Audited",`<br>`  BOQCheckStatus = "WithinBOQ",`<br>`  AuditNote = "Hóa đơn hợp lệ.", AuditorName = "Phạm Kế Toán",`<br>`  AutoPONumber = "PO-20260310-0001", AutoReceiptNo = "GR-20260310-0001",`<br>`  Items = [{ MaterialId = 50, MaterialCode = "XM-01", MaterialName = "Xi măng PCB40",`<br>`    UnitName = "Bao", Quantity = 10, UnitPrice = 1500000,`<br>`    LineTotal = 15000000, IsOverBOQ = false }],`<br>`  InvoicePhotoUrls = ["https://cdn.bpg.vn/invoices/hd-01.jpg"]`<br>`}` | O |  |  |  |  |  |
|  | `{ DirectPurchaseId = 700, Status = "Draft" }` |  |  |  |  | O |  |
|  | `{ AutoPONumber = null, AutoReceiptNo = null, InvoicePhotoUrls = [] }` |  |  |  |  |  | O |
| Confirm | Exception |  |  |  |  |  |  |
|  | Throws `NotFoundException` — `BIZ_001`: `DirectPurchaseRequest với ID [700] không tồn tại.` |  | O |  |  |  |  |
|  | Throws `ForbiddenException` — `AUTH_002`: `Bạn không có quyền xem phiếu mua khẩn cấp của dự án này.` |  |  | O |  |  |  |
|  | Throws `NotFoundException` — `BIZ_001`: `Không tìm thấy phiếu mua trực tiếp.` |  |  |  | O |  |  |
| Confirm | Log message |  |  |  |  |  |  |
| Result | Type(N : Normal, A : Abnormal, B : Boundary) | N | A | A | A | N | B |
|  | Passed/Failed | P | P | P | P | P | P |
|  | Executed Date | 08/06 | 08/06 | 08/06 | 08/06 | 08/06 | 08/06 |
|  | Defect ID |  |  |  |  |  |  |

Note: UTCID04 và UTCID05 là hai nhánh của cùng một rule "phiếu nháp là việc riêng của người soạn": người khác nhận `NotFoundException` (cố ý không lộ sự tồn tại của phiếu), chính chủ vẫn xem được.  
Note: UTCID03 phủ nhánh chặn theo dự án — endpoint mở cho ProjectViewers nên nếu thiếu bước này thì dò id là đọc được ảnh hóa đơn và đơn giá mua thực tế của mọi dự án.  
Note: UTCID06 là boundary phiếu chưa qua bước Gửi nên chưa sinh PO/GR và chưa có ảnh hóa đơn.
