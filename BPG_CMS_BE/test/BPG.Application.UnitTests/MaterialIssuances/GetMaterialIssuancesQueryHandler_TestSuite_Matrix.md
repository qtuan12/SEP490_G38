# GetMaterialIssuancesQueryHandler.Handle - Unit Test Suite Matrix

Class Name: `GetMaterialIssuancesQueryHandler`  
Function Name: `Handle(GetMaterialIssuancesQuery request, CancellationToken cancellationToken)`  
Created By: `DucHV`  
Executed By: `Not executed`

Test requirement: Passed `0`, Failed `0`, Untested `6`, N/A/B `3 / 0 / 3`, Total Test Cases `6`

| Condition | Precondition / Input / Output | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 | UTCID06 |
|---|---|---|---|---|---|---|---|
| Condition | Material Issuance records exist | O | O | O | O | O |  |
|  | No matching Material Issuance exists |  |  |  |  |  | O |
|  | Project filter is provided | O |  |  |  |  |  |
|  | Search matches task name |  | O |  |  |  |  |
|  | Search matches purpose |  |  | O |  |  |  |
|  | CreatedBy user does NOT exist |  |  |  | O |  |  |
|  | Requested second page contains one record |  |  |  |  | O |  |
| Input | GetMaterialIssuancesQuery |  |  |  |  |  |  |
|  | `{`<br>`  ProjectId = 5,`<br>`  Search = null,`<br>`  SortBy = null,`<br>`  SortDescending = false,`<br>`  PageNumber = 1,`<br>`  PageSize = 10`<br>`}` | O |  |  | O |  |  |
|  | `{`<br>`  ProjectId = 5,`<br>`  Search = "Concrete Slab",`<br>`  SortBy = null,`<br>`  SortDescending = false,`<br>`  PageNumber = 1,`<br>`  PageSize = 10`<br>`}` |  | O |  |  |  |  |
|  | `{`<br>`  ProjectId = 5,`<br>`  Search = "Pouring work",`<br>`  SortBy = null,`<br>`  SortDescending = false,`<br>`  PageNumber = 1,`<br>`  PageSize = 10`<br>`}` |  |  | O |  |  |  |
|  | `{`<br>`  ProjectId = 5,`<br>`  Search = null,`<br>`  SortBy = null,`<br>`  SortDescending = false,`<br>`  PageNumber = 2,`<br>`  PageSize = 1`<br>`}` |  |  |  |  | O |  |
|  | `{`<br>`  ProjectId = 5,`<br>`  Search = "NoMatch",`<br>`  SortBy = null,`<br>`  SortDescending = false,`<br>`  PageNumber = 1,`<br>`  PageSize = 10`<br>`}` |  |  |  |  |  | O |
| Input | CancellationToken.None | O | O | O | O | O | O |
| Confirm | Return |  |  |  |  |  |  |
|  | `{`<br>`  Items = [`<br>`    { MaterialIssuanceId = 79, IssuanceNo = "PXK-079", TaskId = 100, TaskName = "Concrete Slab", Purpose = "Pouring work", TotalItems = 2, CreatedAt = 2026-07-14T08:00:00Z, CreatedByName = "Project Leader" }`<br>`  ],`<br>`  PageNumber = 1,`<br>`  PageSize = 10,`<br>`  TotalCount = 1,`<br>`  TotalPages = 1`<br>`}` | O | O | O |  |  |  |
|  | `{`<br>`  Items = [`<br>`    { MaterialIssuanceId = 80, IssuanceNo = "PXK-080", TaskId = 101, TaskName = "Brickwork", Purpose = "Wall construction", TotalItems = 1, CreatedAt = 2026-07-13T08:00:00Z, CreatedByName = "N/A" }`<br>`  ],`<br>`  PageNumber = 1,`<br>`  PageSize = 10,`<br>`  TotalCount = 1,`<br>`  TotalPages = 1`<br>`}` |  |  |  | O |  |  |
|  | `{`<br>`  Items = [`<br>`    { MaterialIssuanceId = 80, IssuanceNo = "PXK-080", TaskId = 101, TaskName = "Brickwork", Purpose = "Wall construction", TotalItems = 1, CreatedAt = 2026-07-13T08:00:00Z, CreatedByName = "Site Engineer" }`<br>`  ],`<br>`  PageNumber = 2,`<br>`  PageSize = 1,`<br>`  TotalCount = 2,`<br>`  TotalPages = 2`<br>`}` |  |  |  |  | O |  |
|  | `{`<br>`  Items = [],`<br>`  PageNumber = 1,`<br>`  PageSize = 10,`<br>`  TotalCount = 0,`<br>`  TotalPages = 0`<br>`}` |  |  |  |  |  | O |
| Confirm | Exception |  |  |  |  |  |  |
| Confirm | Log message |  |  |  |  |  |  |
| Result | Type(N : Normal, A : Abnormal, B : Boundary) | N | N | N | B | B | B |
|  | Passed/Failed | U | U | U | U | U | U |
|  | Executed Date |  |  |  |  |  |  |
|  | Defect ID |  |  |  |  |  |  |

Note: SortBy and SortDescending are ignored by the handler; output is ordered by CreatedAt descending.
