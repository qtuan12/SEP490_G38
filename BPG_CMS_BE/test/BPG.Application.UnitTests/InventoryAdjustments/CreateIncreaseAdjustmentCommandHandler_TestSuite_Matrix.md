# CreateIncreaseAdjustmentCommandHandler.Handle - Unit Test Suite Matrix

Class Name: `CreateIncreaseAdjustmentCommandHandler`  
Function Name: `Handle(CreateIncreaseAdjustmentCommand request, CancellationToken cancellationToken)`  
Created By: `DucHV`  
Executed By: `DucHV`

Test requirement: Passed `8`, Failed `0`, Untested `0`, N/A/B `3 / 4 / 1`, Total Test Cases `8`

| Condition | Precondition / Input / Output | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 | UTCID06 | UTCID07 | UTCID08 |
|---|---|---|---|---|---|---|---|---|---|
| Condition | User is authenticated | O |  | O | O | O | O | O | O |
|  | Project exists in DB |  |  | O | O | O | O | O | O |
|  | Project does NOT exist | O |  |  |  |  |  |  |  |
|  | Phase exists in DB | O |  |  | O | O | O | O | O |
|  | Phase does NOT exist |  |  | O |  |  |  |  |  |
|  | Phase belongs to project | O |  | O |  | O | O | O | O |
|  | Phase does NOT belong to project |  |  |  | O |  |  |  |  |
|  | Material exists in DB | O | O | O | O |  | O | O | O |
|  | Material does NOT exist |  |  |  |  | O |  |  |  |
|  | Discrete material receives decimal quantity |  |  |  |  |  | O |  |  |
| Input | CreateIncreaseAdjustmentCommand |  |  |  |  |  |  |  |  |
|  | `{`<br>`  ProjectId = 1,`<br>`  PhaseId = 2,`<br>`  Reason = "Tăng tồn kho sau kiểm kê",`<br>`  Description = "Kiểm kê thực tế",`<br>`  Items = [{ MaterialId = 10, Quantity = 5 }]`<br>`}` | O | O | O | O | O |  |  |  |
|  | `{`<br>`  ProjectId = 1,`<br>`  PhaseId = 2,`<br>`  Reason = "Tăng tồn kho sau kiểm kê",`<br>`  Description = "Kiểm kê thực tế",`<br>`  Items = [{ MaterialId = 10, Quantity = 1.5 }]`<br>`}` |  |  |  |  |  | O |  |  |
|  | `{`<br>`  ProjectId = 1,`<br>`  PhaseId = 2,`<br>`  Reason = "Tăng tồn kho sau kiểm kê",`<br>`  Description = "Kiểm kê thực tế",`<br>`  Items = [{ MaterialId = 10, Quantity = 10 }]`<br>`}` |  |  |  |  |  |  | O |  |
|  | `{`<br>`  ProjectId = 1,`<br>`  PhaseId = 2,`<br>`  Reason = "Tăng tồn kho sau kiểm kê",`<br>`  Description = "Kiểm kê thực tế",`<br>`  Items = [{ MaterialId = 10, Quantity = 12.5 }]`<br>`}` |  |  |  |  |  |  |  | O |
| Input | CancellationToken.None | O | O | O | O | O | O | O | O |
| Confirm | Return |  |  |  |  |  |  |  |  |
|  | `{`<br>`  Success = true,`<br>`  Data = 800`<br>`}` |  |  |  |  |  |  | O | O |
| Confirm | Exception |  |  |  |  |  |  |  |  |
|  | Throws `NotFoundException` — `BIZ_001`: `Project với ID [1] không tồn tại.` | O |  |  |  |  |  |  |  |
|  | Throws `NotFoundException` — `BIZ_001`: `Phase với ID [2] không tồn tại.` |  |  | O |  |  |  |  |  |
|  | Throws `BusinessException` — `BIZ_005`: `Giai đoạn không thuộc dự án này.` |  |  |  | O |  |  |  |  |
|  | Throws `NotFoundException` — `BIZ_001`: `MaterialCatalog với ID [10] không tồn tại.` |  |  |  |  | O |  |  |  |
|  | Throws `BusinessException` — `BIZ_008`: `Đơn vị tính 'Bao' của vật tư [Xi măng] yêu cầu số lượng phải là số nguyên.` |  |  |  |  |  | O |  |  |
| Confirm | Log message |  |  |  |  |  |  |  |  |
| Result | Type(N : Normal, A : Abnormal, B : Boundary) | A | N | A | A | A | B | N | N |
|  | Passed/Failed | P | P | P | P | P | P | P | P |
|  | Executed Date | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 |
|  | Defect ID |  |  |  |  |  |  |  |  |
