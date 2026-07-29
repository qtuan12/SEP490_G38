# GetInventoryTransactionsQueryHandler.Handle - Unit Test Suite Matrix

Class Name: `GetInventoryTransactionsQueryHandler`  
Function Name: `Handle(GetInventoryTransactionsQuery request, CancellationToken cancellationToken)`  
Created By: `DucHV`  
Executed By: `Not executed`

Test requirement: Passed `0`, Failed `0`, Untested `8`, N/A/B `5 / 0 / 3`, Total Test Cases `8`

| Condition | Precondition / Input / Output | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 | UTCID06 | UTCID07 | UTCID08 |
|---|---|---|---|---|---|---|---|---|---|
| Condition | Project 5 has Inventory Transactions | O | O | O | O | O | O | O |  |
|  | No matching Inventory Transaction exists |  |  |  |  |  |  |  | O |
|  | MaterialId filter is provided |  | O |  |  |  |  |  |  |
|  | TransactionType filter is provided |  |  | O |  |  |  |  |  |
|  | Search matches material name |  |  |  | O |  |  |  |  |
|  | Search matches material code |  |  |  |  | O |  |  |  |
|  | CreatedBy user does NOT exist |  |  |  |  |  | O |  |  |
|  | Requested second page contains one record |  |  |  |  |  |  | O |  |
| Input | GetInventoryTransactionsQuery |  |  |  |  |  |  |  |  |
|  | `{`<br>`  ProjectId = 5,`<br>`  MaterialId = null,`<br>`  TransactionType = null,`<br>`  Search = null,`<br>`  SortBy = null,`<br>`  SortDescending = false,`<br>`  PageNumber = 1,`<br>`  PageSize = 10`<br>`}` | O |  |  |  |  | O |  |  |
|  | `{`<br>`  ProjectId = 5,`<br>`  MaterialId = 50,`<br>`  TransactionType = null,`<br>`  Search = null,`<br>`  SortBy = null,`<br>`  SortDescending = false,`<br>`  PageNumber = 1,`<br>`  PageSize = 10`<br>`}` |  | O |  |  |  |  |  |  |
|  | `{`<br>`  ProjectId = 5,`<br>`  MaterialId = null,`<br>`  TransactionType = 2,`<br>`  Search = null,`<br>`  SortBy = null,`<br>`  SortDescending = false,`<br>`  PageNumber = 1,`<br>`  PageSize = 10`<br>`}` |  |  | O |  |  |  |  |  |
|  | `{`<br>`  ProjectId = 5,`<br>`  MaterialId = null,`<br>`  TransactionType = null,`<br>`  Search = "Cement",`<br>`  SortBy = null,`<br>`  SortDescending = false,`<br>`  PageNumber = 1,`<br>`  PageSize = 10`<br>`}` |  |  |  | O |  |  |  |  |
|  | `{`<br>`  ProjectId = 5,`<br>`  MaterialId = null,`<br>`  TransactionType = null,`<br>`  Search = "MAT-060",`<br>`  SortBy = null,`<br>`  SortDescending = false,`<br>`  PageNumber = 1,`<br>`  PageSize = 10`<br>`}` |  |  |  |  | O |  |  |  |
|  | `{`<br>`  ProjectId = 5,`<br>`  MaterialId = null,`<br>`  TransactionType = null,`<br>`  Search = null,`<br>`  SortBy = null,`<br>`  SortDescending = false,`<br>`  PageNumber = 2,`<br>`  PageSize = 1`<br>`}` |  |  |  |  |  |  | O |  |
|  | `{`<br>`  ProjectId = 5,`<br>`  MaterialId = null,`<br>`  TransactionType = null,`<br>`  Search = "NoMatch",`<br>`  SortBy = null,`<br>`  SortDescending = false,`<br>`  PageNumber = 1,`<br>`  PageSize = 10`<br>`}` |  |  |  |  |  |  |  | O |
| Input | CancellationToken.None | O | O | O | O | O | O | O | O |
| Confirm | Return |  |  |  |  |  |  |  |  |
|  | `{`<br>`  Items = [`<br>`    { TransactionId = 2, ProjectId = 5, MaterialId = 60, MaterialCode = "MAT-060", MaterialName = "Steel", TransactionType = 2, ReferenceId = 79, QuantityChange = -10, BalanceAfter = 90, UnitName = "Kg", CreatedBy = 11, CreatedByName = "TM User", CreatedAt = 2026-07-14T10:00:00Z },`<br>`    { TransactionId = 1, ProjectId = 5, MaterialId = 50, MaterialCode = "MAT-050", MaterialName = "Cement", TransactionType = 1, ReferenceId = 37, QuantityChange = 100, BalanceAfter = 100, UnitName = "Bag", CreatedBy = 10, CreatedByName = "Admin User", CreatedAt = 2026-07-14T08:00:00Z }`<br>`  ],`<br>`  PageNumber = 1,`<br>`  PageSize = 10,`<br>`  TotalCount = 2,`<br>`  TotalPages = 1`<br>`}` | O |  |  |  |  |  |  |  |
|  | `{`<br>`  Items = [`<br>`    { TransactionId = 1, ProjectId = 5, MaterialId = 50, MaterialCode = "MAT-050", MaterialName = "Cement", TransactionType = 1, ReferenceId = 37, QuantityChange = 100, BalanceAfter = 100, UnitName = "Bag", CreatedBy = 10, CreatedByName = "Admin User", CreatedAt = 2026-07-14T08:00:00Z }`<br>`  ],`<br>`  PageNumber = 1,`<br>`  PageSize = 10,`<br>`  TotalCount = 1,`<br>`  TotalPages = 1`<br>`}` |  | O |  | O |  |  |  |  |
|  | `{`<br>`  Items = [`<br>`    { TransactionId = 2, ProjectId = 5, MaterialId = 60, MaterialCode = "MAT-060", MaterialName = "Steel", TransactionType = 2, ReferenceId = 79, QuantityChange = -10, BalanceAfter = 90, UnitName = "Kg", CreatedBy = 11, CreatedByName = "TM User", CreatedAt = 2026-07-14T10:00:00Z }`<br>`  ],`<br>`  PageNumber = 1,`<br>`  PageSize = 10,`<br>`  TotalCount = 1,`<br>`  TotalPages = 1`<br>`}` |  |  | O |  | O |  |  |  |
|  | `{`<br>`  Items = [`<br>`    { TransactionId = 2, ProjectId = 5, MaterialId = 60, MaterialCode = "MAT-060", MaterialName = "Steel", TransactionType = 2, ReferenceId = 79, QuantityChange = -10, BalanceAfter = 90, UnitName = "Kg", CreatedBy = 999, CreatedByName = "N/A", CreatedAt = 2026-07-14T10:00:00Z }`<br>`  ],`<br>`  PageNumber = 1,`<br>`  PageSize = 10,`<br>`  TotalCount = 1,`<br>`  TotalPages = 1`<br>`}` |  |  |  |  |  | O |  |  |
|  | `{`<br>`  Items = [`<br>`    { TransactionId = 1, ProjectId = 5, MaterialId = 50, MaterialCode = "MAT-050", MaterialName = "Cement", TransactionType = 1, ReferenceId = 37, QuantityChange = 100, BalanceAfter = 100, UnitName = "Bag", CreatedBy = 10, CreatedByName = "Admin User", CreatedAt = 2026-07-14T08:00:00Z }`<br>`  ],`<br>`  PageNumber = 2,`<br>`  PageSize = 1,`<br>`  TotalCount = 2,`<br>`  TotalPages = 2`<br>`}` |  |  |  |  |  |  | O |  |
|  | `{`<br>`  Items = [],`<br>`  PageNumber = 1,`<br>`  PageSize = 10,`<br>`  TotalCount = 0,`<br>`  TotalPages = 0`<br>`}` |  |  |  |  |  |  |  | O |
| Confirm | Exception |  |  |  |  |  |  |  |  |
| Confirm | Log message |  |  |  |  |  |  |  |  |
| Result | Type(N : Normal, A : Abnormal, B : Boundary) | N | N | N | N | N | B | B | B |
|  | Passed/Failed | U | U | U | U | U | U | U | U |
|  | Executed Date |  |  |  |  |  |  |  |  |
|  | Defect ID |  |  |  |  |  |  |  |  |

Note: SortBy and SortDescending are ignored by the handler; output is ordered by CreatedAt descending.
