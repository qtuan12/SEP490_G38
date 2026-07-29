# CreateGoodsReceiptCommandHandler.Handle - Unit Test Suite Matrix

Class Name: `CreateGoodsReceiptCommandHandler`  
Function Name: `Handle(CreateGoodsReceiptCommand request, CancellationToken cancellationToken)`  
Created By: `DucHV`  
Executed By: `DucHV`

Test requirement: Passed `13`, Failed `0`, Untested `0`, N/A/B `3 / 8 / 2`, Total Test Cases `13`

| Condition | Precondition / Input / Output | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 | UTCID06 | UTCID07 | UTCID08 | UTCID09 | UTCID10 | UTCID11 | UTCID12 | UTCID13 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Condition | User is authenticated | O | O | O | O | O | O | O | O | O | O | O | O | O |
|  | Purchase Order exists in DB | O | O | O |  | O | O |  | O | O | O | O | O | O |
|  | Purchase Order does NOT exist |  |  |  | O |  |  |  |  |  |  |  |  |  |
|  | User can manage execution through project.execution.manage (TechnicalManager grant) | O |  | O | O | O | O |  | O | O | O | O | O | O |
|  | User is project leader; membership grants project.execution.manage/project.inventory.manage |  | O |  |  |  |  |  |  |  |  |  |  |  |
|  | Pipeline requires `project.execution.manage` for `PurchaseOrder` resource |  |  |  |  |  |  | O |  |  |  |  |  |  |
|  | Purchase Order has project context | O | O | O | O |  | O | O | O | O | O | O | O | O |
|  | Purchase Order has NO project context |  |  |  |  | O |  |  |  |  |  |  |  |  |
|  | Project status is NOT InProgress |  |  |  |  |  | O |  |  |  |  |  |  |  |
|  | Purchase Order status is invalid |  |  |  |  |  |  |  | O |  |  |  |  |  |
|  | Material is not in Purchase Order |  |  |  |  |  |  |  |  | O |  |  |  |  |
|  | Quantity violates boundary rule |  |  |  |  |  |  |  |  |  | O | O | O | O |
| Input | CreateGoodsReceiptCommand |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  | `{`<br>`  POId = 100,`<br>`  DelivererInfo = "John",`<br>`  DeliveryDocNo = "DOC-123",`<br>`  Items = [{ MaterialId = 50, UnitId = 1, Quantity = 5 }],`<br>`  Images = ["http://file.com/photo.jpg"]`<br>`}` | O |  |  |  |  |  |  |  |  |  |  |  |  |
|  | `{`<br>`  POId = 100,`<br>`  DelivererInfo = "John",`<br>`  DeliveryDocNo = "DOC-123",`<br>`  Items = [{ MaterialId = 50, UnitId = 1, Quantity = 5 }, { MaterialId = 51, UnitId = 1, Quantity = 0 }],`<br>`  Images = null`<br>`}` |  | O |  |  |  |  |  |  |  |  |  |  |  |
|  | `{`<br>`  POId = 100,`<br>`  DelivererInfo = "John",`<br>`  DeliveryDocNo = "DOC-123",`<br>`  Items = [],`<br>`  Images = null`<br>`}` |  |  | O |  |  |  |  |  |  |  |  |  |  |
|  | `{`<br>`  POId = 999,`<br>`  DelivererInfo = "John",`<br>`  DeliveryDocNo = "DOC-123",`<br>`  Items = [{ MaterialId = 50, UnitId = 1, Quantity = 5 }],`<br>`  Images = null`<br>`}` |  |  |  | O |  |  |  |  |  |  |  |  |  |
|  | `{`<br>`  POId = 100,`<br>`  DelivererInfo = "John",`<br>`  DeliveryDocNo = "DOC-123",`<br>`  Items = [{ MaterialId = 50, UnitId = 1, Quantity = 5 }],`<br>`  Images = null`<br>`}` |  |  |  |  | O | O | O | O |  |  |  | O |  |
|  | `{`<br>`  POId = 100,`<br>`  DelivererInfo = "John",`<br>`  DeliveryDocNo = "DOC-123",`<br>`  Items = [{ MaterialId = 99, UnitId = 1, Quantity = 5 }],`<br>`  Images = null`<br>`}` |  |  |  |  |  |  |  |  | O |  |  |  |  |
|  | `{`<br>`  POId = 100,`<br>`  DelivererInfo = "John",`<br>`  DeliveryDocNo = "DOC-123",`<br>`  Items = [{ MaterialId = 50, UnitId = 1, Quantity = -1 }],`<br>`  Images = null`<br>`}` |  |  |  |  |  |  |  |  |  | O |  |  |  |
|  | `{`<br>`  POId = 100,`<br>`  DelivererInfo = "John",`<br>`  DeliveryDocNo = "DOC-123",`<br>`  Items = [{ MaterialId = 50, UnitId = 1, Quantity = 1.5 }],`<br>`  Images = null`<br>`}` |  |  |  |  |  |  |  |  |  |  | O |  |  |
|  | `{`<br>`  POId = 100,`<br>`  DelivererInfo = "John",`<br>`  DeliveryDocNo = "DOC-123",`<br>`  Items = [{ MaterialId = 50, UnitId = 1, Quantity = 0 }],`<br>`  Images = null`<br>`}` |  |  |  |  |  |  |  |  |  |  |  |  | O |
| Input | CancellationToken.None | O | O | O | O | O | O | O | O | O | O | O | O | O |
| Confirm | Return |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  | `{`<br>`  Success = true,`<br>`  Data = 500,`<br>`  Message = "Tạo phiếu nhập kho thành công."`<br>`}` | O | O |  |  |  |  |  |  |  |  |  |  |  |
|  | Command contract: `RequiredPermission = project.execution.manage`, `ProjectResource = PurchaseOrder(100)` |  |  |  |  |  |  | O |  |  |  |  |  |  |
| Confirm | Exception |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  | Throws `BusinessException` — `ERR_EMPTY_ITEMS`: `Danh sách vật tư nhận thực tế không được để trống.` |  |  | O |  |  |  |  |  |  |  |  |  |  |
|  | Throws `NotFoundException` — `BIZ_001`: `PurchaseOrder với ID [999] không tồn tại.` |  |  |  | O |  |  |  |  |  |  |  |  |  |
|  | Throws `BusinessException` — `ERR_PROJECT_NOT_FOUND`: `Không tìm thấy dự án liên kết với đơn mua hàng này.` |  |  |  |  | O |  |  |  |  |  |  |  |  |
|  | Throws `BusinessException` — `ERR_PROJECT_NOT_ACTIVE`: `Dự án không ở trạng thái hoạt động, không thể thực hiện thao tác này.` |  |  |  |  |  | O |  |  |  |  |  |  |  |
|  | Throws `BusinessException` — `ERR_INVALID_PO_STATUS`: `Không thể nhập kho cho đơn hàng có trạng thái: Closed. Chỉ chấp nhận đơn hàng ở trạng thái Đã đặt hàng hoặc Nhận một phần.` |  |  |  |  |  |  |  | O |  |  |  |  |  |
|  | Throws `BusinessException` — `ERR_MATERIAL_NOT_IN_PO`: `Vật tư ID 99 không tồn tại trong đơn hàng này.` |  |  |  |  |  |  |  |  | O |  |  |  |  |
|  | Throws `BusinessException` — `ERR_INVALID_QUANTITY`: `Số lượng nhận của vật tư [Cement] phải lớn hơn hoặc bằng 0.` |  |  |  |  |  |  |  |  |  | O |  |  |  |
|  | Throws `BusinessException` — `BIZ_008`: `Đơn vị tính 'Bag' của vật tư [Cement Bag] yêu cầu số lượng nhận phải là số nguyên.` |  |  |  |  |  |  |  |  |  |  | O |  |  |
|  | Throws `BusinessException` — `ERR_QUANTITY_EXCEEDED`: `Số lượng nhận (5) vượt quá số lượng còn lại cần giao của đơn hàng cho vật tư [Cement] (còn thiếu 4).` |  |  |  |  |  |  |  |  |  |  |  | O |  |
|  | Throws `BusinessException` — `ERR_EMPTY_ITEMS`: `Danh sách vật tư nhận thực tế phải chứa ít nhất một vật tư có số lượng lớn hơn 0.` |  |  |  |  |  |  |  |  |  |  |  |  | O |
| Confirm | Log message |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Result | Type(N : Normal, A : Abnormal, B : Boundary) | N | N | A | A | A | A | N | A | A | A | B | A | B |
|  | Passed/Failed | P | P | P | P | P | P | P | P | P | P | P | P | P |
|  | Executed Date | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 |
|  | Defect ID |  |  |  |  |  |  |  |  |  |  |  |  |  |
