# GetCurrentInventoryQueryHandler.Handle - Unit Test Suite Matrix

Class Name: `GetCurrentInventoryQueryHandler`  
Function Name: `Handle(GetCurrentInventoryQuery request, CancellationToken cancellationToken)`  
Created By: `DucHV`  
Executed By: `DucHV`

Test requirement: Passed `10`, Failed `0`, Untested `0`, N/A/B `5 / 0 / 5`, Total Test Cases `10`

| Condition | Precondition / Input / Output | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 | UTCID06 | UTCID07 | UTCID08 | UTCID09 | UTCID10 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Condition | ProjectId is provided | O | O | O | O | O | O | O | O | O | O |
|  | Inventory exists for project | O | O | O | O |  | O | O | O | O | O |
|  | Inventory does NOT exist for project |  |  |  |  | O |  |  |  |  |  |
|  | Safety threshold config exists | O | O | O | O |  |  | O | O | O | O |
|  | Safety threshold config is missing |  |  |  |  |  | O |  |  |  |  |
|  | Purchase order supplier data exists |  | O |  |  |  |  |  | O |  |  |
|  | BOQ and issuance usage data exists |  |  | O | O |  |  | O |  | O | O |
|  | ConversionRate is not 1 |  |  |  |  |  |  | O |  |  |  |
|  | Multiple suppliers exist for same material |  |  |  |  |  |  |  | O |  |  |
|  | Multiple phases/materials exist |  |  |  |  |  |  |  |  | O |  |
|  | Soft-deleted BOQ or issuance exists |  |  |  |  |  |  |  |  |  | O |
| Input | GetCurrentInventoryQuery |  |  |  |  |  |  |  |  |  |  |
|  | `{`<br>`  ProjectId = 5`<br>`}` | O | O | O | O | O | O | O | O | O | O |
| Input | CancellationToken.None | O | O | O | O | O | O | O | O | O | O |
| Confirm | Return |  |  |  |  |  |  |  |  |  |  |
|  | `{`<br>`  Success = true,`<br>`  Data count = 1,`<br>`  First.SafetyThreshold = 15`<br>`}` | O |  |  |  |  |  |  |  |  |  |
|  | `{`<br>`  Success = true,`<br>`  Data count = 1,`<br>`  First.SupplierName = "Supplier Alpha"`<br>`}` |  | O |  |  |  |  |  |  |  |  |
|  | `{`<br>`  Success = true,`<br>`  Data count = 1,`<br>`  First.BoqQuantity = 100,`<br>`  First.UsedQuantity = 40`<br>`}` |  |  | O |  |  |  |  |  |  |  |
|  | `{`<br>`  Success = true,`<br>`  Data count = 1,`<br>`  First.PhaseUsages = [{ PhaseName = "Foundation Phase", BoqQuantity = 100, UsedQuantity = 40 }]`<br>`}` |  |  |  | O |  |  |  |  |  |  |
|  | `{`<br>`  Success = true,`<br>`  Data = []`<br>`}` |  |  |  |  | O |  |  |  |  |  |
|  | `{`<br>`  Success = true,`<br>`  Data count = 1,`<br>`  First.SafetyThreshold = 10`<br>`}` |  |  |  |  |  | O |  |  |  |  |
|  | `{`<br>`  Success = true,`<br>`  Data count = 1,`<br>`  First.BoqQuantity = 50,`<br>`  First.UsedQuantity = 20,`<br>`  First.PhaseUsages[0].BoqQuantity = 50,`<br>`  First.PhaseUsages[0].UsedQuantity = 20`<br>`}` |  |  |  |  |  |  | O |  |  |  |
|  | `{`<br>`  Success = true,`<br>`  Data count = 1,`<br>`  First.SupplierName = "Supplier Beta"`<br>`}` |  |  |  |  |  |  |  | O |  |  |
|  | `{`<br>`  Success = true,`<br>`  Data count = 2,`<br>`  Cement.BoqQuantity = 250,`<br>`  Cement.UsedQuantity = 100,`<br>`  Cement.PhaseUsages count = 2,`<br>`  Brick.BoqQuantity = 0,`<br>`  Brick.UsedQuantity = 0`<br>`}` |  |  |  |  |  |  |  |  | O |  |
|  | `{`<br>`  Success = true,`<br>`  Data count = 1,`<br>`  First.BoqQuantity = 0,`<br>`  First.UsedQuantity = 0`<br>`}` |  |  |  |  |  |  |  |  |  | O |
| Confirm | Exception |  |  |  |  |  |  |  |  |  |  |
| Confirm | Log message |  |  |  |  |  |  |  |  |  |  |
| Result | Type(N : Normal, A : Abnormal, B : Boundary) | N | N | N | N | B | B | B | B | B | B |
|  | Passed/Failed | P | P | P | P | P | P | P | P | P | P |
|  | Executed Date | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 |
|  | Defect ID |  |  |  |  |  |  |  |  |  |  |
