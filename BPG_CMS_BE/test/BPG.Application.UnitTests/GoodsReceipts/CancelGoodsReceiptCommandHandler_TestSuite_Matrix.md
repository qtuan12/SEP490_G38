# CancelGoodsReceiptCommandHandler.Handle - Unit Test Suite Matrix

Class Name: `CancelGoodsReceiptCommandHandler`  
Function Name: `Handle(CancelGoodsReceiptCommand request, CancellationToken cancellationToken)`  
Created By: `DucHV`  
Executed By: `DucHV`

Test requirement: Passed `11`, Failed `0`, Untested `0`, N/A/B `2 / 8 / 1`, Total Test Cases `11`

| Condition | Precondition / Input / Output | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 | UTCID06 | UTCID07 | UTCID08 | UTCID09 | UTCID10 | UTCID11 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Condition | User is authenticated | O |  | O | O | O | O | O | O | O | O | O |
|  | Receipt exists in DB | O |  |  | O | O | O | O | O | O | O | O |
|  | Receipt does NOT exist |  |  | O |  |  |  |  |  |  |  |  |
|  | Handler assumes ProjectAuthorizationBehavior already allowed `project.inventory.manage` | O |  | O | O | O | O | O | O | O | O | O |
|  | Pipeline requires `project.inventory.manage` for `GoodsReceipt` resource |  | O |  |  |  |  |  |  |  |  |  |
|  | Receipt is already cancelled |  |  |  | O |  |  |  |  |  |  |  |
|  | Receipt has no Purchase Order |  |  |  |  | O |  |  |  |  |  |  |
|  | Purchase Order has no project |  |  |  |  |  | O |  |  |  |  |  |
|  | Project status is NOT InProgress |  |  |  |  |  |  | O |  |  |  |  |
|  | Purchase Order is closed |  |  |  |  |  |  |  | O |  |  |  |
|  | Cancel window is exceeded |  |  |  |  |  |  |  |  | O | O |  |
|  | Inventory is insufficient to reverse receipt |  |  |  |  |  |  |  |  |  |  | O |
| Input | CancelGoodsReceiptCommand |  |  |  |  |  |  |  |  |  |  |  |
|  | `{`<br>`  ReceiptId = 500`<br>`}` | O | O |  | O | O | O | O | O | O | O | O |
|  | `{`<br>`  ReceiptId = 999`<br>`}` |  |  | O |  |  |  |  |  |  |  |  |
| Input | CancellationToken.None | O | O | O | O | O | O | O | O | O | O | O |
| Confirm | Return |  |  |  |  |  |  |  |  |  |  |  |
|  | `{`<br>`  Success = true,`<br>`  Data = true,`<br>`  Message = "Hủy phiếu nhập kho thành công."`<br>`}` | O |  |  |  |  |  |  |  |  |  |  |
|  | Command contract: `RequiredPermission = project.inventory.manage`, `ProjectResource = GoodsReceipt(500)` |  | O |  |  |  |  |  |  |  |  |  |
| Confirm | Exception |  |  |  |  |  |  |  |  |  |  |  |
|  | Throws `NotFoundException` — `BIZ_001`: `GoodsReceipt với ID [999] không tồn tại.` |  |  | O |  |  |  |  |  |  |  |  |
|  | Throws `BusinessException` — `ERR_RECEIPT_ALREADY_CANCELLED`: `Phiếu nhập kho này đã được hủy từ trước.` |  |  |  | O |  |  |  |  |  |  |  |
|  | Throws `BusinessException` — `ERR_PO_NOT_FOUND`: `Không tìm thấy đơn mua hàng PO liên kết với phiếu nhập kho này.` |  |  |  |  | O |  |  |  |  |  |  |
|  | Throws `BusinessException` — `ERR_PROJECT_NOT_FOUND`: `Không tìm thấy dự án liên kết với phiếu nhập kho này.` |  |  |  |  |  | O |  |  |  |  |  |
|  | Throws `BusinessException` — `ERR_PROJECT_NOT_ACTIVE`: `Dự án liên kết không còn hoạt động, không thể hủy phiếu nhập kho.` |  |  |  |  |  |  | O |  |  |  |  |
|  | Throws `BusinessException` — `ERR_PO_CLOSED`: `Đơn mua hàng PO liên kết đã đóng, không thể hủy phiếu nhập kho.` |  |  |  |  |  |  |  | O |  |  |  |
|  | Throws `BusinessException` — `ERR_CANCEL_TIME_EXCEEDED`: `Phiếu nhập kho đã được tạo quá 7 ngày (hạn hủy tối đa theo cấu hình hệ thống), không thể thực hiện hủy. Vui lòng lập Phiếu Điều Chỉnh Kho để hiệu chỉnh số liệu.` |  |  |  |  |  |  |  |  | O | O |  |
|  | Throws `BusinessException` — `ERR_INSUFFICIENT_INVENTORY`: `Không thể hủy phiếu nhập kho. Vật tư [Cement] đã được xuất dùng hoặc đóng băng cho kế hoạch thi công (tồn kho khả dụng hiện tại chỉ còn 8, yêu cầu hoàn trả 10). Vui lòng lập Phiếu Điều Chỉnh Kho.` |  |  |  |  |  |  |  |  |  |  | O |
| Confirm | Log message |  |  |  |  |  |  |  |  |  |  |  |
| Result | Type(N : Normal, A : Abnormal, B : Boundary) | N | N | A | A | A | A | A | A | A | B | A |
|  | Passed/Failed | P | P | P | P | P | P | P | P | P | P | P |
|  | Executed Date | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 |
|  | Defect ID |  |  |  |  |  |  |  |  |  |  |  |
