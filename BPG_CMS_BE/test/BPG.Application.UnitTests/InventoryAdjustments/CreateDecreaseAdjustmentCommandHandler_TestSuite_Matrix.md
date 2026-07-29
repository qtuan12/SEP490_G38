# CreateDecreaseAdjustmentCommandHandler.Handle - Unit Test Suite Matrix

Class Name: `CreateDecreaseAdjustmentCommandHandler`  
Function Name: `Handle(CreateDecreaseAdjustmentCommand request, CancellationToken cancellationToken)`  
Created By: `DucHV`  
Executed By: `DucHV`

Test requirement: Passed `6`, Failed `0`, Untested `0`, N/A/B `1 / 4 / 1`, Total Test Cases `6`

| Condition | Precondition / Input / Output | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 | UTCID06 |
|---|---|---|---|---|---|---|---|
| Condition | Project exists in DB |  | O | O | O | O | O |
|  | Project does NOT exist | O |  |  |  |  |  |
|  | Phase exists in DB | O |  | O | O | O | O |
|  | Phase does NOT exist |  | O |  |  |  |  |
|  | Phase belongs to project | O | O |  | O | O | O |
|  | Phase does NOT belong to project |  |  | O |  |  |  |
|  | Material exists in DB | O | O | O |  | O | O |
|  | Material does NOT exist |  |  |  | O |  |  |
|  | Discrete material receives decimal quantity |  |  |  |  | O |  |
| Input | CreateDecreaseAdjustmentCommand |  |  |  |  |  |  |
|  | `{`<br>`  ProjectId = 1,`<br>`  PhaseId = 2,`<br>`  Reason = "Giảm tồn do hư hỏng",`<br>`  Description = "Sự cố vật tư",`<br>`  Items = [{ MaterialId = 10, Quantity = 2 }]`<br>`}` | O | O | O | O |  |  |
|  | `{`<br>`  ProjectId = 1,`<br>`  PhaseId = 2,`<br>`  Reason = "Giảm tồn do hư hỏng",`<br>`  Description = "Sự cố vật tư",`<br>`  Items = [{ MaterialId = 10, Quantity = 2.3 }]`<br>`}` |  |  |  |  | O |  |
|  | `{`<br>`  ProjectId = 1,`<br>`  PhaseId = 2,`<br>`  Reason = "Giảm tồn do hư hỏng",`<br>`  Description = "Sự cố vật tư",`<br>`  Items = [{ MaterialId = 10, Quantity = 15.5 }]`<br>`}` |  |  |  |  |  | O |
| Input | CancellationToken.None | O | O | O | O | O | O |
| Confirm | Return |  |  |  |  |  |  |
|  | `{`<br>`  Success = true,`<br>`  Data = 900`<br>`}` |  |  |  |  |  | O |
| Confirm | Exception |  |  |  |  |  |  |
|  | Throws `NotFoundException` — `BIZ_001`: `Project với ID [1] không tồn tại.` | O |  |  |  |  |  |
|  | Throws `NotFoundException` — `BIZ_001`: `Phase với ID [2] không tồn tại.` |  | O |  |  |  |  |
|  | Throws `BusinessException` — `ERR_INVALID_PHASE`: `Giai đoạn không thuộc dự án này` |  |  | O |  |  |  |
|  | Throws `NotFoundException` — `BIZ_001`: `MaterialCatalog với ID [10] không tồn tại.` |  |  |  | O |  |  |
|  | Throws `BusinessException` — `BIZ_008`: `Đơn vị tính 'm3' của vật tư [Cát xây dựng] yêu cầu số lượng phải là số nguyên.` |  |  |  |  | O |  |
| Confirm | Log message |  |  |  |  |  |  |
| Result | Type(N : Normal, A : Abnormal, B : Boundary) | A | A | A | A | B | N |
|  | Passed/Failed | P | P | P | P | P | P |
|  | Executed Date | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 |
|  | Defect ID |  |  |  |  |  |  |
