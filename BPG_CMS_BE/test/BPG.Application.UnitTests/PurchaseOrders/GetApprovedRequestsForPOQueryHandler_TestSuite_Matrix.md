# GetApprovedRequestsForPOQueryHandler.Handle - Unit Test Suite Matrix

Class Name: `GetApprovedRequestsForPOQueryHandler`  
Function Name: `Handle(GetApprovedRequestsForPOQuery request, CancellationToken cancellationToken)`  
Created By: `qtuan12`  
Executed By: `qtuan12`

Test requirement: Passed `7`, Failed `0`, Untested `0`, N/A/B `5 / 0 / 2`, Total Test Cases `7`

| Condition | Precondition / Input / Output | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 | UTCID06 | UTCID07 |
|---|---|---|---|---|---|---|---|---|
| Condition | MaterialRequest 20 (`Approved`, phase 7 thuộc project 5, item material 50 x 100) | O | O | O | O | O |  | O |
|  | MaterialRequest 21 thuộc project 5 nhưng status `Pending` |  |  |  |  |  | O |  |
|  | MaterialRequest 22 status `Approved` nhưng thuộc project 6 |  |  |  |  |  | O |  |
|  | Base unit của vật tư là rời rạc (`IsDiscrete = true`) |  |  |  |  |  |  | O |
|  | Không có purchase order item nào gắn với yêu cầu | O |  |  |  |  | O | O |
|  | PO 200 (`Sent`) đã đặt 60 |  | O |  |  |  |  |  |
|  | PO 200 (`Cancelled`) 60 và PO 201 (`Rejected`) 40 |  |  | O |  |  |  |  |
|  | PO 200 (`Closed`) đặt 60, phiếu nhập kho được duyệt 20 |  |  |  | O |  |  |  |
|  | PO 200 (`Sent`) đã đặt 110 (vượt số lượng yêu cầu) |  |  |  |  | O |  |  |
| Input | GetApprovedRequestsForPOQuery |  |  |  |  |  |  |  |
|  | `{ ProjectId = 5 }` | O | O | O | O | O | O | O |
| Input | CancellationToken.None | O | O | O | O | O | O | O |
| Confirm | Return |  |  |  |  |  |  |  |
|  | `[{`<br>`  RequestId = 20, Reason = "Đổ bê tông sàn tầng 2",`<br>`  ProjectId = 5, ProjectName = "Nhà máy Bắc Ninh",`<br>`  PhaseId = 7, PhaseName = "Phần thô", HasPO = false,`<br>`  Items = [{ MaterialId = 50, MaterialCode = "XM-01", MaterialName = "Xi măng PCB40",`<br>`    UnitName = "Bao", Quantity = 100, OrderedQuantity = 0,`<br>`    RemainingQuantity = 100, IsDiscreteUnit = false, BaseUnitName = "Bao" }]`<br>`}]` | O |  |  |  |  |  |  |
|  | `HasPO = true`, `OrderedQuantity = 60`, `RemainingQuantity = 40` |  | O |  |  |  |  |  |
|  | `HasPO = false`, `OrderedQuantity = 0`, `RemainingQuantity = 100` |  |  | O |  |  |  |  |
|  | `OrderedQuantity = 20`, `RemainingQuantity = 80` |  |  |  | O |  |  |  |
|  | `OrderedQuantity = 110`, `RemainingQuantity = 0` |  |  |  |  | O |  |  |
|  | `[]` (danh sách rỗng) |  |  |  |  |  | O |  |
|  | `Items[0].IsDiscreteUnit = true` |  |  |  |  |  |  | O |
| Confirm | Exception |  |  |  |  |  |  |  |
| Confirm | Log message |  |  |  |  |  |  |  |
| Result | Type(N : Normal, A : Abnormal, B : Boundary) | N | N | N | N | B | B | N |
|  | Passed/Failed | P | P | P | P | P | P | P |
|  | Executed Date | 08/06 | 08/06 | 08/06 | 08/06 | 08/06 | 08/06 | 08/06 |
|  | Defect ID |  |  |  |  |  |  |  |

Note: Handler không có nhánh exception nào — mọi kết quả quan sát được đều là nội dung của `List<ApprovedRequestForPODto>`.  
Note: UTCID03 và UTCID04 phủ đúng quy tắc giữ chỗ số lượng: PO `Cancelled`/`Rejected` không giữ chỗ, PO `Closed` chỉ giữ phần đã nhận thực tế.  
Note: UTCID05 là boundary clamp `RemainingQuantity` về 0 khi đã đặt vượt; UTCID06 là boundary danh sách rỗng khi không có yêu cầu nào vừa `Approved` vừa thuộc dự án.
