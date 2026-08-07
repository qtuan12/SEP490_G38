# RejectPurchaseOrderCommandHandler.Handle - Unit Test Suite Matrix

Class Name: `RejectPurchaseOrderCommandHandler`  
Function Name: `Handle(RejectPurchaseOrderCommand request, CancellationToken cancellationToken)`  
Created By: `qtuan12`  
Executed By: `qtuan12`

Test requirement: Passed `4`, Failed `0`, Untested `0`, N/A/B `1 / 3 / 0`, Total Test Cases `4`

| Condition | Precondition / Input / Output | UTCID01 | UTCID02 | UTCID03 | UTCID04 |
|---|---|---|---|---|---|
| Condition | User is authenticated (Giám đốc, UserId 10) | O | O | O | O |
|  | PurchaseOrder 300 exists | O | O |  | O |
|  | PurchaseOrder 300 does NOT exist |  |  | O |  |
|  | PO status is `PendingApproval` | O | O |  |  |
|  | PO status is `Sent` / `Rejected` / `PartiallyReceived` |  |  |  | O |
| Input | RejectPurchaseOrderCommand |  |  |  |  |
|  | `{`<br>`  POId = 300,`<br>`  Reason = "Giá cao hơn mặt bằng chung, yêu cầu lấy lại báo giá."`<br>`}` | O |  | O | O |
|  | `{`<br>`  POId = 300,`<br>`  Reason = "" hoặc "   "`<br>`}` |  | O |  |  |
| Input | CancellationToken.None | O | O | O | O |
| Confirm | Return |  |  |  |  |
|  | `true` | O |  |  |  |
| Confirm | Exception |  |  |  |  |
|  | Throws `BusinessException` — `BIZ_042`: `Vui lòng nhập lý do từ chối đơn mua hàng.` |  | O |  |  |
|  | Throws `NotFoundException` — `BIZ_001`: `Không tìm thấy đơn mua hàng cần từ chối.` |  |  | O |  |
|  | Throws `BusinessException` — `BIZ_041`: `Đơn mua hàng đang ở trạng thái '<nhãn tiếng Việt>'. Chỉ từ chối được đơn đang chờ Giám đốc duyệt.` |  |  |  | O |
| Confirm | Log message |  |  |  |  |
| Result | Type(N : Normal, A : Abnormal, B : Boundary) | N | A | A | A |
|  | Passed/Failed | P | P | P | P |
|  | Executed Date | 08/06 | 08/06 | 08/06 | 08/06 |
|  | Defect ID |  |  |  |  |

Note: UTCID02 là `[Theory]` với chuỗi rỗng và chuỗi toàn khoảng trắng; UTCID04 là `[Theory]` với 3 trạng thái không hợp lệ. Mỗi nhóm đi cùng một nhánh code nên giữ một UTCID (tổng số case xUnit thực thi của file này là 7).  
Note: Lý do từ chối được kiểm ngay đầu handler, trước cả bước tải PO — vì vậy UTCID02 vẫn dùng PO hợp lệ.  
Note: Việc trả lại số lượng cho yêu cầu vật tư diễn ra gián tiếp qua trạng thái `Rejected` (xem `GetApprovedRequestsForPOQueryHandler`), không assert state trong test này.
