# CreateMaterialReturnCommandHandler.Handle - Unit Test Suite Matrix

Class Name: `CreateMaterialReturnCommandHandler`  
Function Name: `Handle(CreateMaterialReturnCommand request, CancellationToken cancellationToken)`  
Created By: `DucHV`  
Executed By: `DucHV`

Test requirement: Passed `11`, Failed `0`, Untested `0`, N/A/B `3 / 7 / 1`, Total Test Cases `11`

| Condition | Precondition / Input / Output | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 | UTCID06 | UTCID07 | UTCID08 | UTCID09 | UTCID10 | UTCID11 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Condition | User is authenticated | O | O | O | O | O | O |  | O | O | O | O |
|  | Original issuance exists in DB | O | O | O |  | O | O |  | O | O | O | O |
|  | Original issuance does NOT exist |  |  |  | O |  |  |  |  |  |  |  |
|  | Original issuance has project context | O | O | O | O |  | O |  | O | O | O | O |
|  | Original issuance has NO project context |  |  |  |  | O |  |  |  |  |  |  |
|  | Project status is NOT InProgress |  |  |  |  |  | O |  |  |  |  |  |
|  | Material is not in original issuance |  |  |  |  |  |  |  | O |  |  |  |
|  | Return quantity violates boundary/remaining rule |  |  |  |  |  |  |  |  | O | O | O |
| Input | CreateMaterialReturnCommand |  |  |  |  |  |  |  |  |  |  |  |
|  | `{`<br>`  OriginalIssuanceId = 500,`<br>`  Reason = "Unused materials",`<br>`  Items = [{ MaterialId = 50, UnitId = 1, Quantity = 5, ConversionRate = 1 }, { MaterialId = 51, UnitId = 1, Quantity = 2, ConversionRate = 1 }]`<br>`}` | O |  |  |  |  |  |  |  |  |  |  |
|  | `{`<br>`  OriginalIssuanceId = 500,`<br>`  Reason = "Reason",`<br>`  Items = [{ MaterialId = 50, UnitId = 1, Quantity = 6, ConversionRate = 1 }]`<br>`}` |  | O |  |  |  |  |  |  |  |  |  |
|  | `{`<br>`  OriginalIssuanceId = 500,`<br>`  Reason = "Reason",`<br>`  Items = []`<br>`}` |  |  | O |  |  |  |  |  |  |  |  |
|  | `{`<br>`  OriginalIssuanceId = 999,`<br>`  Reason = "Reason",`<br>`  Items = [{ MaterialId = 50, UnitId = 1, Quantity = 5, ConversionRate = 1 }]`<br>`}` |  |  |  | O |  |  |  |  |  |  |  |
|  | `{`<br>`  OriginalIssuanceId = 500,`<br>`  Reason = "Reason",`<br>`  Items = [{ MaterialId = 50, UnitId = 1, Quantity = 5, ConversionRate = 1 }]`<br>`}` |  |  |  |  | O | O |  |  |  |  | O |
|  | `{`<br>`  OriginalIssuanceId = 500,`<br>`  Reason = "Reason",`<br>`  Items = [{ MaterialId = 99, UnitId = 1, Quantity = 5, ConversionRate = 1 }]`<br>`}` |  |  |  |  |  |  |  | O |  |  |  |
|  | `{`<br>`  OriginalIssuanceId = 500,`<br>`  Reason = "Reason",`<br>`  Items = [{ MaterialId = 50, UnitId = 1, Quantity = 0, ConversionRate = 1 }]`<br>`}` |  |  |  |  |  |  |  |  | O |  |  |
|  | `{`<br>`  OriginalIssuanceId = 500,`<br>`  Reason = "Reason",`<br>`  Items = [{ MaterialId = 50, UnitId = 1, Quantity = 15, ConversionRate = 1 }]`<br>`}` |  |  |  |  |  |  |  |  |  | O |  |
| Input | CancellationToken.None | O | O | O | O | O | O | O | O | O | O | O |
| Confirm | Return |  |  |  |  |  |  |  |  |  |  |  |
|  | `{`<br>`  Success = true,`<br>`  Data = 700,`<br>`  Message contains "Tạo phiếu hoàn trả"`<br>`}` | O | O |  |  |  |  |  |  |  |  |  |
| Confirm | Exception |  |  |  |  |  |  |  |  |  |  |  |
|  | Throws `BusinessException` — `ERR_EMPTY_ITEMS`: `Danh sách vật tư hoàn trả không được để trống.` |  |  | O |  |  |  |  |  |  |  |  |
|  | Throws `NotFoundException` — `BIZ_001`: `MaterialIssuance với ID [999] không tồn tại.` |  |  |  | O |  |  |  |  |  |  |  |
|  | Throws `BusinessException` — `ERR_PROJECT_NOT_FOUND`: `Không tìm thấy dự án liên kết với phiếu xuất kho này.` |  |  |  |  | O |  |  |  |  |  |  |
|  | Throws `BusinessException` — `ERR_PROJECT_NOT_ACTIVE`: `Dự án phải ở trạng thái đang tiến hành để hoàn trả vật tư.` |  |  |  |  |  | O |  |  |  |  |  |
|  | Throws `BusinessException` — `ERR_MATERIAL_NOT_IN_ISSUANCE`: `Vật tư ID 99 không có trong phiếu xuất kho gốc #PXK-500. Chỉ được hoàn trả vật tư đã xuất.` |  |  |  |  |  |  |  | O |  |  |  |
|  | Throws `BusinessException` — `ERR_INVALID_QUANTITY`: `Số lượng hoàn trả phải lớn hơn 0.` |  |  |  |  |  |  |  |  | O |  |  |
|  | Throws `BusinessException` — `ERR_RETURN_EXCEEDS_ISSUED`: `Số lượng hoàn trả (15.000) vượt quá giới hạn còn lại có thể trả (10.000) cho vật tư ID 50 (Tổng xuất: 10.000, Đã trả trước đó: 0.000) trong phiếu xuất #PXK-500.` |  |  |  |  |  |  |  |  |  | O |  |
|  | Throws `BusinessException` — `ERR_RETURN_EXCEEDS_ISSUED`: `Số lượng hoàn trả (5.000) vượt quá giới hạn còn lại có thể trả (4.000) cho vật tư ID 50 (Tổng xuất: 10.000, Đã trả trước đó: 6.000) trong phiếu xuất #PXK-500.` |  |  |  |  |  |  |  |  |  |  | O |
| Confirm | Log message |  |  |  |  |  |  |  |  |  |  |  |
| Result | Type(N : Normal, A : Abnormal, B : Boundary) | N | N | A | A | A | A | N | A | B | A | A |
|  | Passed/Failed | P | P | P | P | P | P | P | P | P | P | P |
|  | Executed Date | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 |
|  | Defect ID |  |  |  |  |  |  |  |  |  |  |  |
