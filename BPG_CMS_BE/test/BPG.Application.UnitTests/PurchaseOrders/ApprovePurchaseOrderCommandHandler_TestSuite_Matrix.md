# ApprovePurchaseOrderCommandHandler.Handle - Unit Test Suite Matrix

Class Name: `ApprovePurchaseOrderCommandHandler`  
Function Name: `Handle(ApprovePurchaseOrderCommand request, CancellationToken cancellationToken)`  
Created By: `qtuan12`  
Executed By: `qtuan12`

Test requirement: Passed `4`, Failed `0`, Untested `0`, N/A/B `2 / 2 / 0`, Total Test Cases `4`

| Condition | Precondition / Input / Output | UTCID01 | UTCID02 | UTCID03 | UTCID04 |
|---|---|---|---|---|---|
| Condition | User is authenticated (Giám đốc, UserId 10) | O | O | O | O |
|  | PurchaseOrder 300 exists | O |  | O | O |
|  | PurchaseOrder 300 does NOT exist |  | O |  |  |
|  | PO status is `PendingApproval` | O |  |  | O |
|  | PO status is `Draft` / `Sent` / `Rejected` / `Cancelled` |  |  | O |  |
| Input | ApprovePurchaseOrderCommand |  |  |  |  |
|  | `{`<br>`  POId = 300,`<br>`  Note = "Đồng ý mua theo báo giá đã duyệt."`<br>`}` | O | O | O |  |
|  | `{`<br>`  POId = 300,`<br>`  Note = null`<br>`}` |  |  |  | O |
| Input | CancellationToken.None | O | O | O | O |
| Confirm | Return |  |  |  |  |
|  | `true` | O |  |  | O |
| Confirm | Exception |  |  |  |  |
|  | Throws `NotFoundException` — `BIZ_001`: `Không tìm thấy đơn mua hàng cần duyệt.` |  | O |  |  |
|  | Throws `BusinessException` — `BIZ_041`: `Đơn mua hàng đang ở trạng thái '<nhãn tiếng Việt>'. Chỉ duyệt được đơn đang chờ Giám đốc duyệt.` |  |  | O |  |
| Confirm | Log message |  |  |  |  |
| Result | Type(N : Normal, A : Abnormal, B : Boundary) | N | A | A | N |
|  | Passed/Failed | P | P | P | P |
|  | Executed Date | 08/06 | 08/06 | 08/06 | 08/06 |
|  | Defect ID |  |  |  |  |

Note: UTCID03 là `[Theory]` chạy với 4 trạng thái `Draft`, `Sent`, `Rejected`, `Cancelled` — cùng một nhánh code và cùng `ErrorCode`, nên gộp vào một UTCID (tổng số case xUnit thực thi của file này là 7).  
Note: Việc gán `Status = Sent`, `ApprovedBy`, `ApprovedAt`, `ApprovalNote` cùng realtime/notification không thay đổi giá trị trả về nên thuộc phạm vi integration test.  
Note: Phân quyền vai trò Giám đốc được kiểm ở tầng controller (`[Authorize]`), không có nhánh permission trong handler.
