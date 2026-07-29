# PatchGoodsReceiptMetadataCommandHandler.Handle - Unit Test Suite Matrix

Class Name: `PatchGoodsReceiptMetadataCommandHandler`  
Function Name: `Handle(PatchGoodsReceiptMetadataCommand request, CancellationToken cancellationToken)`  
Created By: `DucHV`  
Executed By: `DucHV`

Test requirement: Passed `6`, Failed `0`, Untested `0`, N/A/B `3 / 3 / 0`, Total Test Cases `6`

| Condition | Precondition / Input / Output | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 | UTCID06 |
|---|---|---|---|---|---|---|---|
| Condition | User is authenticated | O | O | O | O |  | O |
|  | Receipt exists in DB | O | O |  | O |  | O |
|  | Receipt does NOT exist |  |  | O |  |  |  |
|  | Receipt has project context | O | O | O |  |  | O |
|  | Receipt has NO project context |  |  |  | O |  |  |
|  | Project status is NOT InProgress |  |  |  |  |  | O |
| Input | PatchGoodsReceiptMetadataCommand |  |  |  |  |  |  |
|  | `{`<br>`  ReceiptId = 500,`<br>`  DelivererInfo = "New Deliverer",`<br>`  DeliveryDocNo = "DOC-999",`<br>`  Images = ["http://file.com/new_photo.jpg"]`<br>`}` | O |  |  | O |  | O |
|  | `{`<br>`  ReceiptId = 500,`<br>`  DelivererInfo = null,`<br>`  DeliveryDocNo = "",`<br>`  Images = []`<br>`}` |  | O |  |  |  |  |
|  | `{`<br>`  ReceiptId = 999,`<br>`  DelivererInfo = "New Deliverer",`<br>`  DeliveryDocNo = "DOC-999",`<br>`  Images = ["http://file.com/new_photo.jpg"]`<br>`}` |  |  | O |  |  |  |
| Input | CancellationToken.None | O | O | O | O | O | O |
| Confirm | Return |  |  |  |  |  |  |
|  | `{`<br>`  Success = true,`<br>`  Data = true,`<br>`  Message = "Cập nhật thông tin phiếu nhập kho thành công."`<br>`}` | O |  |  |  |  |  |
|  | `{`<br>`  Success = true,`<br>`  Data = true`<br>`}` |  | O |  |  |  |  |
| Confirm | Exception |  |  |  |  |  |  |
|  | Throws `NotFoundException` — `BIZ_001`: `GoodsReceipt với ID [999] không tồn tại.` |  |  | O |  |  |  |
|  | Throws `BusinessException` — `ERR_PROJECT_NOT_FOUND`: `Không tìm thấy dự án liên kết với phiếu nhập kho này.` |  |  |  | O |  |  |
|  | Throws `BusinessException` — `ERR_PROJECT_NOT_ACTIVE`: `Dự án liên kết không còn hoạt động, không thể chỉnh sửa thông tin.` |  |  |  |  |  | O |
| Confirm | Log message |  |  |  |  |  |  |
| Result | Type(N : Normal, A : Abnormal, B : Boundary) | N | N | A | A | N | A |
|  | Passed/Failed | P | P | P | P | P | P |
|  | Executed Date | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 |
|  | Defect ID |  |  |  |  |  |  |
