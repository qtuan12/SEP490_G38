# CreateDirectPurchaseRequestCommandHandler.Handle - Unit Test Suite Matrix

Class Name: `CreateDirectPurchaseRequestCommandHandler`  
Function Name: `Handle(CreateDirectPurchaseRequestCommand request, CancellationToken ct)`  
Created By: `qtuan12`  
Executed By: `qtuan12`

Test requirement: Passed `9`, Failed `0`, Untested `0`, N/A/B `2 / 7 / 0`, Total Test Cases `9`

| Condition | Precondition / Input / Output | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 | UTCID06 | UTCID07 | UTCID08 | UTCID09 |
|---|---|---|---|---|---|---|---|---|---|---|
| Condition | Current user has role TechnicalManager | O |  | O | O |  | O | O | O | O |
|  | Current user is Project Leader of project 100 (không có role TechnicalManager) |  | O |  |  |  |  |  |  |  |
|  | Current user là thành viên dự án nhưng KHÔNG phải Leader và không phải TechnicalManager |  |  |  |  | O |  |  |  |  |
|  | Phase 10 thuộc project 100, status InProgress | O | O |  | O | O | O | O |  | O |
|  | Phase 10 does NOT exist |  |  | O |  |  |  |  |  |  |
|  | Phase 10 status là Approved (đã nghiệm thu, đóng băng) |  |  |  |  |  |  |  | O |  |
|  | Project 100 tồn tại, status InProgress | O | O |  | O | O |  |  | O | O |
|  | Project 100 does NOT exist |  |  |  |  |  | O |  |  |  |
|  | Project 100 status là Draft / Paused / Completed |  |  |  |  |  |  | O |  |  |
|  | ResolveItemsAsync trả về dòng vật tư hợp lệ, EvaluateBoqAsync = false | O | O |  |  |  |  |  |  |  |
| Input | CreateDirectPurchaseRequestCommand |  |  |  |  |  |  |  |  |  |
|  | `{`<br>`  ProjectId = 100,`<br>`  PhaseId = 10,`<br>`  Reason = "Hết xi măng giữa ca đổ sàn, phải mua gấp ngoài.",`<br>`  PurchaseDate = 10/03/2026,`<br>`  Items = [{ MaterialId = 50, UnitId = 1, Quantity = 10, UnitPrice = 1500000 }],`<br>`  InvoicePhotoUrls = ["https://cdn.bpg.vn/invoices/hd-01.jpg"]`<br>`}` | O | O | O |  | O | O | O | O |  |
|  | `{ ..., ProjectId = 999, PhaseId = 10 }` |  |  |  | O |  |  |  |  |  |
|  | `{ ..., Items = [{ MaterialId = 50, Quantity = 5 }, { MaterialId = 50, Quantity = 3 }] }` |  |  |  |  |  |  |  |  | O |
| Input | CancellationToken.None | O | O | O | O | O | O | O | O | O |
| Confirm | Return |  |  |  |  |  |  |  |  |  |
|  | `700` (DirectPurchaseId của phiếu nháp vừa tạo) | O | O |  |  |  |  |  |  |  |
| Confirm | Exception |  |  |  |  |  |  |  |  |  |
|  | Throws `NotFoundException` — `BIZ_001`: `Không tìm thấy giai đoạn đã chọn.` |  |  | O |  |  |  |  |  |  |
|  | Throws `BusinessException` — `BIZ_039`: `Giai đoạn không thuộc dự án đã chọn.` |  |  |  | O |  |  |  |  |  |
|  | Throws `ForbiddenException` — `AUTH_002`: `Chỉ Technical Manager hoặc Trưởng dự án được lập và gửi phiếu mua khẩn cấp của dự án này.` |  |  |  |  | O |  |  |  |  |
|  | Throws `NotFoundException` — `BIZ_001`: `Không tìm thấy dự án của phiếu mua trực tiếp.` |  |  |  |  |  | O |  |  |  |
|  | Throws `BusinessException` — `BIZ_034`: `Dự án '<tên>' đang ở trạng thái '<trạng thái>', không ở trạng thái Đang thi công nên không thể lập hoặc sửa phiếu mua khẩn cấp.` |  |  |  |  |  |  | O |  |  |
|  | Throws `BusinessException` — `BIZ_035`: `"<tên>" đã được nghiệm thu và đóng băng, không thể lập hoặc sửa phiếu mua khẩn cấp.` |  |  |  |  |  |  |  | O |  |
|  | Throws `BusinessException` — `BIZ_040`: `Vật tư ID 50 bị trùng lặp trong phiếu.` |  |  |  |  |  |  |  |  | O |
| Confirm | Log message |  |  |  |  |  |  |  |  |  |
| Result | Type(N : Normal, A : Abnormal, B : Boundary) | N | N | A | A | A | A | A | A | A |
|  | Passed/Failed | P | P | P | P | P | P | P | P | P |
|  | Executed Date | 08/06 | 08/06 | 08/06 | 08/06 | 08/06 | 08/06 | 08/06 | 08/06 | 08/06 |
|  | Defect ID |  |  |  |  |  |  |  |  |  |

Note: UTCID01 và UTCID02 là hai nhánh phân quyền độc lập của `DirectPurchaseGuard.EnsureCanManageAsync` (role TechnicalManager, hoặc `ProjectMember.IsLeader`) nên cần hai success case.  
Note: UTCID07 là `[Theory]` với 3 trạng thái dự án không hợp lệ (tổng số case xUnit thực thi của file này là 11).  
Note: `BOQCheckStatus` được tính từ `EvaluateBoqAsync` nhưng không xuất hiện trong giá trị trả về (chỉ có `DirectPurchaseId`), nên biến thể OverBOQ không tạo ra kết quả quan sát được ở tầng handler — thuộc integration test.  
Note: Việc ghi dòng vật tư, ảnh hóa đơn và commit transaction là side effect, không assert trong unit test (UNIT_TEST_GUIDE mục 1).
