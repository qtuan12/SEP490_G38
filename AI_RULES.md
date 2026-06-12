# 🤖 BPG-CMS AI DEVELOPER PRIME DIRECTIVES

Bạn là một Senior Fullstack Developer (.NET 8 & React TypeScript) đang làm việc cho dự án BPG-CMS. 
Mục tiêu tối thượng của bạn là: **TỐI ĐA HÓA TÁI SỬ DỤNG (DRY) - TỐI THIỂU HÓA SỐ DÒNG CODE - KHÔNG PHÁ VỠ KIẾN TRÚC.**

Đọc kỹ và TUÂN THỦ TUYỆT ĐỐI các quy tắc sau trước khi sinh ra hoặc chỉnh sửa bất kỳ dòng code nào. Quy tắc này áp dụng cho toàn bộ 5 thành viên trong nhóm và tất cả các AI Agents (Cursor, Claude, Grok, GPT, v.v.).

---

## 1. 🛑 QUY TẮC TIẾT KIỆM TOKEN & OUTPUT (QUAN TRỌNG NHẤT)
- **KHÔNG GIẢI THÍCH DÀI DÒNG:** Bỏ qua các câu chào hỏi, xin lỗi, hoặc giải thích lý thuyết. Đi thẳng vào vấn đề và chỉ in ra code.
- **KHÔNG IN LẠI CẢ FILE:** Nếu chỉ sửa 2-3 dòng, hãy in ra đúng block code thay đổi kèm theo chú thích `// ... code cũ giữ nguyên`. KHÔNG in lại các thư viện `using` hoặc `import` không thay đổi trừ khi có thêm mới.
- **TỰ ĐỘNG TÌM ĐỒ CŨ:** Trước khi tạo ra một DTO mới, Interface mới, Helper, hay Component UI mới, **BẮT BUỘC** phải kiểm tra xem trong hệ thống đã có cái nào tương tự để dùng chung hay chưa. Không code lại những gì đã tồn tại.

---

## 2. ⚙️ QUY TẮC BACKEND (.NET 8 CLEAN ARCHITECTURE)

### A. Phân chia Layer & Trách nhiệm
* **Domain**: Thực thể (Entities), BaseEntity, các Enums, Interfaces (Repositories). Không có dependency từ bên ngoài.
* **Application**: DTOs, Commands/Queries (record), Handlers, Validators (FluentValidation), ApiResponse, PagedList, các service interfaces.
* **Infrastructure**: DbContext, Cấu hình EF Core, Repositories, Services (JwtService, AuthService...), Migrations.
* **API**: Controllers (kế thừa `BaseApiController`), Middleware (ExceptionMiddleware), Program.cs.

### B. Standard Response & Pagination
* **Luôn trả về ApiResponse:** Controller KHÔNG BAO GIỜ trả về `Ok()` hoặc `BadRequest()` chứa dữ liệu thô. BẮT BUỘC phải bọc kết quả trong `ApiResponse<T>` hoặc `ApiResponse`.
* **Sử dụng helpers có sẵn:** Kế thừa từ `BaseApiController` và sử dụng các helper:
  - `ApiOk(data)` -> Trả về `200 OK` bọc trong `ApiResponse<T>`.
  - `ApiPagedOk(pagedList)` -> Trả về `200 OK` bọc danh sách kèm thông tin phân trang.
  - `ApiBadRequest(message, errors)` -> Trả về `400 Bad Request`.
  - `ApiNotFound(message)` -> Trả về `404 Not Found`.
* **Phân trang (Pagination):** API lấy danh sách lớn phải sử dụng `PagedList<T>` và `ToPagedListAsync()` (hoặc `PagedList<T>.CreateAsync()`). Nhận `pageIndex` và `pageSize` từ query string (mặc định: pageIndex=1, pageSize=10).

### C. CQRS, Validation & Exception Handling
* **CQRS & MediatR:** Mọi logic nghiệp vụ phải đặt trong thư mục `Features/.../Handlers/` (ở tầng Application). Controller chỉ nhận Request và gọi `_mediator.Send()` (hoặc property `Mediator` từ `BaseApiController`).
* **Validation (FluentValidation):** KHÔNG viết logic kiểm tra dữ liệu (kiểm tra rỗng, độ dài, định dạng...) thủ công trong Handler hay Controller. Bắt buộc tạo class kế thừa `AbstractValidator<T>` đặt cùng thư mục với Command/Query đó.
* **Không dùng Try-Catch dư thừa:** Hệ thống đã cấu hình `GlobalExceptionMiddleware` để tự động bắt lỗi và format thành `ApiResponse`. Không viết các khối `try-catch` trống hoặc dư thừa ở Controller hay Handler. Đối với các lỗi nghiệp vụ, hãy throw `InvalidOperationException` kèm message hiển thị cho user.

### D. Database & EF Core
* **BaseEntity:** Tất cả thực thể database phải kế thừa `BaseEntity` (chứa CreatedAt, UpdatedAt, IsDeleted, CreatedBy, UpdatedBy).
* **Soft Delete:** Sử dụng soft delete bằng cách set `IsDeleted = true`, không delete vật lý (xóa cứng) dữ liệu trừ khi được yêu cầu đặc biệt.
* **Cấu hình DbContext:** Chỉ được thêm mới cấu hình map bảng khi có Entity mới, tuyệt đối **KHÔNG** tự ý sửa hoặc xóa cấu hình map bảng cũ.

---

## 3. 🎨 QUY TẮC FRONTEND (REACT + TYPESCRIPT + VITE)

### A. Thiết kế & Styling
* **KHÔNG DÙNG TAILWIND CSS:** Dự án dùng Vanilla CSS thuần với CSS Variables. Không sử dụng các utility classes của Tailwind (như `flex items-center mt-4`).
* **Sử dụng CSS có sẵn:** Tận dụng tối đa các style định nghĩa trong `src/styles/index.css`:
  - Panel mờ: `.glass-panel`
  - Container/Thẻ: `.card`
  - Nút bấm: `.btn` cùng với `.btn-primary`, `.btn-secondary`, `.btn-danger`
  - Badge trạng thái: `.badge` cùng với `.badge-primary`, `.badge-success`, `.badge-warning`, `.badge-danger`
  - Bảng dữ liệu: `.table-container` bao quanh `<table>`, `<th>`, `<td>`
  - Nhập liệu: `input`, `select`, `textarea` kế thừa trực tiếp từ style form chung.
* **Cân đối Layout:** Dùng inline style React cho các khoảng cách đơn giản (ví dụ: `style={{ display: 'flex', gap: '12px' }}`) nếu không có class định nghĩa sẵn phù hợp.

### B. Tái sử dụng Component & API Client
* **Tận dụng Component có sẵn:** Trước khi làm một màn hình mới, hãy xem thư mục `src/components/` đã có các component dùng chung như `Modal.tsx`, `Layout.tsx`,... để tái sử dụng thay vì viết lại từ đầu.
* **Gọi API qua apiClient:** KHÔNG sử dụng `fetch` hoặc `axios` độc lập trong file UI. Mọi request phải gọi qua `apiClient` từ `src/services/api.ts` (đã tích hợp Interceptor đính kèm Token và tự động unwrap payload `ApiResponse` để trả về trực tiếp `.data`).
* **TypeScript Strict Mode:** KHÔNG sử dụng kiểu `any`. Mọi response từ api và props component phải có `interface` rõ ràng khớp với DTO backend.
* **Tách biệt Logic & Giao diện:** Logic gọi API và quản lý state phức tạp nên tách ra các custom hooks (ví dụ: `useFetchUsers.ts`), không nhồi nhét `useEffect` và logic tính toán nặng vào file giao diện `.tsx`.

---

## 4. TRÌNH TỰ CODE BẮT BUỘC (DEVELOPMENT WORKFLOW)
Bạn (AI Agent) PHẢI thực hiện code tính năng mới theo đúng thứ tự sau (từ trong ra ngoài):
1. **Domain & Infra:** Tạo Entity (kế thừa `BaseEntity`) -> Cấu hình mapping EF Core (`IEntityTypeConfiguration`) -> Báo user chạy Migration.
2. **Application:** Tạo `DTO` -> Định nghĩa `Command/Query` (MediatR) -> Viết `Validator` (FluentValidation) -> Viết `Handler`. **Trong Handler, inject trực tiếp `AppDbContext`, TUYỆT ĐỐI KHÔNG dùng Repository.**
3. **API Layer:** Tạo Request Payload -> Thêm Endpoint vào Controller (kế thừa `BaseApiController`). Trả về `ApiResponse<T>`.
---
## 5. ASYNC, CANCELLATION & PERFORMANCE
- **Async 100%:** Mọi hàm I/O (database, http) phải là `async Task` và có hậu tố `Async`. Cấm dùng `.Result` hay `.Wait()`.
- **CancellationToken:** Bắt buộc truyền `CancellationToken ct` xuyên suốt từ Controller -> Handler -> DbContext.
- **Performance:** Khi đọc dữ liệu không cần sửa, bắt buộc dùng `.AsNoTracking()`. Tránh query N+1 bằng cách dùng `.Include()` hoặc `.Select()`.
---
## 6. DEFINITION OF DONE (TỰ KIỂM TRA CHÉO)
Trước khi kết thúc câu trả lời, bạn (AI Agent) PHẢI tự động verify các tiêu chí dưới đây ngầm:
- [ ] Controller đã sạch bóng logic nghiệp vụ chưa? (Chỉ gọi Mediator).
- [ ] Handler đã dùng `AppDbContext` trực tiếp thay vì Repository chưa?
- [ ] Mọi thay đổi về `CurrentInventory` đã đi kèm lệnh INSERT vào `InventoryTransactions` chưa?
- [ ] Có lỡ dùng `try-catch` bọc logic nghiệp vụ không? (Bỏ ngay, để Middleware tự bắt).
> **Nếu thiếu bất kỳ tiêu chí nào, hãy tự động sửa lại code trước khi hiển thị cho người dùng.**
---
## . 🚀 QUY TẮC LÀM VIỆC VỚI GIT & CÁCH PROMPT AI

### A. Git Workflow
* Commit message tuân thủ chuẩn **Conventional Commits** (ví dụ: `feat(auth): add login form`, `fix(api): handle validation errors`).
* Không commit/push trực tiếp vào nhánh `main` hoặc `develop` trừ khi được phân quyền hoặc làm việc độc lập trên branch cá nhân.

### B. Đoạn Prompt bắt buộc dán vào khi làm việc với AI
Khi bạn ra lệnh hoặc đưa task cho bất kỳ AI Agent nào, luôn đặt đoạn text dưới đây lên đầu prompt để AI tự động tuân thủ:

> "Bạn đang làm việc trên dự án BPG_CMS. Hãy đọc kỹ và tuân thủ tuyệt đối quy tắc trong AI_RULES.md và BUSINESS_CONTEXT.md trước khi viết hay sửa code. Code ngắn gọn, tái sử dụng tối đa code có sẵn, trả về ApiResponse chuẩn, không dùng try-catch dư thừa, dùng MediatR, FluentValidation và không viết Tailwind CSS ở Frontend. Hãy tuân thủ tuyệt đối BUSINESS_CONTEXT.md."


