# GetPurchaseOrdersQueryHandler.Handle - Unit Test Suite Matrix

Class Name: `GetPurchaseOrdersQueryHandler`  
Function Name: `Handle(GetPurchaseOrdersQuery request, CancellationToken cancellationToken)`  
Created By: `qtuan12`  
Executed By: `qtuan12`

Test requirement: Passed `10`, Failed `0`, Untested `0`, N/A/B `6 / 2 / 2`, Total Test Cases `10`

| Condition | Precondition / Input / Output | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 | UTCID06 | UTCID07 | UTCID08 | UTCID09 | UTCID10 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Condition | Current user has role `Accountant` | O |  | O | O | O | O | O | O | O | O |
|  | Current user has role `SiteEngineer` (ngoài 4 vai trò toàn quyền) |  | O |  |  |  |  |  |  |  |  |
|  | Accessible project ids = `{5}` | O | O | O | O | O | O | O | O | O | O |
|  | PO 300 (project 5, `Sent`, NCC "Công ty Vật liệu Minh Long", OrderDate 10/03/2026) | O |  | O |  | O | O | O | O | O |  |
|  | PO 301 thuộc project 6 (ngoài quyền) |  |  | O |  |  |  |  |  |  |  |
|  | PO 301 (project 5, `Cancelled`) |  |  |  |  | O |  |  |  |  |  |
|  | PO 301 (project 5, NCC "Thép Hòa Phát") |  |  |  |  |  | O |  |  |  |  |
|  | PO 301 (project 5, số `PO-20260310-0002`) |  |  |  |  |  |  | O |  |  |  |
|  | PO 301 (project 5, OrderDate 01/04/2026) |  |  |  |  |  |  |  | O | O |  |
|  | PO 300 không gắn nhà cung cấp (`Supplier = null`) |  |  |  |  |  |  |  |  |  | O |
|  | Approved goods receipt của PO 300, material 50, quantity 4 | O |  |  |  |  |  |  |  |  |  |
| Input | GetPurchaseOrdersQuery |  |  |  |  |  |  |  |  |  |  |
|  | `{ ProjectId = 5 }` | O |  |  |  |  |  |  |  |  | O |
|  | `{ ProjectId = null }` |  | O | O |  |  |  |  |  |  |  |
|  | `{ ProjectId = 6 }` |  |  |  | O |  |  |  |  |  |  |
|  | `{ ProjectId = 5, Status = "Cancelled" }` |  |  |  |  | O |  |  |  |  |  |
|  | `{ ProjectId = 5, Search = "Hòa Phát" }` |  |  |  |  |  | O |  |  |  |  |
|  | `{ ProjectId = 5, Search = "0002" }` |  |  |  |  |  |  | O |  |  |  |
|  | `{ ProjectId = 5, OrderDateFrom = 01/03/2026, OrderDateTo = 31/03/2026 }` |  |  |  |  |  |  |  | O |  |  |
|  | `{ ProjectId = 5, PageNumber = 2, PageSize = 1 }` |  |  |  |  |  |  |  |  | O |  |
| Input | CancellationToken.None | O | O | O | O | O | O | O | O | O | O |
| Confirm | Return |  |  |  |  |  |  |  |  |  |  |
|  | `PagedList<PurchaseOrderDto>` `{`<br>`  TotalCount = 1, PageNumber = 1, TotalPages = 1,`<br>`  Items = [{ POId = 300, PONumber = "PO-20260310-0001", Status = "Sent",`<br>`    OrderDate = 10/03/2026, TotalAmount = 15000000,`<br>`    SupplierName = "Công ty Vật liệu Minh Long",`<br>`    Items = [{ MaterialId = 50, MaterialCode = "XM-01", MaterialName = "Xi măng PCB40",`<br>`      UnitName = "Bao", Quantity = 10, UnitPrice = 1500000,`<br>`      LineTotal = 15000000, TotalReceived = 4 }] }]`<br>`}` | O |  |  |  |  |  |  |  |  |  |
|  | `TotalCount = 1`, `Items` chỉ chứa PO 300 |  |  | O |  |  |  |  | O |  |  |
|  | `Items` chỉ chứa PO 301 |  |  |  |  | O | O | O |  |  |  |
|  | `{ TotalCount = 2, TotalPages = 2, HasPreviousPage = true, HasNextPage = false, Items = [PO 300] }` |  |  |  |  |  |  |  |  | O |  |
|  | `Items[0].SupplierName = null` |  |  |  |  |  |  |  |  |  | O |
| Confirm | Exception |  |  |  |  |  |  |  |  |  |  |
|  | Throws `ForbiddenException` — `AUTH_002`: `Bạn chỉ được xem đơn hàng trong phạm vi dự án được cấp quyền.` |  | O |  |  |  |  |  |  |  |  |
|  | Throws `ForbiddenException` — `AUTH_002`: `Bạn không có quyền xem đơn mua hàng của dự án này.` |  |  |  | O |  |  |  |  |  |  |
| Confirm | Log message |  |  |  |  |  |  |  |  |  |  |
| Result | Type(N : Normal, A : Abnormal, B : Boundary) | N | A | N | A | N | N | N | N | B | B |
|  | Passed/Failed | P | P | P | P | P | P | P | P | P | P |
|  | Executed Date | 08/06 | 08/06 | 08/06 | 08/06 | 08/06 | 08/06 | 08/06 | 08/06 | 08/06 | 08/06 |
|  | Defect ID |  |  |  |  |  |  |  |  |  |  |

Note: UTCID02 và UTCID04 là hai nhánh phân quyền độc lập — chặn theo vai trò khi không truyền `ProjectId`, và chặn theo phạm vi dự án khi có `ProjectId`. UTCID03 phủ nhánh lọc theo danh sách dự án được cấp quyền.  
Note: Admin, Accountant, TechnicalManager và Director đi chung một `IsInAnyRole(...)` nên chỉ cần một vai trò đại diện (mục 11 của UNIT_TEST_GUIDE).  
Note: UTCID09 là boundary trang cuối (sắp xếp `OrderDate` giảm dần nên đơn cũ hơn nằm ở trang 2); UTCID10 là boundary PO không có nhà cung cấp.
