# RejectDirectPurchaseByDirectorCommandHandler.Handle - Unit Test Suite Matrix

Class Name: `RejectDirectPurchaseByDirectorCommandHandler`  
Function Name: `Handle(RejectDirectPurchaseByDirectorCommand request, CancellationToken ct)`  
Created By: `qtuan12`  
Executed By: `qtuan12`

Test requirement: Passed `4`, Failed `0`, Untested `0`, N/A/B `1 / 3 / 0`, Total Test Cases `4`

| Condition | Precondition / Input / Output | UTCID01 | UTCID02 | UTCID03 | UTCID04 |
|---|---|---|---|---|---|
| Condition | User is authenticated (Giám đốc, UserId 10) | O | O | O | O |
|  | DirectPurchase 700 tồn tại, chưa xóa mềm | O | O |  | O |
|  | DirectPurchase 700 does NOT exist |  |  | O |  |
|  | Status là WaitingApproval (Kế toán đã soát hóa đơn) | O | O |  |  |
|  | Status là Draft / Pending / Approved / Rejected |  |  |  | O |
| Input | RejectDirectPurchaseByDirectorCommand |  |  |  |  |
|  | `{`<br>`  DirectPurchaseId = 700,`<br>`  Reason = "Hóa đơn không hợp lệ, thiếu chữ ký nhà cung cấp."`<br>`}` | O |  | O | O |
|  | `{`<br>`  DirectPurchaseId = 700,`<br>`  Reason = "" hoặc "   "`<br>`}` |  | O |  |  |
| Input | CancellationToken.None | O | O | O | O |
| Confirm | Return |  |  |  |  |
|  | `true` | O |  |  |  |
| Confirm | Exception |  |  |  |  |
|  | Throws `BusinessException` — `BIZ_027`: `Bắt buộc phải nhập lý do từ chối duyệt chi.` |  | O |  |  |
|  | Throws `NotFoundException` — `BIZ_001`: `Không tìm thấy phiếu mua trực tiếp cần duyệt chi.` |  |  | O |  |
|  | Throws `BusinessException` — `BIZ_028`: `Phiếu mua trực tiếp đang ở trạng thái '<nhãn tiếng Việt>'. Chỉ duyệt chi được phiếu đang ở trạng thái 'Chờ Giám đốc'.` |  |  |  | O |
| Confirm | Log message |  |  |  |  |
| Result | Type(N : Normal, A : Abnormal, B : Boundary) | N | A | A | A |
|  | Passed/Failed | P | P | P | P |
|  | Executed Date | 08/06 | 08/06 | 08/06 | 08/06 |
|  | Defect ID |  |  |  |  |

Note: UTCID02 là `[Theory]` với chuỗi rỗng và chuỗi toàn khoảng trắng; UTCID04 là `[Theory]` với 4 trạng thái không hợp lệ (tổng số case xUnit thực thi của file này là 8).  
Note: Lý do từ chối được kiểm ngay đầu handler, trước cả bước tải phiếu — vì vậy UTCID02 vẫn dùng phiếu hợp lệ ở trạng thái WaitingApproval.  
Note: Từ chối duyệt chi KHÔNG hoàn/hủy tồn kho — vật tư vẫn đã nhập kho và vẫn tiêu thụ định mức BOQ; đây là hệ quả nghiệp vụ được kiểm ở integration test, không quan sát được qua giá trị trả về `bool`.
