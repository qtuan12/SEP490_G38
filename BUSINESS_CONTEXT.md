# BPG-CMS Project Context

> **Mục đích**: File này cung cấp **ranh giới nghiệp vụ và các quy tắc bất biến** của hệ thống.  

---

## 1. Tổng quan cốt lõi

- **Hai bài toán chính**:
  1. **Quản lý thi công**: WBS, nhật ký hàng ngày (ảnh, tiến độ), nghiệm thu phase, xử lý sự cố (incident) và tạo rework task.
  2. **Kiểm soát vật tư**: Kho ảo (virtual inventory) theo từng công trình, đối chiếu với định mức (BOQ), yêu cầu vật tư (MR), PO, nhập/xuất kho, xử lý vật tư thừa (surplus), điều chỉnh tồn kho.

- **Ranh giới thiết kế (KHÔNG ĐƯỢC VƯỢT)**:
  - **Thuần nội bộ**: Không chat, ticket, customer portal, bảo hành.
  - **Phi tài chính (Non-Accounting)**: Không quản lý dòng tiền, công nợ, VAT, bút toán kế toán. Mọi giá trị tiền chỉ là **tham khảo**.
  - **Không quy đổi đơn vị**: MVP chỉ dùng một base unit. Các bảng `ConversionRate` hardcode = 1.0.
  - **Không Repository pattern**: Dùng `DbContext` trực tiếp trong MediatR handlers.

---

## 2. Các thực thể và vòng đời chính (tóm tắt)

| Entity | Vòng đời / Ghi chú |
|--------|-------------------|
| **Project** | Draft → Active → Paused → Completed → Closed. Chỉ TPKT mới tạo/sửa/xóa (khi Draft), kích hoạt, tạm dừng. Khi kích hoạt: WBS có ít nhất 1 task và deadline >= PlannedStart. |
| **Phase** | Draft → InProgress → Approved (frozen). Nghiệm thu (TPKT) khi tất cả task 100% và có ảnh. Hủy nghiệm thu trong 7 ngày (có lý do), mở khóa task. |
| **Task** | New → Assigned → InProgress → Done → Accepted (hoặc Obsolete). Chỉ tăng % qua DailyLog; giảm chỉ do TPKT qua Incident. Task con có deadline ≤ task cha. Obsolete bị loại khỏi tính tiến độ phase. |
| **Material Request (MR)** | Leader tạo. Hệ thống **hold BOQ** ngay khi submit. Phân luồng: *Within BOQ* → Accountant duyệt → tạo PO; *Over BOQ* → Accountant trình → Director duyệt → tạo PO. Nếu từ chối → nhả hold. |
| **Purchase Order (PO)** | Accountant tạo. Draft → Sent → PartiallyReceived → FullyReceived → Closed. Hủy nếu chưa có GoodsReceipt. |
| **Goods Receipt (GR)** | Leader tạo. Nhập số thực nhận (≤ PO còn lại), upload ảnh phiếu giao hàng. Sau duyệt → cộng stock, cập nhật PO. **Immutable**. |
| **Material Issuance** | Leader tạo. Xuất vật tư cho task, kiểm tra đủ stock (hard block). **Immutable**. |
| **CurrentInventory** | Bảng tổng hợp stock realtime. Có `RowVersion` chống concurrent. **Không bao giờ âm**. |
| **InventoryTransactions** | **Bảng sổ cái bất biến (append‑only)**. Mỗi lần `CurrentInventory` thay đổi (nhập, xuất, điều chỉnh, chuyển kho) → **bắt buộc** INSERT một dòng vào bảng này với `TransactionType`, `QuantityChange`, `BalanceAfter`. |
| **Incident** | Hai nhánh: (1) Thi công: SE tạo → PL đánh giá thiệt hại → TPKT quyết định (giảm % task, obsolete, tạo rework task). (2) Vật tư kho: PL tạo → Kế toán xác minh → tạo phiếu giảm tồn kèm incident. |
| **Surplus** | Từ màn hình Inventory, bấm "Xử lý vật tư thừa" → **auto tạo batch** chứa toàn bộ tồn kho. Với mỗi item, PL tạo action: *Return* (Accountant confirm), *Transfer* (TPKT duyệt + 2 bước xác nhận), *Liquidation* (Accountant confirm). |
| **Inventory Adjustment** | *Increase*: PL tạo → auto duyệt. *Decrease*: **Chỉ Accountant tạo**, phải gắn IncidentId, Director duyệt. |

---

## 3. Các business rules bất di bất dịch (KHÔNG THỂ THƯƠNG LƯỢNG)

1. **Tiến độ task**: Chỉ tăng qua DailyLog. Giảm chỉ do TPKT qua Incident (có damage assessment).
2. **BOQ hold**: Ngay khi submit MR → hold quota. Nếu MR bị từ chối → nhả quota.
3. **Direct Purchase (khẩn cấp)**:
   - Leader tạo, bắt buộc ảnh hóa đơn, chỉ chọn vật tư trong BOQ.
   - **Hệ thống tự động sinh PO (trạng thái AutoClosed) và GoodsReceipt (đã Approved)** → **cộng stock ngay** để thợ dùng.
   - Kế toán post‑audit (chỉ để giải ngân bên ngoài); nếu sai sót thì tạo adjustment sau.
4. **Không xuất kho âm**: Mọi issuance, adjustment giảm đều bị chặn nếu không đủ stock.
5. **Immutable records**: GoodsReceipt, MaterialIssuance, PhaseAcceptance, InventoryAdjustment (sau duyệt) – **không sửa/xóa**. Sai sót xử lý bằng adjustment hoặc surplus.
6. **Ghi nhận thẻ kho (Ledger)**: Bất cứ khi nào `CurrentInventory.Quantity` thay đổi (nhập, xuất, điều chỉnh, chuyển kho) → **bắt buộc** INSERT một dòng vào `InventoryTransactions` với đầy đủ `TransactionType`, `QuantityChange`, `BalanceAfter`. Bảng này **append‑only** (không update/delete).
7. **Surplus batch**: Không tạo thủ công từng vật tư. Chỉ có một nút "Xử lý vật tư thừa" trên màn Inventory → auto tạo batch.
8. **Decrease adjustment**: Chỉ Accountant mới được tạo, phải có `IncidentId`, Director duyệt.
9. **Task deadline con ≤ deadline task cha**; khi điều chỉnh deadline (nếu đang in progress) phải ghi log lý do.
10. **Nghiệm thu phase**: Chỉ khi tất cả task 100% và có ảnh. Hủy nghiệm thu trong 7 ngày, phải có lý do.
11. **Mỗi dự án chỉ có một Project Leader** tại một thời điểm.

---

## 4. Luồng nghiệp vụ điển hình (AI cần nắm)

### 4.1. Material Request vượt BOQ
Leader tạo → System gắn Over BOQ → Accountant kiểm tra (có thể từ chối) → trình Director → Director duyệt → Accountant tạo PO → (sau đó Goods Receipt, Issuance).

### 4.2. Incident dẫn đến Rework Task
SE tạo incident (ảnh, mô tả) → PL đánh giá thiệt hại → TPKT xác nhận → TPKT đánh dấu task cũ Obsolete, tạo Rework Task mới.  
*Nếu deadline Rework > deadline phase → cảnh báo đỏ lên Director.*

### 4.3. Surplus – xử lý cuối dự án
PL vào màn Inventory → bấm "Xử lý vật tư thừa" → system tạo batch.  
Với mỗi item: PL chọn action (Return/Transfer/Liquidation) → action được xử lý theo phân quyền (Accountant/TPKT) → stock điều chỉnh tự động khi action hoàn tất.

### 4.4. Nhập kho & Ledger
Leader tạo GoodsReceipt từ PO → nhập số thực nhận → submit → system cập nhật `CurrentInventory` (+ quantity) **và đồng thời** INSERT dòng `InventoryTransactions` (TransactionType = GoodsReceipt, QuantityChange = +quantity, BalanceAfter = mới).

### 4.5. Direct Purchase (khẩn cấp) – auto stock
Leader tạo Direct Purchase Request (kèm ảnh hóa đơn) → system tự sinh PO (AutoClosed) và GoodsReceipt (Approved) → `CurrentInventory` tăng ngay → thợ có thể xuất dùng. Kế toán sau đó post‑audit.

---

## 5. Phân quyền tóm tắt

| Role | Quyền chính |
|------|-------------|
| **Technical Manager (TPKT)** | Tạo/sửa/xóa project (Draft), kích hoạt, tạm dừng, upload design, lập WBS, nghiệm thu phase, hủy nghiệm thu, đánh dấu task obsolete, giảm % task (qua incident), khai báo BOQ, xem kho tất cả dự án, duyệt transfer surplus. |
| **Project Leader (PL)** | Thêm/xóa member, tạo/sửa/xóa task (khi 0%), assign task, cập nhật daily log (tăng %), tạo MR, tạo GoodsReceipt, tạo issuance, tạo direct purchase, tạo surplus batch & actions, xác nhận transfer, tạo increase adjustment, xem kho dự án mình. |
| **Site Engineer (SE)** | Xem design, xem WBS, cập nhật daily log (tăng %), comment, tạo incident (báo cáo sơ bộ). |
| **Accountant** | Xem BOQ, xem kho, duyệt MR (within BOQ), trình MR over BOQ, tạo PO, hủy PO, xử lý surplus return/liquidation, tạo decrease adjustment (kèm incident), trình Director duyệt. |
| **Director** | Xem dashboard, báo cáo, duyệt over‑BOQ request, duyệt decrease adjustment. |
| **Admin** | Quản lý user (CRUD, role, khóa/mở), quản lý danh mục vật tư (category, material, unit, supplier), xem audit log, cấu hình hệ thống. |

---

## 6. Tech stack & coding conventions (nhắc nhanh)

- **Backend**: .NET 8, EF Core, MediatR, FluentValidation, JWT, BCrypt.
- **Frontend**: React 19, TypeScript, Vite, Tailwind, Ant Design hoặc shadcn/ui.
- **Kiến trúc**: Clean Architecture (Domain – Application – Infrastructure – API).
- **Response**: Luôn dùng `ApiResponse<T>`, controller kế thừa `BaseApiController`.
- **Validation**: FluentValidation + MediatR pipeline `ValidationBehavior`.
- **Audit**: `AuditableEntityInterceptor` tự động set CreatedAt/By, UpdatedAt/By.
- **Soft delete**: Global query filter cho `BaseEntity.IsDeleted`.
- **Không Repository**: Dùng `DbContext` trực tiếp trong handlers.
- **Frontend data fetching**: Dùng `@tanstack/react-query`, **không tự viết useApi**.

---

## 7. Cách prompt AI hiệu quả

Khi yêu cầu AI sinh code cho một feature, hãy **copy các phần liên quan** từ file này vào prompt, đặc biệt là:

- **Business rules** (mục 3) nếu feature liên quan đến stock, MR, PO, adjustment.
- **Luồng nghiệp vụ** (mục 4) tương ứng.
- **Phân quyền** (mục 5) để AI biết ai được phép làm gì.
- **Yêu cầu bắt buộc** như: "Phải ghi `InventoryTransactions` mỗi khi stock thay đổi" hoặc "Direct Purchase phải auto sinh PO và GoodsReceipt".

**Ví dụ prompt**:
> "Tạo API tạo GoodsReceipt cho PO. Theo business rule: không được nhập quá số lượng còn lại của PO. Sau khi duyệt, cập nhật `CurrentInventory` (+ quantity) và INSERT một dòng vào `InventoryTransactions` với TransactionType = 1 (GoodsReceipt). Dùng MediatR, FluentValidation, trả về `ApiResponse`."
