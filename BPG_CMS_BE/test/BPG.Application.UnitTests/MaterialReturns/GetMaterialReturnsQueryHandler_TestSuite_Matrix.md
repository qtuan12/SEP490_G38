# GetMaterialReturnsQueryHandler.Handle - Unit Test Suite Matrix

Class Name: `GetMaterialReturnsQueryHandler`  
Function Name: `Handle(GetMaterialReturnsQuery request, CancellationToken cancellationToken)`  
Created By: `DucHV`  
Executed By: `Not executed`

Test requirement: Passed `0`, Failed `0`, Untested `8`, N/A/B `5 / 0 / 3`, Total Test Cases `8`

| Condition | Precondition / Input / Output | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 | UTCID06 | UTCID07 | UTCID08 |
|---|---|---|---|---|---|---|---|---|---|
| Condition | Material Return records exist | O | O | O | O | O | O | O |  |
|  | No matching Material Return exists |  |  |  |  |  |  |  | O |
|  | IssuanceId filter is provided | O |  |  |  |  |  |  |  |
|  | ProjectId filter is provided without IssuanceId |  | O |  |  |  |  |  |  |
|  | Search matches ReturnNo |  |  | O |  |  |  |  |  |
|  | Search matches reason |  |  |  | O |  |  |  |  |
|  | Search matches original IssuanceNo |  |  |  |  | O |  |  |  |
|  | CreatedBy user does NOT exist |  |  |  |  |  | O |  |  |
|  | Both IssuanceId and ProjectId are provided; IssuanceId takes precedence |  |  |  |  |  |  | O |  |
| Input | GetMaterialReturnsQuery |  |  |  |  |  |  |  |  |
|  | `{`<br>`  ProjectId = null,`<br>`  IssuanceId = 79,`<br>`  Search = null,`<br>`  SortBy = null,`<br>`  SortDescending = false,`<br>`  PageNumber = 1,`<br>`  PageSize = 10`<br>`}` | O |  |  |  |  |  |  |  |
|  | `{`<br>`  ProjectId = 5,`<br>`  IssuanceId = null,`<br>`  Search = null,`<br>`  SortBy = null,`<br>`  SortDescending = false,`<br>`  PageNumber = 1,`<br>`  PageSize = 10`<br>`}` |  | O |  |  |  | O |  |  |
|  | `{`<br>`  ProjectId = 5,`<br>`  IssuanceId = null,`<br>`  Search = "PTRA-081",`<br>`  SortBy = null,`<br>`  SortDescending = false,`<br>`  PageNumber = 1,`<br>`  PageSize = 10`<br>`}` |  |  | O |  |  |  |  |  |
|  | `{`<br>`  ProjectId = 5,`<br>`  IssuanceId = null,`<br>`  Search = "Unused material",`<br>`  SortBy = null,`<br>`  SortDescending = false,`<br>`  PageNumber = 1,`<br>`  PageSize = 10`<br>`}` |  |  |  | O |  |  |  |  |
|  | `{`<br>`  ProjectId = 5,`<br>`  IssuanceId = null,`<br>`  Search = "PXK-079",`<br>`  SortBy = null,`<br>`  SortDescending = false,`<br>`  PageNumber = 1,`<br>`  PageSize = 10`<br>`}` |  |  |  |  | O |  |  |  |
|  | `{`<br>`  ProjectId = 999,`<br>`  IssuanceId = 79,`<br>`  Search = null,`<br>`  SortBy = null,`<br>`  SortDescending = false,`<br>`  PageNumber = 1,`<br>`  PageSize = 10`<br>`}` |  |  |  |  |  |  | O |  |
|  | `{`<br>`  ProjectId = 5,`<br>`  IssuanceId = null,`<br>`  Search = "NoMatch",`<br>`  SortBy = null,`<br>`  SortDescending = false,`<br>`  PageNumber = 1,`<br>`  PageSize = 10`<br>`}` |  |  |  |  |  |  |  | O |
| Input | CancellationToken.None | O | O | O | O | O | O | O | O |
| Confirm | Return |  |  |  |  |  |  |  |  |
|  | `{`<br>`  Items = [`<br>`    {`<br>`      MaterialReturnId = 81,`<br>`      ReturnNo = "PTRA-081",`<br>`      OriginalIssuanceId = 79,`<br>`      OriginalIssuanceNo = "PXK-079",`<br>`      TaskId = 100,`<br>`      TaskName = "Concrete Slab",`<br>`      Reason = "Unused material",`<br>`      TotalItems = 1,`<br>`      CreatedAt = 2026-07-14T12:00:00Z,`<br>`      CreatedByName = "Site Engineer",`<br>`      Items = [{ ReturnItemId = 8101, MaterialId = 50, MaterialCode = "MAT-050", MaterialName = "Cement", UnitId = 1, UnitName = "Bag", Quantity = 5, ConversionRate = 1 }]`<br>`    }`<br>`  ],`<br>`  PageNumber = 1,`<br>`  PageSize = 10,`<br>`  TotalCount = 1,`<br>`  TotalPages = 1`<br>`}` | O | O | O | O | O |  | O |  |
|  | `{`<br>`  Items = [`<br>`    {`<br>`      MaterialReturnId = 82,`<br>`      ReturnNo = "PTRA-082",`<br>`      OriginalIssuanceId = 80,`<br>`      OriginalIssuanceNo = "PXK-080",`<br>`      TaskId = 101,`<br>`      TaskName = "Brickwork",`<br>`      Reason = "Excess bricks",`<br>`      TotalItems = 1,`<br>`      CreatedAt = 2026-07-13T12:00:00Z,`<br>`      CreatedByName = "N/A",`<br>`      Items = [{ ReturnItemId = 8201, MaterialId = 60, MaterialCode = "MAT-060", MaterialName = "Brick", UnitId = 2, UnitName = "Piece", Quantity = 20, ConversionRate = 1 }]`<br>`    }`<br>`  ],`<br>`  PageNumber = 1,`<br>`  PageSize = 10,`<br>`  TotalCount = 1,`<br>`  TotalPages = 1`<br>`}` |  |  |  |  |  | O |  |  |
|  | `{`<br>`  Items = [],`<br>`  PageNumber = 1,`<br>`  PageSize = 10,`<br>`  TotalCount = 0,`<br>`  TotalPages = 0`<br>`}` |  |  |  |  |  |  |  | O |
| Confirm | Exception |  |  |  |  |  |  |  |  |
| Confirm | Log message |  |  |  |  |  |  |  |  |
| Result | Type(N : Normal, A : Abnormal, B : Boundary) | N | N | N | N | N | B | B | B |
|  | Passed/Failed | U | U | U | U | U | U | U | U |
|  | Executed Date |  |  |  |  |  |  |  |  |
|  | Defect ID |  |  |  |  |  |  |  |  |

Note: IssuanceId is evaluated before ProjectId in the handler; providing both filters by issuance only.
Note: SortBy and SortDescending are ignored by the handler; output is ordered by CreatedAt descending.
