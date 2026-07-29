# ApproveDecreaseAdjustmentCommandHandler.Handle - Unit Test Suite Matrix

Class Name: `ApproveDecreaseAdjustmentCommandHandler`  
Function Name: `Handle(ApproveDecreaseAdjustmentCommand request, CancellationToken cancellationToken)`  
Created By: `DucHV`  
Executed By: `DucHV`

Test requirement: Passed `5`, Failed `0`, Untested `0`, N/A/B `2 / 3 / 0`, Total Test Cases `5`

| Condition | Precondition / Input / Output | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 |
|---|---|---|---|---|---|---|
| Condition | Adjustment exists in DB |  | O | O | O | O |
|  | Adjustment does NOT exist | O |  |  |  |  |
|  | Adjustment status is Pending | O |  | O | O | O |
|  | Adjustment status is NOT Pending |  | O |  |  |  |
|  | Approve request | O | O |  | O | O |
|  | Reject request |  |  | O |  |  |
|  | Stock is insufficient |  |  |  | O |  |
|  | Stock is sufficient |  |  |  |  | O |
| Input | ApproveDecreaseAdjustmentCommand |  |  |  |  |  |
|  | `{`<br>`  AdjustmentId = 1,`<br>`  IsApproved = true,`<br>`  RejectedReason = null`<br>`}` | O | O |  | O | O |
|  | `{`<br>`  AdjustmentId = 1,`<br>`  IsApproved = false,`<br>`  RejectedReason = "Thông tin hao hụt không rõ ràng"`<br>`}` |  |  | O |  |  |
| Input | CancellationToken.None | O | O | O | O | O |
| Confirm | Return |  |  |  |  |  |
|  | `{`<br>`  Success = true,`<br>`  Data = true,`<br>`  Message = "Đã từ chối phiếu điều chỉnh giảm tồn"`<br>`}` |  |  | O |  |  |
|  | `{`<br>`  Success = true,`<br>`  Data = true,`<br>`  Message = "Phê duyệt phiếu điều chỉnh giảm tồn thành công"`<br>`}` |  |  |  |  | O |
| Confirm | Exception |  |  |  |  |  |
|  | Throws `NotFoundException` — `BIZ_001`: `InventoryAdjustment với ID [1] không tồn tại.` | O |  |  |  |  |
|  | Throws `BusinessException` — `ERR_INVALID_STATUS`: `Phiếu không ở trạng thái chờ duyệt` |  | O |  |  |  |
|  | Throws `BusinessException` — `ERR_INSUFFICIENT_STOCK`: `Không đủ tồn kho cho vật tư ID 20` |  |  |  | O |  |
| Confirm | Log message |  |  |  |  |  |
| Result | Type(N : Normal, A : Abnormal, B : Boundary) | A | A | N | A | N |
|  | Passed/Failed | P | P | P | P | P |
|  | Executed Date | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 |
|  | Defect ID |  |  |  |  |  |
