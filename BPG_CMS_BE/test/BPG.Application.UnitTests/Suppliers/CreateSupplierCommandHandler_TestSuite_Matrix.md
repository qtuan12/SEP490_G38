# CreateSupplierCommandHandler.Handle - Unit Test Suite Matrix

Class Name: `CreateSupplierCommandHandler`  
Function Name: `Handle(CreateSupplierCommand request, CancellationToken cancellationToken)`  
Created By: `DucHV`  
Executed By: `Not executed`

Test requirement: Passed `0`, Failed `0`, Untested `3`, N/A/B `1 / 1 / 1`, Total Test Cases `3`

| Condition | Precondition / Input / Output | UTCID01 | UTCID02 | UTCID03 |
|---|---|---|---|---|
| Condition | No non-deleted supplier has the same normalized name | O |  | O |
|  | Another non-deleted supplier has the same name after trim and case normalization |  | O |  |
|  | Optional supplier information is provided | O |  |  |
|  | Optional supplier information is null |  |  | O |
| Input | CreateSupplierCommand |  |  |  |
|  | `{`<br>`  SupplierName = "  An Phat  ",`<br>`  ContactInfo = "  0901234567  ",`<br>`  Address = "  Ho Chi Minh City  ",`<br>`  ServiceArea = "  Southern Vietnam  ",`<br>`  Rating = 4.5,`<br>`  EvaluationNote = "  Good quality  ",`<br>`  CollaborationStatus = "Active"`<br>`}` | O |  |  |
|  | `{`<br>`  SupplierName = "  AN PHAT  ",`<br>`  ContactInfo = "0909999999",`<br>`  Address = "Ha Noi",`<br>`  ServiceArea = "Northern Vietnam",`<br>`  Rating = 4.0,`<br>`  EvaluationNote = "Duplicate",`<br>`  CollaborationStatus = "Active"`<br>`}` |  | O |  |
|  | `{`<br>`  SupplierName = "New Supplier",`<br>`  ContactInfo = null,`<br>`  Address = null,`<br>`  ServiceArea = null,`<br>`  Rating = null,`<br>`  EvaluationNote = null,`<br>`  CollaborationStatus = "Inactive"`<br>`}` |  |  | O |
| Input | CancellationToken.None | O | O | O |
| Confirm | Return |  |  |  |
|  | `{`<br>`  SupplierId = 100,`<br>`  SupplierName = "An Phat",`<br>`  ContactInfo = "0901234567",`<br>`  Address = "Ho Chi Minh City",`<br>`  ServiceArea = "Southern Vietnam",`<br>`  Rating = 4.5,`<br>`  EvaluationNote = "Good quality",`<br>`  CollaborationStatus = "Active"`<br>`}` | O |  |  |
|  | `{`<br>`  SupplierId = 101,`<br>`  SupplierName = "New Supplier",`<br>`  ContactInfo = null,`<br>`  Address = null,`<br>`  ServiceArea = null,`<br>`  Rating = null,`<br>`  EvaluationNote = null,`<br>`  CollaborationStatus = "Inactive"`<br>`}` |  |  | O |
| Confirm | Exception |  |  |  |
|  | Throws `DuplicateEntryException` — `VAL_002`: `Tên nhà cung cấp '  AN PHAT  ' đã tồn tại trong hệ thống.` |  | O |  |
| Confirm | Log message |  |  |  |
| Result | Type(N : Normal, A : Abnormal, B : Boundary) | N | A | B |
|  | Passed/Failed | U | U | U |
|  | Executed Date |  |  |  |
|  | Defect ID |  |  |  |

Note: Empty-name, invalid-status and rating-range rules belong to CreateSupplierCommandValidator and are excluded from direct handler tests.
