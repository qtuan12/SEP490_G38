# GetNextPoNumberQueryHandler.Handle - Unit Test Suite Matrix

Class Name: `GetNextPoNumberQueryHandler`  
Function Name: `Handle(GetNextPoNumberQuery request, CancellationToken cancellationToken)`  
Created By: `qtuan12`  
Executed By: `qtuan12`

Test requirement: Passed `5`, Failed `0`, Untested `0`, N/A/B `3 / 0 / 2`, Total Test Cases `5`

| Condition | Precondition / Input / Output | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 |
|---|---|---|---|---|---|---|
| Condition | Không có đơn mua hàng nào trong DB | O |  |  |  |  |
|  | Tồn tại `PO-20260310-0001`, `PO-20260310-0003`, `PO-20260310-0002` |  | O |  |  |  |
|  | Chỉ tồn tại đơn của ngày khác: `PO-20260309-0007`, `PO-20260311-0002` |  |  | O |  |  |
|  | Tồn tại mã nhập tay có hậu tố không phải số: `PO-20260310-ABC` |  |  |  | O |  |
|  | Tồn tại `PO-20260310-9999` (chạm trần 4 chữ số) |  |  |  |  | O |
| Input | GetNextPoNumberQuery |  |  |  |  |  |
|  | `{ OrderDate = 10/03/2026 }` | O | O | O | O | O |
| Input | CancellationToken.None | O | O | O | O | O |
| Confirm | Return |  |  |  |  |  |
|  | `"PO-20260310-0001"` | O |  | O | O |  |
|  | `"PO-20260310-0004"` |  | O |  |  |  |
|  | `"PO-20260310-10000"` |  |  |  |  | O |
| Confirm | Exception |  |  |  |  |  |
| Confirm | Log message |  |  |  |  |  |
| Result | Type(N : Normal, A : Abnormal, B : Boundary) | N | N | N | B | B |
|  | Passed/Failed | P | P | P | P | P |
|  | Executed Date | 08/06 | 08/06 | 08/06 | 08/06 | 08/06 |
|  | Defect ID |  |  |  |  |  |

Note: UTCID02 chứng minh bộ sinh lấy số thứ tự LỚN NHẤT rồi +1 (không đếm số bản ghi) — thứ tự dữ liệu đưa vào cố ý đảo lộn.  
Note: UTCID04 là boundary hậu tố không parse được sang số → quay về `0001`; UTCID05 là boundary vượt trần định dạng `D4`, kết quả dài 5 chữ số.  
Note: Nhánh `IgnoreQueryFilters` (không cấp lại mã của PO đã xóa mềm) phụ thuộc query filter của EF Core nên thuộc integration test.
