# GetMaterialIssuanceDetailQueryHandler.Handle - Unit Test Suite Matrix

Class Name: `GetMaterialIssuanceDetailQueryHandler`  
Function Name: `Handle(GetMaterialIssuanceDetailQuery request, CancellationToken cancellationToken)`  
Created By: `DucHV`  
Executed By: `Not executed`

Test requirement: Passed `0`, Failed `0`, Untested `4`, N/A/B `1 / 1 / 2`, Total Test Cases `4`

| Condition | Precondition / Input / Output | UTCID01 | UTCID02 | UTCID03 | UTCID04 |
|---|---|---|---|---|---|
| Condition | MaterialIssuance 79 exists | O | O | O |  |
|  | MaterialIssuance 999 does NOT exist |  |  |  | O |
|  | Task, item material and unit exist | O | O |  |  |
|  | CreatedBy user exists | O |  | O |  |
|  | CreatedBy user does NOT exist |  | O |  |  |
|  | Material Issuance has no items |  |  | O |  |
| Input | GetMaterialIssuanceDetailQuery |  |  |  |  |
|  | `{`<br>`  IssuanceId = 79`<br>`}` | O | O | O |  |
|  | `{`<br>`  IssuanceId = 999`<br>`}` |  |  |  | O |
| Input | CancellationToken.None | O | O | O | O |
| Confirm | Return |  |  |  |  |
|  | `{`<br>`  Success = true,`<br>`  ErrorCode = null,`<br>`  Message = null,`<br>`  Errors = null,`<br>`  Data = {`<br>`    MaterialIssuanceId = 79,`<br>`    IssuanceNo = "PXK-079",`<br>`    TaskId = 100,`<br>`    TaskName = "Concrete Slab",`<br>`    Purpose = "Pouring work",`<br>`    CreatedAt = 2026-07-14T08:00:00Z,`<br>`    CreatedByName = "Project Leader",`<br>`    Items = [`<br>`      { IssuanceItemId = 7901, MaterialId = 50, MaterialCode = "MAT-050", MaterialName = "Cement", UnitId = 1, UnitName = "Bag", Quantity = 20, ConversionRate = 1 }`<br>`    ]`<br>`  }`<br>`}` | O |  |  |  |
|  | `{`<br>`  Success = true,`<br>`  ErrorCode = null,`<br>`  Message = null,`<br>`  Errors = null,`<br>`  Data = {`<br>`    MaterialIssuanceId = 79,`<br>`    IssuanceNo = "PXK-079",`<br>`    TaskId = 100,`<br>`    TaskName = "Concrete Slab",`<br>`    Purpose = "Pouring work",`<br>`    CreatedAt = 2026-07-14T08:00:00Z,`<br>`    CreatedByName = "N/A",`<br>`    Items = [{ IssuanceItemId = 7901, MaterialId = 50, MaterialCode = "MAT-050", MaterialName = "Cement", UnitId = 1, UnitName = "Bag", Quantity = 20, ConversionRate = 1 }]`<br>`  }`<br>`}` |  | O |  |  |
|  | `{`<br>`  Success = true,`<br>`  ErrorCode = null,`<br>`  Message = null,`<br>`  Errors = null,`<br>`  Data = {`<br>`    MaterialIssuanceId = 79,`<br>`    IssuanceNo = "PXK-079",`<br>`    TaskId = 100,`<br>`    TaskName = "Concrete Slab",`<br>`    Purpose = "Pouring work",`<br>`    CreatedAt = 2026-07-14T08:00:00Z,`<br>`    CreatedByName = "Project Leader",`<br>`    Items = []`<br>`  }`<br>`}` |  |  | O |  |
| Confirm | Exception |  |  |  |  |
|  | Throws `NotFoundException` — `BIZ_001`: `MaterialIssuance với ID [999] không tồn tại.` |  |  |  | O |
| Confirm | Log message |  |  |  |  |
| Result | Type(N : Normal, A : Abnormal, B : Boundary) | N | B | B | A |
|  | Passed/Failed | U | U | U | U |
|  | Executed Date |  |  |  |  |
|  | Defect ID |  |  |  |  |
