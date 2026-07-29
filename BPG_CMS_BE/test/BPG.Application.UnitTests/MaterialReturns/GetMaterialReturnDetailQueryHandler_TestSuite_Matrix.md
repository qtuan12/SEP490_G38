# GetMaterialReturnDetailQueryHandler.Handle - Unit Test Suite Matrix

Class Name: `GetMaterialReturnDetailQueryHandler`  
Function Name: `Handle(GetMaterialReturnDetailQuery request, CancellationToken cancellationToken)`  
Created By: `DucHV`  
Executed By: `Not executed`

Test requirement: Passed `0`, Failed `0`, Untested `4`, N/A/B `1 / 1 / 2`, Total Test Cases `4`

| Condition | Precondition / Input / Output | UTCID01 | UTCID02 | UTCID03 | UTCID04 |
|---|---|---|---|---|---|
| Condition | MaterialReturn 81 exists | O | O | O |  |
|  | MaterialReturn 999 does NOT exist |  |  |  | O |
|  | Original issuance, task, item material and unit exist | O | O |  |  |
|  | CreatedBy user exists | O |  | O |  |
|  | CreatedBy user does NOT exist |  | O |  |  |
|  | Material Return has no items |  |  | O |  |
| Input | GetMaterialReturnDetailQuery |  |  |  |  |
|  | `{`<br>`  ReturnId = 81`<br>`}` | O | O | O |  |
|  | `{`<br>`  ReturnId = 999`<br>`}` |  |  |  | O |
| Input | CancellationToken.None | O | O | O | O |
| Confirm | Return |  |  |  |  |
|  | `{`<br>`  Success = true,`<br>`  ErrorCode = null,`<br>`  Message = null,`<br>`  Errors = null,`<br>`  Data = {`<br>`    MaterialReturnId = 81,`<br>`    ReturnNo = "PTRA-081",`<br>`    OriginalIssuanceId = 79,`<br>`    OriginalIssuanceNo = "PXK-079",`<br>`    TaskId = 100,`<br>`    TaskName = "Concrete Slab",`<br>`    Reason = "Unused material",`<br>`    CreatedAt = 2026-07-14T12:00:00Z,`<br>`    CreatedByName = "Site Engineer",`<br>`    Items = [`<br>`      { ReturnItemId = 8101, MaterialId = 50, MaterialCode = "MAT-050", MaterialName = "Cement", UnitId = 1, UnitName = "Bag", Quantity = 5, ConversionRate = 1 }`<br>`    ]`<br>`  }`<br>`}` | O |  |  |  |
|  | `{`<br>`  Success = true,`<br>`  ErrorCode = null,`<br>`  Message = null,`<br>`  Errors = null,`<br>`  Data = {`<br>`    MaterialReturnId = 81,`<br>`    ReturnNo = "PTRA-081",`<br>`    OriginalIssuanceId = 79,`<br>`    OriginalIssuanceNo = "PXK-079",`<br>`    TaskId = 100,`<br>`    TaskName = "Concrete Slab",`<br>`    Reason = "Unused material",`<br>`    CreatedAt = 2026-07-14T12:00:00Z,`<br>`    CreatedByName = "N/A",`<br>`    Items = [{ ReturnItemId = 8101, MaterialId = 50, MaterialCode = "MAT-050", MaterialName = "Cement", UnitId = 1, UnitName = "Bag", Quantity = 5, ConversionRate = 1 }]`<br>`  }`<br>`}` |  | O |  |  |
|  | `{`<br>`  Success = true,`<br>`  ErrorCode = null,`<br>`  Message = null,`<br>`  Errors = null,`<br>`  Data = {`<br>`    MaterialReturnId = 81,`<br>`    ReturnNo = "PTRA-081",`<br>`    OriginalIssuanceId = 79,`<br>`    OriginalIssuanceNo = "PXK-079",`<br>`    TaskId = 100,`<br>`    TaskName = "Concrete Slab",`<br>`    Reason = "Unused material",`<br>`    CreatedAt = 2026-07-14T12:00:00Z,`<br>`    CreatedByName = "Site Engineer",`<br>`    Items = []`<br>`  }`<br>`}` |  |  | O |  |
| Confirm | Exception |  |  |  |  |
|  | Throws `NotFoundException` — `BIZ_001`: `MaterialReturn với ID [999] không tồn tại.` |  |  |  | O |
| Confirm | Log message |  |  |  |  |
| Result | Type(N : Normal, A : Abnormal, B : Boundary) | N | B | B | A |
|  | Passed/Failed | U | U | U | U |
|  | Executed Date |  |  |  |  |
|  | Defect ID |  |  |  |  |
