# GetGoodsReceiptsQueryHandler.Handle - Unit Test Suite Matrix

Class Name: `GetGoodsReceiptsQueryHandler`  
Function Name: `Handle(GetGoodsReceiptsQuery request, CancellationToken cancellationToken)`  
Created By: `DucHV`  
Executed By: `Not executed`

Test requirement: Passed `0`, Failed `0`, Untested `7`, N/A/B `5 / 0 / 2`, Total Test Cases `7`

| Condition | Precondition / Input / Output | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 | UTCID06 | UTCID07 |
|---|---|---|---|---|---|---|---|---|
| Condition | Goods Receipt records exist | O | O | O | O | O | O |  |
|  | Project matches PurchaseOrder.ProjectId | O |  |  |  |  |  |  |
|  | Project matches PurchaseOrder.Request.Phase.ProjectId |  | O |  |  |  |  |  |
|  | Search matches ReceiptNo |  |  | O |  |  |  |  |
|  | Search matches PONumber |  |  |  | O |  |  |  |
|  | Search matches DelivererInfo |  |  |  |  | O |  |  |
|  | CreatedBy user exists | O | O | O | O | O |  | O |
|  | CreatedBy user does NOT exist |  |  |  |  |  | O |  |
|  | Requested second page contains one record |  |  |  |  |  |  | O |
| Input | GetGoodsReceiptsQuery |  |  |  |  |  |  |  |
|  | `{`<br>`  ProjectId = 5,`<br>`  Search = null,`<br>`  SortBy = null,`<br>`  SortDescending = false,`<br>`  PageNumber = 1,`<br>`  PageSize = 10`<br>`}` | O | O |  |  |  | O |  |
|  | `{`<br>`  ProjectId = 5,`<br>`  Search = "GR-001",`<br>`  SortBy = null,`<br>`  SortDescending = false,`<br>`  PageNumber = 1,`<br>`  PageSize = 10`<br>`}` |  |  | O |  |  |  |  |
|  | `{`<br>`  ProjectId = 5,`<br>`  Search = "PO-001",`<br>`  SortBy = null,`<br>`  SortDescending = false,`<br>`  PageNumber = 1,`<br>`  PageSize = 10`<br>`}` |  |  |  | O |  |  |  |
|  | `{`<br>`  ProjectId = 5,`<br>`  Search = "Nguyen Van A",`<br>`  SortBy = null,`<br>`  SortDescending = false,`<br>`  PageNumber = 1,`<br>`  PageSize = 10`<br>`}` |  |  |  |  | O |  |  |
|  | `{`<br>`  ProjectId = 5,`<br>`  Search = null,`<br>`  SortBy = null,`<br>`  SortDescending = false,`<br>`  PageNumber = 2,`<br>`  PageSize = 1`<br>`}` |  |  |  |  |  |  | O |
| Input | CancellationToken.None | O | O | O | O | O | O | O |
| Confirm | Return |  |  |  |  |  |  |  |
|  | `{`<br>`  Items = [`<br>`    { ReceiptId = 37, ReceiptNo = "GR-001", POId = 70, PONumber = "PO-001", DelivererInfo = "Nguyen Van A", DeliveryDocNo = "DN-001", Status = "Approved", CreatedAt = 2026-07-14T08:00:00Z, CreatedByName = "Project Leader" }`<br>`  ],`<br>`  PageNumber = 1,`<br>`  PageSize = 10,`<br>`  TotalCount = 1,`<br>`  TotalPages = 1`<br>`}` | O | O | O | O | O |  |  |
|  | `{`<br>`  Items = [`<br>`    { ReceiptId = 38, ReceiptNo = "GR-002", POId = 71, PONumber = "PO-002", DelivererInfo = null, DeliveryDocNo = null, Status = "Approved", CreatedAt = 2026-07-13T08:00:00Z, CreatedByName = "N/A" }`<br>`  ],`<br>`  PageNumber = 1,`<br>`  PageSize = 10,`<br>`  TotalCount = 1,`<br>`  TotalPages = 1`<br>`}` |  |  |  |  |  | O |  |
|  | `{`<br>`  Items = [`<br>`    { ReceiptId = 38, ReceiptNo = "GR-002", POId = 71, PONumber = "PO-002", DelivererInfo = null, DeliveryDocNo = null, Status = "Approved", CreatedAt = 2026-07-13T08:00:00Z, CreatedByName = "Accountant" }`<br>`  ],`<br>`  PageNumber = 2,`<br>`  PageSize = 1,`<br>`  TotalCount = 2,`<br>`  TotalPages = 2`<br>`}` |  |  |  |  |  |  | O |
| Confirm | Exception |  |  |  |  |  |  |  |
| Confirm | Log message |  |  |  |  |  |  |  |
| Result | Type(N : Normal, A : Abnormal, B : Boundary) | N | N | N | N | N | B | B |
|  | Passed/Failed | U | U | U | U | U | U | U |
|  | Executed Date |  |  |  |  |  |  |  |
|  | Defect ID |  |  |  |  |  |  |  |

Note: SortBy and SortDescending are inherited but ignored by this handler; output is always ordered by CreatedAt descending.
