# ClosePurchaseOrderCommandHandler.Handle - Unit Test Suite Matrix

Class Name: `ClosePurchaseOrderCommandHandler`  
Function Name: `Handle(ClosePurchaseOrderCommand request, CancellationToken cancellationToken)`  
Created By: `qtuan12`  
Executed By: `qtuan12`

Test requirement: Passed `4`, Failed `0`, Untested `0`, N/A/B `1 / 3 / 0`, Total Test Cases `4`

| Condition | Precondition / Input / Output | UTCID01 | UTCID02 | UTCID03 | UTCID04 |
|---|---|---|---|---|---|
| Condition | User is authenticated (Kế toán, UserId 10) | O | O | O | O |
|  | PurchaseOrder 300 exists | O |  | O | O |
|  | PurchaseOrder 300 does NOT exist |  | O |  |  |
|  | PO status is `PartiallyReceived` | O |  |  | O |
|  | PO status is `Sent` / `FullyReceived` / `Closed` / `Cancelled` |  |  | O |  |
| Input | ClosePurchaseOrderCommand |  |  |  |  |
|  | `{`<br>`  POId = 300,`<br>`  Reason = "Nhà cung cấp hết hàng, phần còn lại mua từ đơn khác."`<br>`}` | O | O | O |  |
|  | `{`<br>`  POId = 300,`<br>`  Reason = "" hoặc "   "`<br>`}` |  |  |  | O |
| Input | CancellationToken.None | O | O | O | O |
| Confirm | Return |  |  |  |  |
|  | `true` | O |  |  |  |
| Confirm | Exception |  |  |  |  |
|  | Throws `NotFoundException` — `BIZ_001`: `Không tìm thấy đơn mua hàng cần đóng.` |  | O |  |  |
|  | Throws `BusinessException` — `BIZ_012`: `Chỉ có thể đóng đơn mua hàng đang ở trạng thái nhận một phần.` |  |  | O |  |
|  | Throws `BusinessException` — `BIZ_014`: `Vui lòng nhập lý do đóng đơn mua hàng.` |  |  |  | O |
| Confirm | Log message |  |  |  |  |
| Result | Type(N : Normal, A : Abnormal, B : Boundary) | N | A | A | A |
|  | Passed/Failed | P | P | P | P |
|  | Executed Date | 08/06 | 08/06 | 08/06 | 08/06 |
|  | Defect ID |  |  |  |  |

Note: UTCID03 là `[Theory]` với 4 trạng thái không đóng được, UTCID04 với chuỗi rỗng/khoảng trắng (tổng số case xUnit thực thi của file này là 8).  
Note: Khác với `CancelPurchaseOrderCommandHandler`, handler này kiểm trạng thái TRƯỚC rồi mới kiểm lý do — nên UTCID04 phải dùng PO ở trạng thái `PartiallyReceived`.  
Note: Phần vật tư chưa nhận được giải phóng trở lại yêu cầu vật tư thông qua trạng thái `Closed`; hiệu ứng này được phủ ở `GetApprovedRequestsForPOQueryHandler` và `CreatePurchaseOrderCommandHandler`.
