# ApproveDirectPurchaseByDirectorCommandHandler.Handle - Unit Test Suite Matrix

Class Name: `ApproveDirectPurchaseByDirectorCommandHandler`  
Function Name: `Handle(ApproveDirectPurchaseByDirectorCommand request, CancellationToken ct)`  
Created By: `qtuan12`  
Executed By: `qtuan12`

Test requirement: Passed `5`, Failed `0`, Untested `0`, N/A/B `2 / 3 / 0`, Total Test Cases `5`

| Condition | Precondition / Input / Output | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 |
|---|---|---|---|---|---|---|
| Condition | User is authenticated (Giám đốc, UserId 10) | O | O | O | O | O |
|  | DirectPurchase 700 tồn tại, chưa xóa mềm | O |  |  | O | O |
|  | DirectPurchase 700 does NOT exist |  | O |  |  |  |
|  | DirectPurchase 700 đã bị xóa mềm (IsDeleted = true) |  |  | O |  |  |
|  | Status là WaitingApproval (Kế toán đã soát hóa đơn) | O |  |  |  | O |
|  | Status là Draft / Pending / Approved / Rejected |  |  |  | O |  |
| Input | ApproveDirectPurchaseByDirectorCommand |  |  |  |  |  |
|  | `{`<br>`  DirectPurchaseId = 700,`<br>`  ApprovalNote = "Đồng ý hoàn tiền theo hóa đơn đính kèm."`<br>`}` | O | O | O | O |  |
|  | `{`<br>`  DirectPurchaseId = 700,`<br>`  ApprovalNote = null`<br>`}` |  |  |  |  | O |
| Input | CancellationToken.None | O | O | O | O | O |
| Confirm | Return |  |  |  |  |  |
|  | `true` | O |  |  |  | O |
| Confirm | Exception |  |  |  |  |  |
|  | Throws `NotFoundException` — `BIZ_001`: `Không tìm thấy phiếu mua trực tiếp cần duyệt chi.` |  | O | O |  |  |
|  | Throws `BusinessException` — `BIZ_028`: `Phiếu mua trực tiếp đang ở trạng thái '<nhãn tiếng Việt>'. Chỉ duyệt chi được phiếu đang ở trạng thái 'Chờ Giám đốc'.` |  |  |  | O |  |
| Confirm | Log message |  |  |  |  |  |
| Result | Type(N : Normal, A : Abnormal, B : Boundary) | N | A | A | A | N |
|  | Passed/Failed | P | P | P | P | P |
|  | Executed Date | 08/06 | 08/06 | 08/06 | 08/06 | 08/06 |
|  | Defect ID |  |  |  |  |  |

Note: UTCID04 là `[Theory]` với 4 trạng thái không hợp lệ (tổng số case xUnit thực thi của file này là 8).  
Note: Handler CỐ Ý không kiểm trạng thái dự án — đây là bước quyết toán khoản đã chi, vật tư đã nhập kho từ bước Gửi phiếu; điều kiện "dự án đang thi công" đã chốt ở bước đó.  
Note: Quyết định duyệt chi KHÔNG đụng tồn kho, nên không có điều kiện/tiêu chí nào về tồn kho trong bảng này.  
Note: Phân quyền vai trò Giám đốc kiểm ở tầng controller (`[Authorize]`), không có nhánh permission trong handler.
