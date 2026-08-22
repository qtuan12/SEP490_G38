# UpdateDirectPurchaseDraftCommandHandler.Handle - Unit Test Suite Matrix

Class Name: `UpdateDirectPurchaseDraftCommandHandler`  
Function Name: `Handle(UpdateDirectPurchaseDraftCommand request, CancellationToken ct)`  
Created By: `qtuan12`  
Executed By: `qtuan12`

Test requirement: Passed `11`, Failed `0`, Untested `0`, N/A/B `1 / 10 / 0`, Total Test Cases `11`

| Condition | Precondition / Input / Output | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 | UTCID06 | UTCID07 | UTCID08 | UTCID09 | UTCID10 | UTCID11 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Condition | Current user has role TechnicalManager (UserId 10) | O | O | O | O | O | O | O |  | O | O | O |
|  | Current user là thành viên dự án nhưng KHÔNG phải Leader và không phải TechnicalManager |  |  |  |  |  |  |  | O |  |  |  |
|  | DirectPurchase 700 tồn tại, chưa xóa mềm | O |  |  | O | O | O | O | O | O | O | O |
|  | DirectPurchase 700 does NOT exist |  | O |  |  |  |  |  |  |  |  |  |
|  | DirectPurchase 700 đã bị xóa mềm (IsDeleted = true) |  |  | O |  |  |  |  |  |  |  |  |
|  | Status là Draft | O |  |  |  | O | O | O | O | O | O | O |
|  | Status là Pending / WaitingApproval / Approved / Rejected |  |  |  | O |  |  |  |  |  |  |  |
|  | RequestedBy = current user (10) | O |  |  |  |  | O | O | O | O | O | O |
|  | RequestedBy = người khác (11) |  |  |  |  | O |  |  |  |  |  |  |
|  | Phase 10 thuộc project 100, status InProgress | O |  |  |  |  |  |  | O | O |  | O |
|  | Phase 10 does NOT exist |  |  |  |  |  | O |  |  |  |  |  |
|  | Phase 10 thuộc project khác (999) |  |  |  |  |  |  | O |  |  |  |  |
|  | Phase 10 status là Approved (đã nghiệm thu, đóng băng) |  |  |  |  |  |  |  |  |  | O |  |
|  | Project 100 status InProgress | O |  |  |  |  |  |  | O |  | O | O |
|  | Project 100 status Paused |  |  |  |  |  |  |  |  | O |  |  |
| Input | UpdateDirectPurchaseDraftCommand |  |  |  |  |  |  |  |  |  |  |  |
|  | `{`<br>`  DirectPurchaseId = 700,`<br>`  PhaseId = 10,`<br>`  Reason = "Bổ sung thêm xi măng cho ca đổ sàn buổi tối.",`<br>`  PurchaseDate = 10/03/2026,`<br>`  Items = [{ MaterialId = 50, UnitId = 1, Quantity = 10, UnitPrice = 1500000 }],`<br>`  InvoicePhotoUrls = ["https://cdn.bpg.vn/invoices/hd-01.jpg"]`<br>`}` | O | O | O | O | O | O | O | O | O | O |  |
|  | `{ ..., Items = [{ MaterialId = 50, Quantity = 5 }, { MaterialId = 50, Quantity = 2 }] }` |  |  |  |  |  |  |  |  |  |  | O |
| Input | CancellationToken.None | O | O | O | O | O | O | O | O | O | O | O |
| Confirm | Return |  |  |  |  |  |  |  |  |  |  |  |
|  | `true` | O |  |  |  |  |  |  |  |  |  |  |
| Confirm | Exception |  |  |  |  |  |  |  |  |  |  |  |
|  | Throws `NotFoundException` — `BIZ_001`: `Không tìm thấy phiếu mua trực tiếp cần sửa.` |  | O | O |  |  |  |  |  |  |  |  |
|  | Throws `BusinessException` — `BIZ_023`: `Chỉ sửa được phiếu ở trạng thái Nháp. Trạng thái hiện tại: <nhãn tiếng Việt>.` |  |  |  | O |  |  |  |  |  |  |  |
|  | Throws `ForbiddenException` — `AUTH_002`: `Chỉ người tạo mới được sửa phiếu nháp này.` |  |  |  |  | O |  |  |  |  |  |  |
|  | Throws `NotFoundException` — `BIZ_001`: `Không tìm thấy giai đoạn đã chọn.` |  |  |  |  |  | O |  |  |  |  |  |
|  | Throws `BusinessException` — `BIZ_039`: `Giai đoạn không thuộc dự án của phiếu.` |  |  |  |  |  |  | O |  |  |  |  |
|  | Throws `ForbiddenException` — `AUTH_002`: `Chỉ Technical Manager hoặc Trưởng dự án được lập và gửi phiếu mua khẩn cấp của dự án này.` |  |  |  |  |  |  |  | O |  |  |  |
|  | Throws `BusinessException` — `BIZ_034`: `Dự án '<tên>' đang ở trạng thái '<trạng thái>', không ở trạng thái Đang thi công...` |  |  |  |  |  |  |  |  | O |  |  |
|  | Throws `BusinessException` — `BIZ_035`: `"<tên>" đã được nghiệm thu và đóng băng...` |  |  |  |  |  |  |  |  |  | O |  |
|  | Throws `BusinessException` — `BIZ_040`: `Vật tư ID 50 bị trùng lặp trong phiếu.` |  |  |  |  |  |  |  |  |  |  | O |
| Confirm | Log message |  |  |  |  |  |  |  |  |  |  |  |
| Result | Type(N : Normal, A : Abnormal, B : Boundary) | N | A | A | A | A | A | A | A | A | A | A |
|  | Passed/Failed | P | P | P | P | P | P | P | P | P | P | P |
|  | Executed Date | 08/06 | 08/06 | 08/06 | 08/06 | 08/06 | 08/06 | 08/06 | 08/06 | 08/06 | 08/06 | 08/06 |
|  | Defect ID |  |  |  |  |  |  |  |  |  |  |  |

Note: UTCID04 là `[Theory]` với 4 trạng thái đã gửi (tổng số case xUnit thực thi của file này là 14).  
Note: UTCID03 tách riêng khỏi UTCID02 vì đi qua điều kiện `!r.IsDeleted` của truy vấn chứ không phải trường hợp không có bản ghi.  
Note: Thứ tự kiểm trong handler là trạng thái → chủ sở hữu → giai đoạn → quyền → trạng thái dự án; các UTCID được dựng đúng theo thứ tự đó để mỗi test chỉ chạm một nhánh.
