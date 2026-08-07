# DeleteSupplierCommandHandler.Handle - Unit Test Suite Matrix

Class Name: `DeleteSupplierCommandHandler`  
Function Name: `Handle(DeleteSupplierCommand request, CancellationToken cancellationToken)`  
Created By: `DucHV`  
Executed By: `Not executed`

Test requirement: Passed `0`, Failed `0`, Untested `2`, N/A/B `1 / 1 / 0`, Total Test Cases `2`

| Condition | Precondition / Input / Output | UTCID01 | UTCID02 |
|---|---|---|---|
| Condition | Supplier 10 exists | O |  |
|  | Supplier 999 does NOT exist |  | O |
| Input | DeleteSupplierCommand |  |  |
|  | `{`<br>`  SupplierId = 10`<br>`}` | O |  |
|  | `{`<br>`  SupplierId = 999`<br>`}` |  | O |
| Input | CancellationToken.None | O | O |
| Confirm | Return |  |  |
|  | true | O |  |
| Confirm | Exception |  |  |
|  | Throws `NotFoundException` — `BIZ_001`: `Supplier với ID [999] không tồn tại.` |  | O |
| Confirm | Log message |  |  |
| Result | Type(N : Normal, A : Abnormal, B : Boundary) | N | A |
|  | Passed/Failed | U | U |
|  | Executed Date |  |  |
|  | Defect ID |  |  |

Note: Soft-delete state and repository calls are integration concerns; this handler unit test observes only true or NotFoundException.
