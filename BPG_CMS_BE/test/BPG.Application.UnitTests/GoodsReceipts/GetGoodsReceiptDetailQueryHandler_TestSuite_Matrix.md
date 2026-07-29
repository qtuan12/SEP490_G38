# GetGoodsReceiptDetailQueryHandler.Handle - Unit Test Suite Matrix

Class Name: `GetGoodsReceiptDetailQueryHandler`  
Function Name: `Handle(GetGoodsReceiptDetailQuery request, CancellationToken cancellationToken)`  
Created By: `DucHV`  
Executed By: `Not executed`

Test requirement: Passed `0`, Failed `0`, Untested `4`, N/A/B `1 / 1 / 2`, Total Test Cases `4`

| Condition | Precondition / Input / Output | UTCID01 | UTCID02 | UTCID03 | UTCID04 |
|---|---|---|---|---|---|
| Condition | GoodsReceipt 37 exists | O | O | O |  |
|  | GoodsReceipt 999 does NOT exist |  |  |  | O |
|  | Purchase Order, supplier, item material and unit exist | O |  |  |  |
|  | Active Goods Receipt attachments exist | O |  |  |  |
|  | CreatedBy user exists | O |  | O |  |
|  | CreatedBy user does NOT exist |  | O |  |  |
|  | Goods Receipt has no items or active attachments |  |  | O |  |
| Input | GetGoodsReceiptDetailQuery |  |  |  |  |
|  | `{`<br>`  ReceiptId = 37`<br>`}` | O | O | O |  |
|  | `{`<br>`  ReceiptId = 999`<br>`}` |  |  |  | O |
| Input | CancellationToken.None | O | O | O | O |
| Confirm | Return |  |  |  |  |
|  | `{`<br>`  Success = true,`<br>`  ErrorCode = null,`<br>`  Message = null,`<br>`  Errors = null,`<br>`  Data = {`<br>`    ReceiptId = 37,`<br>`    ReceiptNo = "GR-001",`<br>`    POId = 70,`<br>`    PONumber = "PO-001",`<br>`    SupplierName = "An Phat",`<br>`    DelivererInfo = "Nguyen Van A",`<br>`    DeliveryDocNo = "DN-001",`<br>`    Status = "Approved",`<br>`    CreatedAt = 2026-07-14T08:00:00Z,`<br>`    CreatedByName = "Project Leader",`<br>`    Images = ["receipt-37.jpg"],`<br>`    Items = [`<br>`      { ReceiptItemId = 3701, MaterialId = 50, MaterialCode = "MAT-050", MaterialName = "Cement", Specification = "PCB40", UnitId = 1, UnitName = "Bag", Quantity = 100 }`<br>`    ]`<br>`  }`<br>`}` | O |  |  |  |
|  | `{`<br>`  Success = true,`<br>`  ErrorCode = null,`<br>`  Message = null,`<br>`  Errors = null,`<br>`  Data = {`<br>`    ReceiptId = 37,`<br>`    ReceiptNo = "GR-001",`<br>`    POId = 70,`<br>`    PONumber = "PO-001",`<br>`    SupplierName = "An Phat",`<br>`    DelivererInfo = "Nguyen Van A",`<br>`    DeliveryDocNo = "DN-001",`<br>`    Status = "Approved",`<br>`    CreatedAt = 2026-07-14T08:00:00Z,`<br>`    CreatedByName = "N/A",`<br>`    Images = ["receipt-37.jpg"],`<br>`    Items = [{ ReceiptItemId = 3701, MaterialId = 50, MaterialCode = "MAT-050", MaterialName = "Cement", Specification = "PCB40", UnitId = 1, UnitName = "Bag", Quantity = 100 }]`<br>`  }`<br>`}` |  | O |  |  |
|  | `{`<br>`  Success = true,`<br>`  ErrorCode = null,`<br>`  Message = null,`<br>`  Errors = null,`<br>`  Data = {`<br>`    ReceiptId = 37,`<br>`    ReceiptNo = "GR-001",`<br>`    POId = 70,`<br>`    PONumber = "PO-001",`<br>`    SupplierName = "An Phat",`<br>`    DelivererInfo = "Nguyen Van A",`<br>`    DeliveryDocNo = "DN-001",`<br>`    Status = "Approved",`<br>`    CreatedAt = 2026-07-14T08:00:00Z,`<br>`    CreatedByName = "Project Leader",`<br>`    Images = [],`<br>`    Items = []`<br>`  }`<br>`}` |  |  | O |  |
| Confirm | Exception |  |  |  |  |
|  | Throws `NotFoundException` — `BIZ_001`: `GoodsReceipt với ID [999] không tồn tại.` |  |  |  | O |
| Confirm | Log message |  |  |  |  |
| Result | Type(N : Normal, A : Abnormal, B : Boundary) | N | B | B | A |
|  | Passed/Failed | U | U | U | U |
|  | Executed Date |  |  |  |  |
|  | Defect ID |  |  |  |  |

Note: Deleted attachments are absent from Images because the handler filters IsDeleted.
