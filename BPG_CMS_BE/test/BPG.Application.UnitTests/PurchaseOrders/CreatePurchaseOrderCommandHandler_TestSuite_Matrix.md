# CreatePurchaseOrderCommandHandler.Handle - Unit Test Suite Matrix

Class Name: `CreatePurchaseOrderCommandHandler`  
Function Name: `Handle(CreatePurchaseOrderCommand request, CancellationToken cancellationToken)`  
Created By: `qtuan12`  
Executed By: `qtuan12`

Test requirement: Passed `15`, Failed `0`, Untested `0`, N/A/B `5 / 9 / 1`, Total Test Cases `15`

| Condition | Precondition / Input / Output | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 | UTCID06 | UTCID07 | UTCID08 | UTCID09 | UTCID10 | UTCID11 | UTCID12 | UTCID13 | UTCID14 | UTCID15 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Condition | MaterialRequest 20 exists | O |  | O | O | O | O | O | O | O | O | O | O | O | O | O |
|  | MaterialRequest 20 does NOT exist |  | O |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  | Request status is `Approved` | O |  |  | O | O | O | O | O | O | O | O | O | O | O | O |
|  | Request status is `Pending` |  |  | O |  |  |  |  |  |  |  |  |  |  |  |  |
|  | Request item: MaterialId 50, Quantity 100, base unit `Bao` | O |  |  | O | O | O | O | O | O | O | O | O |  | O | O |
|  | Request item base unit is discrete (`IsDiscrete = true`) |  |  |  |  |  |  |  |  |  |  |  |  | O |  |  |
|  | Project 5 exists, Status = `InProgress` (PlannedStart 01/01/2026) | O |  |  |  |  | O | O | O | O | O | O | O | O | O | O |
|  | Project 5 exists, Status ∈ {`Draft`, `Paused`, `Completed`, `Closed`} |  |  |  |  | O |  |  |  |  |  |  |  |  |  |  |
|  | Project 5 does NOT exist |  |  |  | O |  |  |  |  |  |  |  |  |  |  |  |
|  | Phase 7 EndDate is 31/12/2026 | O |  |  |  | O | O | O | O | O | O | O | O | O | O | O |
|  | No purchase order item is linked to request 20 | O |  |  |  | O | O | O | O |  |  |  |  | O | O | O |
|  | Active PO (`Sent`) already ordered 60 for material 50 |  |  |  |  |  |  |  |  | O | O |  |  |  |  |  |
|  | Only `Cancelled` (60) and `Rejected` (40) POs are linked to request 20 |  |  |  |  |  |  |  |  |  |  | O |  |  |  |  |
|  | `Closed` PO ordered 60 with approved goods receipt of 20 |  |  |  |  |  |  |  |  |  |  |  | O |  |  |  |
|  | PO number `PO-20260310-0001` already exists in DB |  |  |  |  |  |  |  |  |  |  |  |  |  | O |  |
| Input | CreatePurchaseOrderCommand |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  | `{`<br>`  PONumber = null,`<br>`  OrderDate = 10/03/2026,`<br>`  SupplierId = 30,`<br>`  ProjectId = 5,`<br>`  RequestId = 20,`<br>`  Items = [{ MaterialId = 50, UnitId = 1, Quantity = 10, UnitPrice = 1500000 }]`<br>`}` | O | O | O | O | O |  |  |  |  |  |  |  |  |  |  |
|  | `{ ..., OrderDate = 01/01/2027, ExpectedDeliveryDate = 30/01/2027 }` |  |  |  |  |  | O |  |  |  |  |  |  |  |  |  |
|  | `{ ..., ExpectedDeliveryDate = 31/12/2025 }` |  |  |  |  |  |  | O |  |  |  |  |  |  |  |  |
|  | `{ ..., Items = [{ MaterialId = 99, UnitId = 1, Quantity = 5, UnitPrice = 1500000 }] }` |  |  |  |  |  |  |  | O |  |  |  |  |  |  |  |
|  | `{ ..., Items = [{ MaterialId = 50, Quantity = 41 }] }` |  |  |  |  |  |  |  |  | O |  |  |  |  |  |  |
|  | `{ ..., Items = [{ MaterialId = 50, Quantity = 40 }] }` |  |  |  |  |  |  |  |  |  | O |  |  |  |  |  |
|  | `{ ..., Items = [{ MaterialId = 50, Quantity = 100 }] }` |  |  |  |  |  |  |  |  |  |  | O |  |  |  |  |
|  | `{ ..., Items = [{ MaterialId = 50, Quantity = 81 }] }` |  |  |  |  |  |  |  |  |  |  |  | O |  |  |  |
|  | `{ ..., Items = [{ MaterialId = 50, Quantity = 1.5 }] }` |  |  |  |  |  |  |  |  |  |  |  |  | O |  |  |
|  | `{ ..., PONumber = "PO-20260310-0001" }` |  |  |  |  |  |  |  |  |  |  |  |  |  | O |  |
|  | `{ ..., PONumber = "PO-CUSTOM-01" }` |  |  |  |  |  |  |  |  |  |  |  |  |  |  | O |
| Input | CancellationToken.None | O | O | O | O | O | O | O | O | O | O | O | O | O | O | O |
| Confirm | Return |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  | `300` (POId của đơn hàng vừa tạo) | O |  |  |  |  | O | O |  |  | O | O |  |  |  | O |
| Confirm | Exception |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  | Throws `NotFoundException` — `BIZ_001`: `Không tìm thấy yêu cầu vật tư đã chọn.` |  | O |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  | Throws `BusinessException` — `BIZ_016`: `Yêu cầu vật tư chưa được duyệt.` |  |  | O |  |  |  |  |  |  |  |  |  |  |  |  |
|  | Throws `NotFoundException` — `BIZ_001`: `Không tìm thấy dự án của đơn hàng.` |  |  |  | O |  |  |  |  |  |  |  |  |  |  |  |
|  | Throws `BusinessException` — `BIZ_051`: `Dự án 'Nhà máy Bắc Ninh' hiện không ở trạng thái Đang thi công nên không thể tạo đơn mua hàng.` |  |  |  |  | O |  |  |  |  |  |  |  |  |  |  |
|  | Throws `BusinessException` — `BIZ_017`: `Vật tư (MaterialId=99) không thuộc yêu cầu vật tư đã chọn.` |  |  |  |  |  |  |  | O |  |  |  |  |  |  |  |
|  | Throws `BusinessException` — `BIZ_018`: `Vật tư 'Xi măng PCB40' vượt số lượng yêu cầu...` |  |  |  |  |  |  |  |  | O |  |  | O |  |  |  |
|  | Throws `BusinessException` — `BIZ_008`: `Đơn vị tính 'Bao' của vật tư [Xi măng PCB40] yêu cầu số lượng đặt hàng phải là số nguyên.` |  |  |  |  |  |  |  |  |  |  |  |  | O |  |  |
|  | Throws `BusinessException` — `BIZ_015`: `Số đơn hàng 'PO-20260310-0001' đã tồn tại trong hệ thống.` |  |  |  |  |  |  |  |  |  |  |  |  |  | O |  |
| Confirm | Log message |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Result | Type(N : Normal, A : Abnormal, B : Boundary) | N | A | A | A | A | N | N | A | A | B | N | A | A | A | N |
|  | Passed/Failed | P | P | P | P | P | P | P | P | P | P | P | P | P | P | P |
|  | Executed Date | 16/08 | 16/08 | 16/08 | 16/08 | 16/08 | 16/08 | 16/08 | 16/08 | 16/08 | 16/08 | 16/08 | 16/08 | 16/08 | 16/08 | 16/08 |
|  | Defect ID |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |

Note: UTCID05 là `[Theory]` chạy 4 lần với 4 trạng thái dự án không phải `InProgress` (`Draft`, `Paused`, `Completed`, `Closed`) → tổng số test thực thi là 18.  
Note: UTCID06 và UTCID07 xác nhận ngày đơn hàng / hạn giao hàng KHÔNG còn bị ràng buộc theo ngày bắt đầu dự án và ngày kết thúc giai đoạn — chỉ trạng thái dự án mới chặn việc tạo PO (các mã `BIZ_019`–`BIZ_022` đã bị bỏ).  
Note: UTCID10 là boundary "đặt đúng bằng số lượng còn lại của yêu cầu" (đã đặt 60/100, đặt thêm 40); UTCID09 là bước ngay sau boundary (41).  
Note: UTCID12 kiểm tra PO `Closed` chỉ giữ chỗ phần ĐÃ NHẬN (60 đặt / 20 nhận) nên còn được đặt tối đa 80 — đặt 81 thì vượt.  
Note: Các nhánh sinh mã PO qua `sp_getapplock`, ghi PurchaseOrderItem, realtime và notification không đổi giá trị trả về nên không đưa vào phạm vi unit test (xem UNIT_TEST_GUIDE mục 1 và 13).  
Note: Các rule `NotEmpty`, `GreaterThan`, ngày quá khứ, `Items` rỗng thuộc `CreatePurchaseOrderCommandValidator`, không kiểm tra bằng cách gọi trực tiếp `Handle`.
