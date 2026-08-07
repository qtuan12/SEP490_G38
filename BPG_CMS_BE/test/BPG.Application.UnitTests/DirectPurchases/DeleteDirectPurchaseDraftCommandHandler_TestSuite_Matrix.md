# DeleteDirectPurchaseDraftCommandHandler.Handle - Unit Test Suite Matrix

Class Name: `DeleteDirectPurchaseDraftCommandHandler`  
Function Name: `Handle(DeleteDirectPurchaseDraftCommand request, CancellationToken ct)`  
Created By: `qtuan12`  
Executed By: `qtuan12`

Test requirement: Passed `8`, Failed `0`, Untested `0`, N/A/B `2 / 5 / 1`, Total Test Cases `8`

| Condition | Precondition / Input / Output | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 | UTCID06 | UTCID07 | UTCID08 |
|---|---|---|---|---|---|---|---|---|---|
| Condition | Current user has role TechnicalManager (UserId 10) | O | O | O | O |  |  | O | O |
|  | Current user là thành viên dự án nhưng KHÔNG phải Leader và không phải TechnicalManager |  |  |  |  | O |  |  |  |
|  | Current user là Trưởng dự án của project 100 (không có role TechnicalManager) |  |  |  |  |  | O |  |  |
|  | DirectPurchase 700 tồn tại, chưa xóa mềm | O |  | O | O | O | O | O | O |
|  | DirectPurchase 700 does NOT exist |  | O |  |  |  |  |  |  |
|  | Status là Draft | O |  |  | O | O | O | O | O |
|  | Status là Pending / WaitingApproval / Approved |  |  | O |  |  |  |  |  |
|  | RequestedBy = current user (10) | O |  |  |  | O | O | O | O |
|  | RequestedBy = người khác (11) |  |  |  | O |  |  |  |  |
|  | Phiếu có 1 ảnh hóa đơn chưa xóa | O |  |  |  |  | O | O |  |
|  | Phiếu không có ảnh hóa đơn nào |  |  |  |  |  |  |  | O |
|  | IFileStorageService.DeleteFileAsync trả về true | O |  |  |  |  | O |  |  |
|  | IFileStorageService.DeleteFileAsync ném exception |  |  |  |  |  |  | O |  |
| Input | DeleteDirectPurchaseDraftCommand |  |  |  |  |  |  |  |  |
|  | `{ DirectPurchaseId = 700 }` | O | O | O | O | O | O | O | O |
| Input | CancellationToken.None | O | O | O | O | O | O | O | O |
| Confirm | Return |  |  |  |  |  |  |  |  |
|  | `true` | O |  |  |  |  | O | O | O |
| Confirm | Exception |  |  |  |  |  |  |  |  |
|  | Throws `NotFoundException` — `BIZ_001`: `Không tìm thấy phiếu mua trực tiếp cần xóa.` |  | O |  |  |  |  |  |  |
|  | Throws `BusinessException` — `BIZ_023`: `Chỉ xóa được phiếu ở trạng thái Nháp. Trạng thái hiện tại: <nhãn tiếng Việt>.` |  |  | O |  |  |  |  |  |
|  | Throws `ForbiddenException` — `AUTH_002`: `Chỉ người tạo mới được xóa phiếu nháp này.` |  |  |  | O |  |  |  |  |
|  | Throws `ForbiddenException` — `AUTH_002`: `Chỉ Technical Manager hoặc Trưởng dự án được lập và gửi phiếu mua khẩn cấp của dự án này.` |  |  |  |  | O |  |  |  |
| Confirm | Log message |  |  |  |  |  |  |  |  |
| Result | Type(N : Normal, A : Abnormal, B : Boundary) | N | A | A | A | A | N | A | B |
|  | Passed/Failed | P | P | P | P | P | P | P | P |
|  | Executed Date | 08/06 | 08/06 | 08/06 | 08/06 | 08/06 | 08/06 | 08/06 | 08/06 |
|  | Defect ID |  |  |  |  |  |  |  |  |

Note: UTCID03 là `[Theory]` với 3 trạng thái đã gửi (tổng số case xUnit thực thi của file này là 10).  
Note: UTCID07 phủ đúng thiết kế của handler: xóa file trên storage nằm NGOÀI transaction và lỗi bị nuốt có chủ đích — bản ghi đã đánh dấu xóa nên vẫn trả `true`, cùng lắm là còn file mồ côi.  
Note: Handler CỐ Ý không kiểm trạng thái dự án (khác tạo/sửa nháp), nên không có UTCID cho dự án tạm dừng — chặn ở đây chỉ làm phiếu nháp kẹt lại vĩnh viễn.  
Note: UTCID08 là boundary danh sách ảnh hóa đơn rỗng (vòng lặp xóa file không chạy lần nào).
