# GetPurchaseOrderByIdQueryHandler.Handle - Unit Test Suite Matrix

Class Name: `GetPurchaseOrderByIdQueryHandler`  
Function Name: `Handle(GetPurchaseOrderByIdQuery request, CancellationToken cancellationToken)`  
Created By: `qtuan12`  
Executed By: `qtuan12`

Test requirement: Passed `5`, Failed `0`, Untested `0`, N/A/B `1 / 2 / 2`, Total Test Cases `5`

| Condition | Precondition / Input / Output | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 |
|---|---|---|---|---|---|---|
| Condition | PurchaseOrder 300 thuộc project 5 tồn tại | O |  | O | O | O |
|  | PurchaseOrder 300 does NOT exist |  | O |  |  |  |
|  | Accessible project ids = `{5}` | O | O |  | O | O |
|  | Accessible project ids = `{6}` (không chứa project của PO) |  |  | O |  |  |
|  | PO có nhà cung cấp 30 và yêu cầu vật tư 20 liên kết | O |  | O |  | O |
|  | PO không có nhà cung cấp và không có yêu cầu vật tư liên kết |  |  |  | O |  |
|  | Approved goods receipt của PO 300, material 50, quantity 4 | O |  |  |  |  |
|  | Không có phiếu nhập kho được duyệt |  |  |  | O | O |
| Input | GetPurchaseOrderByIdQuery |  |  |  |  |  |
|  | `{ POId = 300 }` | O | O | O | O | O |
| Input | CancellationToken.None | O | O | O | O | O |
| Confirm | Return |  |  |  |  |  |
|  | `PurchaseOrderDetailDto` `{`<br>`  POId = 300, PONumber = "PO-20260310-0001", Status = "Sent",`<br>`  OrderDate = 10/03/2026, ExpectedDeliveryDate = 20/03/2026,`<br>`  DeliveryAddress = "Công trường Long Biên", TotalAmount = 15000000,`<br>`  ApproverName = "Trần Giám Đốc", ApprovalNote = "Đồng ý theo báo giá.",`<br>`  SupplierId = 30, SupplierName = "Công ty Vật liệu Minh Long",`<br>`  SupplierContactInfo = "0901234567",`<br>`  ProjectId = 5, ProjectName = "Nhà máy Bắc Ninh",`<br>`  Items = [{ MaterialId = 50, MaterialCode = "XM-01", MaterialName = "Xi măng PCB40",`<br>`    Specification = "Bao 50kg", UnitName = "Bao", Quantity = 10,`<br>`    UnitPrice = 1500000, LineTotal = 15000000, TotalReceived = 4 }],`<br>`  LinkedRequests = [{ RequestId = 20, Reason = "Đổ bê tông sàn tầng 2",`<br>`    ProjectId = 5, PhaseId = 7, PhaseName = "Phần thô" }]`<br>`}` | O |  |  |  |  |
|  | `{ SupplierId = null, SupplierName = "", SupplierContactInfo = null, LinkedRequests = [] }` |  |  |  | O |  |
|  | `Items[0].TotalReceived = 0` |  |  |  |  | O |
| Confirm | Exception |  |  |  |  |  |
|  | Throws `NotFoundException` — `BIZ_001`: `Không tìm thấy đơn mua hàng.` |  | O |  |  |  |
|  | Throws `ForbiddenException` — `AUTH_002`: `Bạn không có quyền xem đơn mua hàng của dự án này.` |  |  | O |  |  |
| Confirm | Log message |  |  |  |  |  |
| Result | Type(N : Normal, A : Abnormal, B : Boundary) | N | A | A | B | B |
|  | Passed/Failed | P | P | P | P | P |
|  | Executed Date | 08/06 | 08/06 | 08/06 | 08/06 | 08/06 |
|  | Defect ID |  |  |  |  |  |

Note: Endpoint mở cho ProjectViewers nên UTCID03 phủ nhánh chặn theo dự án — dò `POId` của dự án khác phải bị từ chối.  
Note: UTCID04 và UTCID05 là boundary dữ liệu tùy chọn: PO chưa gắn nhà cung cấp / không liên kết yêu cầu vật tư, và PO chưa có phiếu nhập kho được duyệt.  
Note: Handler có inject `ICurrentUserService` nhưng không sử dụng, nên không có nhánh nào phụ thuộc dependency này.
