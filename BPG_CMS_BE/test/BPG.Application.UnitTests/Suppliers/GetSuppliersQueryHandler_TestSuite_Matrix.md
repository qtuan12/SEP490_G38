# GetSuppliersQueryHandler.Handle - Unit Test Suite Matrix

Class Name: `GetSuppliersQueryHandler`  
Function Name: `Handle(GetSuppliersQuery request, CancellationToken cancellationToken)`  
Created By: `DucHV`  
Executed By: `Not executed`

Test requirement: Passed `0`, Failed `0`, Untested `10`, N/A/B `8 / 0 / 2`, Total Test Cases `10`

| Condition | Precondition / Input / Output | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 | UTCID06 | UTCID07 | UTCID08 | UTCID09 | UTCID10 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Condition | Supplier records exist | O | O | O | O | O | O | O | O | O |  |
|  | No matching supplier exists |  |  |  |  |  |  |  |  |  | O |
|  | Collaboration status filter is provided |  | O |  |  |  |  |  |  |  |  |
|  | Search matches SupplierName |  |  | O |  |  |  |  |  |  |  |
|  | Search matches ContactInfo |  |  |  | O |  |  |  |  |  |  |
|  | Search matches ServiceArea |  |  |  |  | O |  |  |  |  |  |
|  | SortBy is supplier name |  |  |  |  |  | O |  |  |  |  |
|  | SortBy is rating |  |  |  |  |  |  | O |  |  |  |
|  | SortBy is collaboration status |  |  |  |  |  |  |  | O |  |  |
|  | SortBy is unsupported and falls back to CreatedAt descending |  |  |  |  |  |  |  |  | O |  |
|  | Requested page has no records |  |  |  |  |  |  |  |  |  | O |
| Input | GetSuppliersQuery |  |  |  |  |  |  |  |  |  |  |
|  | `{`<br>`  CollaborationStatus = null,`<br>`  Search = null,`<br>`  SortBy = null,`<br>`  SortDescending = false,`<br>`  PageNumber = 1,`<br>`  PageSize = 10`<br>`}` | O |  |  |  |  |  |  |  |  |  |
|  | `{`<br>`  CollaborationStatus = "Active",`<br>`  Search = null,`<br>`  SortBy = null,`<br>`  SortDescending = false,`<br>`  PageNumber = 1,`<br>`  PageSize = 10`<br>`}` |  | O |  |  |  |  |  |  |  |  |
|  | `{`<br>`  CollaborationStatus = null,`<br>`  Search = "An Phat",`<br>`  SortBy = null,`<br>`  SortDescending = false,`<br>`  PageNumber = 1,`<br>`  PageSize = 10`<br>`}` |  |  | O |  |  |  |  |  |  |  |
|  | `{`<br>`  CollaborationStatus = null,`<br>`  Search = "0901234567",`<br>`  SortBy = null,`<br>`  SortDescending = false,`<br>`  PageNumber = 1,`<br>`  PageSize = 10`<br>`}` |  |  |  | O |  |  |  |  |  |  |
|  | `{`<br>`  CollaborationStatus = null,`<br>`  Search = "Ho Chi Minh",`<br>`  SortBy = null,`<br>`  SortDescending = false,`<br>`  PageNumber = 1,`<br>`  PageSize = 10`<br>`}` |  |  |  |  | O |  |  |  |  |  |
|  | `{`<br>`  CollaborationStatus = null,`<br>`  Search = null,`<br>`  SortBy = "supplierName",`<br>`  SortDescending = false,`<br>`  PageNumber = 1,`<br>`  PageSize = 10`<br>`}` |  |  |  |  |  | O |  |  |  |  |
|  | `{`<br>`  CollaborationStatus = null,`<br>`  Search = null,`<br>`  SortBy = "rating",`<br>`  SortDescending = true,`<br>`  PageNumber = 1,`<br>`  PageSize = 10`<br>`}` |  |  |  |  |  |  | O |  |  |  |
|  | `{`<br>`  CollaborationStatus = null,`<br>`  Search = null,`<br>`  SortBy = "status",`<br>`  SortDescending = false,`<br>`  PageNumber = 1,`<br>`  PageSize = 10`<br>`}` |  |  |  |  |  |  |  | O |  |  |
|  | `{`<br>`  CollaborationStatus = null,`<br>`  Search = null,`<br>`  SortBy = "unknown",`<br>`  SortDescending = false,`<br>`  PageNumber = 1,`<br>`  PageSize = 10`<br>`}` |  |  |  |  |  |  |  |  | O |  |
|  | `{`<br>`  CollaborationStatus = null,`<br>`  Search = null,`<br>`  SortBy = null,`<br>`  SortDescending = false,`<br>`  PageNumber = 2,`<br>`  PageSize = 10`<br>`}` |  |  |  |  |  |  |  |  |  | O |
| Input | CancellationToken.None | O | O | O | O | O | O | O | O | O | O |
| Confirm | Return |  |  |  |  |  |  |  |  |  |  |
|  | `{`<br>`  Items = [`<br>`    { SupplierId = 2, SupplierName = "Minh Long", ContactInfo = "0912345678", Address = "Da Nang", ServiceArea = "Central", Rating = 4.8, EvaluationNote = "Reliable", CollaborationStatus = "Inactive" },`<br>`    { SupplierId = 1, SupplierName = "An Phat", ContactInfo = "0901234567", Address = "Ho Chi Minh City", ServiceArea = "Ho Chi Minh", Rating = 4.5, EvaluationNote = "Good quality", CollaborationStatus = "Active" }`<br>`  ],`<br>`  PageNumber = 1,`<br>`  PageSize = 10,`<br>`  TotalCount = 2,`<br>`  TotalPages = 1`<br>`}` | O |  |  |  |  |  |  |  |  |  |
|  | `{`<br>`  Items = [`<br>`    { SupplierId = 1, SupplierName = "An Phat", ContactInfo = "0901234567", Address = "Ho Chi Minh City", ServiceArea = "Ho Chi Minh", Rating = 4.5, EvaluationNote = "Good quality", CollaborationStatus = "Active" }`<br>`  ],`<br>`  PageNumber = 1,`<br>`  PageSize = 10,`<br>`  TotalCount = 1,`<br>`  TotalPages = 1`<br>`}` |  | O | O | O | O |  |  |  |  |  |
|  | `{`<br>`  Items = [`<br>`    { SupplierId = 1, SupplierName = "An Phat", CollaborationStatus = "Active" },`<br>`    { SupplierId = 2, SupplierName = "Minh Long", CollaborationStatus = "Inactive" }`<br>`  ],`<br>`  PageNumber = 1,`<br>`  PageSize = 10,`<br>`  TotalCount = 2,`<br>`  TotalPages = 1`<br>`}` |  |  |  |  |  | O |  |  |  |  |
|  | `{`<br>`  Items = [`<br>`    { SupplierId = 2, SupplierName = "Minh Long", Rating = 4.8 },`<br>`    { SupplierId = 1, SupplierName = "An Phat", Rating = 4.5 }`<br>`  ],`<br>`  PageNumber = 1,`<br>`  PageSize = 10,`<br>`  TotalCount = 2,`<br>`  TotalPages = 1`<br>`}` |  |  |  |  |  |  | O |  |  |  |
|  | `{`<br>`  Items = [`<br>`    { SupplierId = 1, SupplierName = "An Phat", CollaborationStatus = "Active" },`<br>`    { SupplierId = 2, SupplierName = "Minh Long", CollaborationStatus = "Inactive" }`<br>`  ],`<br>`  PageNumber = 1,`<br>`  PageSize = 10,`<br>`  TotalCount = 2,`<br>`  TotalPages = 1`<br>`}` |  |  |  |  |  |  |  | O |  |  |
|  | `{`<br>`  Items = [`<br>`    { SupplierId = 2, SupplierName = "Minh Long" },`<br>`    { SupplierId = 1, SupplierName = "An Phat" }`<br>`  ],`<br>`  PageNumber = 1,`<br>`  PageSize = 10,`<br>`  TotalCount = 2,`<br>`  TotalPages = 1`<br>`}` |  |  |  |  |  |  |  |  | O |  |
|  | `{`<br>`  Items = [],`<br>`  PageNumber = 2,`<br>`  PageSize = 10,`<br>`  TotalCount = 2,`<br>`  TotalPages = 1`<br>`}` |  |  |  |  |  |  |  |  |  | O |
| Confirm | Exception |  |  |  |  |  |  |  |  |  |  |
| Confirm | Log message |  |  |  |  |  |  |  |  |  |  |
| Result | Type(N : Normal, A : Abnormal, B : Boundary) | N | N | N | N | N | N | N | N | B | B |
|  | Passed/Failed | U | U | U | U | U | U | U | U | U | U |
|  | Executed Date |  |  |  |  |  |  |  |  |  |  |
|  | Defect ID |  |  |  |  |  |  |  |  |  |  |

Note: System permission authorization is enforced by API policy/PermissionAttribute outside this Handle method, so it is not duplicated in handler unit tests.
