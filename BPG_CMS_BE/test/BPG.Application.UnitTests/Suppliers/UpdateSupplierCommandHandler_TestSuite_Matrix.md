# UpdateSupplierCommandHandler.Handle - Unit Test Suite Matrix

Class Name: `UpdateSupplierCommandHandler`  
Function Name: `Handle(UpdateSupplierCommand request, CancellationToken cancellationToken)`  
Created By: `DucHV`  
Executed By: `Not executed`

Test requirement: Passed `0`, Failed `0`, Untested `4`, N/A/B `1 / 2 / 1`, Total Test Cases `4`

| Condition | Precondition / Input / Output | UTCID01 | UTCID02 | UTCID03 | UTCID04 |
|---|---|---|---|---|---|
| Condition | Supplier 10 exists | O |  | O | O |
|  | Supplier 999 does NOT exist |  | O |  |  |
|  | No other non-deleted supplier has the normalized requested name | O |  |  | O |
|  | Another non-deleted supplier has the normalized requested name |  |  | O |  |
|  | Requested name belongs to the same supplier |  |  |  | O |
| Input | UpdateSupplierCommand |  |  |  |  |
|  | `{`<br>`  SupplierId = 10,`<br>`  SupplierName = "  An Phat Updated  ",`<br>`  ContactInfo = "  0907654321  ",`<br>`  Address = "  Ha Noi  ",`<br>`  ServiceArea = "  Nationwide  ",`<br>`  Rating = 5.0,`<br>`  EvaluationNote = "  Preferred supplier  ",`<br>`  CollaborationStatus = "Active"`<br>`}` | O |  |  |  |
|  | `{`<br>`  SupplierId = 999,`<br>`  SupplierName = "Missing Supplier",`<br>`  ContactInfo = null,`<br>`  Address = null,`<br>`  ServiceArea = null,`<br>`  Rating = null,`<br>`  EvaluationNote = null,`<br>`  CollaborationStatus = "Inactive"`<br>`}` |  | O |  |  |
|  | `{`<br>`  SupplierId = 10,`<br>`  SupplierName = "  MINH LONG  ",`<br>`  ContactInfo = "0907654321",`<br>`  Address = "Ha Noi",`<br>`  ServiceArea = "Nationwide",`<br>`  Rating = 4.0,`<br>`  EvaluationNote = "Duplicate",`<br>`  CollaborationStatus = "Active"`<br>`}` |  |  | O |  |
|  | `{`<br>`  SupplierId = 10,`<br>`  SupplierName = "  AN PHAT  ",`<br>`  ContactInfo = null,`<br>`  Address = null,`<br>`  ServiceArea = null,`<br>`  Rating = null,`<br>`  EvaluationNote = null,`<br>`  CollaborationStatus = "Inactive"`<br>`}` |  |  |  | O |
| Input | CancellationToken.None | O | O | O | O |
| Confirm | Return |  |  |  |  |
|  | `{`<br>`  SupplierId = 10,`<br>`  SupplierName = "An Phat Updated",`<br>`  ContactInfo = "0907654321",`<br>`  Address = "Ha Noi",`<br>`  ServiceArea = "Nationwide",`<br>`  Rating = 5.0,`<br>`  EvaluationNote = "Preferred supplier",`<br>`  CollaborationStatus = "Active"`<br>`}` | O |  |  |  |
|  | `{`<br>`  SupplierId = 10,`<br>`  SupplierName = "AN PHAT",`<br>`  ContactInfo = null,`<br>`  Address = null,`<br>`  ServiceArea = null,`<br>`  Rating = null,`<br>`  EvaluationNote = null,`<br>`  CollaborationStatus = "Inactive"`<br>`}` |  |  |  | O |
| Confirm | Exception |  |  |  |  |
|  | Throws `NotFoundException` — `BIZ_001`: `Supplier với ID [999] không tồn tại.` |  | O |  |  |
|  | Throws `DuplicateEntryException` — `VAL_002`: `Tên nhà cung cấp '  MINH LONG  ' đã tồn tại trong hệ thống.` |  |  | O |  |
| Confirm | Log message |  |  |  |  |
| Result | Type(N : Normal, A : Abnormal, B : Boundary) | N | A | A | B |
|  | Passed/Failed | U | U | U | U |
|  | Executed Date |  |  |  |  |
|  | Defect ID |  |  |  |  |

Note: Validator-only structural rules are excluded because direct Handle invocation does not execute FluentValidation.
