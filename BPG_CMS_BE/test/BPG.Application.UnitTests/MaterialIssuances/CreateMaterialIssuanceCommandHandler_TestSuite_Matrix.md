# CreateMaterialIssuanceCommandHandler.Handle - Unit Test Suite Matrix

Class Name: `CreateMaterialIssuanceCommandHandler`  
Function Name: `Handle(CreateMaterialIssuanceCommand request, CancellationToken cancellationToken)`  
Created By: `DucHV`  
Executed By: `DucHV`

Test requirement: Passed `11`, Failed `0`, Untested `0`, N/A/B `3 / 7 / 1`, Total Test Cases `11`

| Condition | Precondition / Input / Output | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 | UTCID06 | UTCID07 | UTCID08 | UTCID09 | UTCID10 | UTCID11 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Condition | User is authenticated | O | O | O | O | O |  | O | O | O | O | O |
|  | Task exists in DB | O | O | O |  | O |  | O | O | O | O | O |
|  | Task does NOT exist |  |  |  | O |  |  |  |  |  |  |  |
|  | User can manage execution through project.execution.manage (TechnicalManager grant) | O |  | O | O | O |  | O | O | O | O | O |
|  | User is project leader; membership grants project.execution.manage/project.inventory.manage |  | O |  |  |  |  |  |  |  |  |  |
|  | Pipeline requires `project.execution.manage` for `Task` resource |  |  |  |  |  | O |  |  |  |  |  |
|  | Task has project context | O | O | O | O |  |  | O | O | O | O | O |
|  | Task has NO project context |  |  |  |  | O |  |  |  |  |  |  |
|  | Project status is NOT InProgress |  |  |  |  |  |  | O |  |  |  |  |
|  | Task is locked |  |  |  |  |  |  |  | O |  |  |  |
|  | Material has no inventory entry |  |  |  |  |  |  |  |  | O |  |  |
|  | Quantity violates boundary rule |  |  |  |  |  |  |  |  |  | O | O |
| Input | CreateMaterialIssuanceCommand |  |  |  |  |  |  |  |  |  |  |  |
|  | `{`<br>`  TaskId = 100,`<br>`  Purpose = "Slab casting",`<br>`  Items = [{ MaterialId = 50, UnitId = 1, Quantity = 5, ConversionRate = 1 }, { MaterialId = 51, UnitId = 1, Quantity = 2, ConversionRate = 1 }]`<br>`}` | O |  |  |  |  |  |  |  |  |  |  |
|  | `{`<br>`  TaskId = 100,`<br>`  Purpose = "Purpose",`<br>`  Items = [{ MaterialId = 50, UnitId = 1, Quantity = 10, ConversionRate = 1 }]`<br>`}` |  | O |  |  |  |  |  |  |  |  |  |
|  | `{`<br>`  TaskId = 100,`<br>`  Purpose = "Purpose",`<br>`  Items = []`<br>`}` |  |  | O |  |  |  |  |  |  |  |  |
|  | `{`<br>`  TaskId = 999,`<br>`  Purpose = "Purpose",`<br>`  Items = [{ MaterialId = 50, UnitId = 1, Quantity = 5, ConversionRate = 1 }]`<br>`}` |  |  |  | O |  |  |  |  |  |  |  |
|  | `{`<br>`  TaskId = 100,`<br>`  Purpose = "Purpose",`<br>`  Items = [{ MaterialId = 50, UnitId = 1, Quantity = 5, ConversionRate = 1 }]`<br>`}` |  |  |  |  | O |  | O | O |  |  |  |
|  | `{`<br>`  TaskId = 100,`<br>`  Purpose = "Purpose",`<br>`  Items = [{ MaterialId = 99, UnitId = 1, Quantity = 10, ConversionRate = 1 }]`<br>`}` |  |  |  |  |  |  |  |  | O |  |  |
|  | `{`<br>`  TaskId = 100,`<br>`  Purpose = "Purpose",`<br>`  Items = [{ MaterialId = 50, UnitId = 1, Quantity = 1.5, ConversionRate = 1 }]`<br>`}` |  |  |  |  |  |  |  |  |  | O |  |
|  | `{`<br>`  TaskId = 100,`<br>`  Purpose = "Purpose",`<br>`  Items = [{ MaterialId = 50, UnitId = 1, Quantity = 5, ConversionRate = 1 }, { MaterialId = 51, UnitId = 1, Quantity = 10, ConversionRate = 1 }]`<br>`}` |  |  |  |  |  |  |  |  |  |  | O |
| Input | CancellationToken.None | O | O | O | O | O | O | O | O | O | O | O |
| Confirm | Return |  |  |  |  |  |  |  |  |  |  |  |
|  | `{`<br>`  Success = true,`<br>`  Data = 600,`<br>`  Message = "Tạo phiếu xuất kho thành công."`<br>`}` | O | O |  |  |  |  |  |  |  |  |  |
|  | Command contract: `RequiredPermission = project.execution.manage`, `ProjectResource = Task(100)` |  |  |  |  |  | O |  |  |  |  |  |
| Confirm | Exception |  |  |  |  |  |  |  |  |  |  |  |
|  | Throws `BusinessException` — `ERR_EMPTY_ITEMS`: `Danh sách vật tư xuất dùng không được để trống.` |  |  | O |  |  |  |  |  |  |  |  |
|  | Throws `NotFoundException` — `BIZ_001`: `ProjectTask với ID [999] không tồn tại.` |  |  |  | O |  |  |  |  |  |  |  |
|  | Throws `BusinessException` — `ERR_PROJECT_NOT_FOUND`: `Không tìm thấy dự án liên kết với công việc này.` |  |  |  |  | O |  |  |  |  |  |  |
|  | Throws `BusinessException` — `ERR_PROJECT_NOT_ACTIVE`: `Dự án liên kết phải ở trạng thái đang tiến hành (InProgress).` |  |  |  |  |  |  | O |  |  |  |  |
|  | Throws `BusinessException` — `ERR_TASK_LOCKED`: `Công việc này đã bị khóa (đã nghiệm thu hoặc hoàn thành). Không thể xuất thêm vật tư.` |  |  |  |  |  |  |  | O |  |  |  |
|  | Throws `BusinessException` — `ERR_NO_INVENTORY`: `Vật tư ID 99 không tồn tại trong kho của dự án.` |  |  |  |  |  |  |  |  | O |  |  |
|  | Throws `BusinessException` — `BIZ_008`: `Đơn vị tính 'Panel' của vật tư [Precast Panel] yêu cầu số lượng xuất phải là số nguyên.` |  |  |  |  |  |  |  |  |  | O |  |
|  | Throws `BusinessException` — `ERR_INSUFFICIENT_STOCK`: `Không đủ tồn kho khả dụng cho vật tư [Sand]. Yêu cầu xuất: 10 Bag, tồn khả dụng còn lại: 5 Bag.` |  |  |  |  |  |  |  |  |  |  | O |
| Confirm | Log message |  |  |  |  |  |  |  |  |  |  |  |
| Result | Type(N : Normal, A : Abnormal, B : Boundary) | N | N | A | A | A | N | A | A | A | B | A |
|  | Passed/Failed | P | P | P | P | P | P | P | P | P | P | P |
|  | Executed Date | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 |
|  | Defect ID |  |  |  |  |  |  |  |  |  |  |  |
