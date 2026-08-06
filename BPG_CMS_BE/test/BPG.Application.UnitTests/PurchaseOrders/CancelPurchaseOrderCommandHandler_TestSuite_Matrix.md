# CancelPurchaseOrderCommandHandler.Handle - Unit Test Suite Matrix

Class Name: `CancelPurchaseOrderCommandHandler`  
Function Name: `Handle(CancelPurchaseOrderCommand request, CancellationToken cancellationToken)`  
Created By: `qtuan12`  
Executed By: `qtuan12`

Test requirement: Passed `8`, Failed `0`, Untested `0`, N/A/B `2 / 6 / 0`, Total Test Cases `8`

| Condition | Precondition / Input / Output | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 | UTCID06 | UTCID07 | UTCID08 |
|---|---|---|---|---|---|---|---|---|---|
| Condition | User is authenticated (Kế toán, UserId 10) | O | O | O | O | O | O | O | O |
|  | PurchaseOrder 300 exists | O | O |  | O | O | O | O | O |
|  | PurchaseOrder 300 does NOT exist |  |  | O |  |  |  |  |  |
|  | PO status is `Draft` / `PendingApproval` / `Sent` | O | O |  |  |  |  | O | O |
|  | PO status is `Cancelled` |  |  |  | O |  |  |  |  |
|  | PO status is `Rejected` |  |  |  |  | O |  |  |  |
|  | PO status is `PartiallyReceived` / `FullyReceived` / `Closed` |  |  |  |  |  | O |  |  |
|  | PO has an `Approved` goods receipt |  |  |  |  |  |  | O |  |
|  | PO has only a `Draft` goods receipt |  |  |  |  |  |  |  | O |
| Input | CancelPurchaseOrderCommand |  |  |  |  |  |  |  |  |
|  | `{`<br>`  POId = 300,`<br>`  Reason = "Nhà cung cấp không đáp ứng được tiến độ giao hàng."`<br>`}` | O |  | O | O | O | O | O | O |
|  | `{`<br>`  POId = 300,`<br>`  Reason = "" hoặc "   "`<br>`}` |  | O |  |  |  |  |  |  |
| Input | CancellationToken.None | O | O | O | O | O | O | O | O |
| Confirm | Return |  |  |  |  |  |  |  |  |
|  | `true` | O |  |  |  |  |  |  | O |
| Confirm | Exception |  |  |  |  |  |  |  |  |
|  | Throws `BusinessException` — `BIZ_013`: `Vui lòng nhập lý do hủy đơn mua hàng.` |  | O |  |  |  |  |  |  |
|  | Throws `NotFoundException` — `BIZ_001`: `Không tìm thấy đơn mua hàng cần hủy.` |  |  | O |  |  |  |  |  |
|  | Throws `BusinessException` — `BIZ_009`: `Đơn mua hàng đã bị hủy trước đó.` |  |  |  | O |  |  |  |  |
|  | Throws `BusinessException` — `BIZ_010`: `Đơn mua hàng đã bị Giám đốc từ chối, không cần hủy nữa.` |  |  |  |  | O |  |  |  |
|  | Throws `BusinessException` — `BIZ_010`: `Không thể hủy đơn mua hàng đã có hàng nhận hoặc đã đóng.` |  |  |  |  |  | O |  |  |
|  | Throws `BusinessException` — `BIZ_011`: `Không thể hủy đơn mua hàng đã có phiếu nhập kho được duyệt.` |  |  |  |  |  |  | O |  |
| Confirm | Log message |  |  |  |  |  |  |  |  |
| Result | Type(N : Normal, A : Abnormal, B : Boundary) | N | A | A | A | A | A | A | N |
|  | Passed/Failed | P | P | P | P | P | P | P | P |
|  | Executed Date | 08/06 | 08/06 | 08/06 | 08/06 | 08/06 | 08/06 | 08/06 | 08/06 |
|  | Defect ID |  |  |  |  |  |  |  |  |

Note: UTCID01 là `[Theory]` với 3 trạng thái hủy được, UTCID02 với chuỗi rỗng/khoảng trắng, UTCID06 với 3 trạng thái đã nhận hoặc đã đóng — mỗi nhóm đi chung một nhánh code (tổng số case xUnit thực thi của file này là 12).  
Note: UTCID05 và UTCID06 cùng ném `BIZ_010` nhưng khác nhánh điều kiện và khác message nên tách thành hai UTCID.  
Note: UTCID08 tách riêng khỏi UTCID01 vì đi qua truy vấn phiếu nhập kho với dữ liệu khác (GR `Draft` không chặn hủy).
