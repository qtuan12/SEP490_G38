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

### E. Sử dụng Constants (Tránh Magic Strings)
* **Tuyệt đối KHÔNG hardcode các chuỗi ký tự (Magic Strings)** cho các giá trị hệ thống như Roles, Error Codes, Response Messages, System Settings, Statuses, Notification Types, Entity Types, v.v.
* **Bắt buộc sử dụng các class Constants** đã được định nghĩa tập trung trong namespace `BPG.Domain.Constants` (ví dụ: `UserRole`, `PolicyNames`, `ErrorCodes`, `ResponseMessages`, `SystemConfigKeys`, `TypeConstants`, `StatusConstants`, v.v.).

### F. Sử dụng AutoMapper (Mapping)
* **Quy định bắt buộc:** KHÔNG viết hàm map thủ công (như các hàm static `FromEntity`, `ToEntity` tự chế) hoặc khởi tạo `new Dto { ... }` gán từng trường dữ liệu tĩnh trong Handlers. Bắt buộc sử dụng `IMapper` (AutoMapper) được tiêm qua Constructor.
* **Đăng ký Mapping:** Định nghĩa cấu hình map tại [MappingProfile.cs](file:///d:/Semester_9_SU26/SEP490/Project/SEP490_G38/BPG_CMS_BE/src/BPG.Application/Common/Mappings/MappingProfile.cs).
  - Ví dụ đăng ký:
    ```csharp
    CreateMap<User, UserDto>()
        .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.UserId.ToString()))
        .ForMember(dest => dest.Role, opt => opt.MapFrom(src => 
            src.UserRoles != null && src.UserRoles.Any() 
                ? src.UserRoles.FirstOrDefault().Role.RoleName 
                : string.Empty));
    ```
  - Ví dụ sử dụng trong Handler:
    ```csharp
    private readonly IMapper _mapper;
    // Constructor...
    var userDto = _mapper.Map<UserDto>(user);
    var userListDto = _mapper.Map<List<UserDto>>(users);
    ```

### G. Sử dụng Notification Engine (Realtime & DB Notifications)
* **Quy định sử dụng:** Khi cần gửi thông báo đến người dùng trong bất kỳ API/Handler nào (ví dụ: tạo mới nhật ký, phê duyệt, bình luận, v.v.), **bắt buộc** tiêm `INotificationService` qua Constructor để gọi.
* **Cấm gọi trực tiếp:** Cấm tự tạo HubContext hoặc bắn SignalR trực tiếp từ các module khác để gửi thông báo.
* **Các phương thức hỗ trợ:**
  1. **Gửi cho 1 User cụ thể:**
     ```csharp
     await _notificationService.SendNotificationAsync(userId, title, content, notificationType, referenceType, referenceId, ct);
     ```
  2. **Gửi cho TOÀN BỘ User active:**
     ```csharp
     await _notificationService.SendNotificationToAllAsync(title, content, notificationType, referenceType, referenceId, ct);
     ```
  3. **Gửi cho toàn bộ User thuộc một Role:**
     ```csharp
     await _notificationService.SendNotificationToRoleAsync(roleName, title, content, notificationType, referenceType, referenceId, ct);
     ```

---

## 3. 🎨 QUY TẮC FRONTEND (REACT + TYPESCRIPT + VITE)

### A. Thiết kế & Styling
* **Hạn chế viết trực tiếp Tailwind Utility Classes trong trang Page:** Dự án có tích hợp Tailwind CSS v4 để xây dựng các component dùng chung (trong `src/components/ui/`). Tuy nhiên, khi viết các trang màn hình (`src/pages/`), lập trình viên và AI **không được viết trực tiếp các class Tailwind dài dòng** (như `flex justify-between items-center bg-gray-50 p-4`).
* **Sử dụng CSS và Component có sẵn:** Tận dụng tối đa các component UI dùng chung (`<Button>`, `<Card>`, `<Input>`, `<Select>`, `<DataTable>`, `<Badge>`) và các class CSS định nghĩa trong `src/index.css`:
  - Panel mờ: `.glass-panel`
  - Container/Thẻ: `.card`
  - Bảng dữ liệu: `.table-container` bao quanh `<table>`, `<th>`, `<td>`
* **Căn chỉnh Layout đơn giản:** Đối với các căn chỉnh layout nhỏ (như `gap`, `display: flex`), khuyến khích dùng inline style (ví dụ: `style={{ display: 'flex', gap: '12px' }}`) nếu không có class định nghĩa sẵn, giúp code JSX của trang Page luôn ngắn gọn, dễ đọc.

### B. Gọi API, Quản lý State & Form
* **Quản lý Data Fetching bằng React Query:** BẮT BUỘC dùng `@tanstack/react-query`. Không viết `useEffect` kết hợp với `apiClient` một cách thủ công để gọi dữ liệu và quản lý state. 
  - Sử dụng hook `useQuery` cho các thao tác đọc (GET).
  - Sử dụng hook `useMutation` cho các thao tác thay đổi dữ liệu (POST, PUT, DELETE).
* **Gọi API qua Service:** Mọi request API phải được định nghĩa trong thư mục `src/services/` (gọi qua `apiClient` từ `src/services/api.ts`). Không viết code gọi `fetch` hay `axios` trực tiếp trong file UI.
* **Xử lý Form & Validation:** Sử dụng `react-hook-form` kết hợp với `zod` để quản lý trạng thái form và tự động validate dữ liệu theo schema khớp với DTO của Backend.
* **TypeScript Strict Mode:** KHÔNG sử dụng kiểu `any`. Mọi response từ api và props component phải có `interface` rõ ràng khớp với DTO backend.

---

## 4. TRÌNH TỰ CODE BẮT BUỘC (DEVELOPMENT WORKFLOW)
Bạn (AI Agent) PHẢI thực hiện code tính năng mới theo đúng thứ tự sau (từ trong ra ngoài):
1. **Domain & Infra:** Tạo Entity (kế thừa `BaseEntity`) -> Cấu hình mapping EF Core (`IEntityTypeConfiguration`) -> Báo user chạy Migration.
2. **Application:** Tạo `DTO` -> Định nghĩa `Command/Query` (MediatR) -> Viết `Validator` (FluentValidation) -> Viết `Handler`. **Trong Handler, bắt buộc inject IUnitOfWork để truy cập các repository và lưu thay đổi, TUYỆT ĐỐI KHÔNG inject trực tiếp AppDbContext.**
3. **API Layer:** Tạo Request Payload -> Thêm Endpoint vào Controller (kế thừa `BaseApiController`). Trả về `ApiResponse<T>`.

---

## 5. ASYNC, CANCELLATION & PERFORMANCE
- **Async 100%:** Mọi hàm I/O (database, http) phải là `async Task` và có hậu tố `Async`. Cấm dùng `.Result` hay `.Wait()`.
- **CancellationToken:** Bắt buộc truyền `CancellationToken ct` xuyên suốt từ Controller -> Handler -> DbContext.
- **Performance:** Khi đọc dữ liệu không cần sửa, bắt buộc dùng `.AsNoTracking()`. Tránh query N+1 bằng cách dùng `.Include()` hoặc `.Select()`.
- **Phân trang:** Đối với các query lấy danh sách, bắt buộc kế thừa `PaginationRequest` và dùng extension async `ToPagedListAsync(request, ct)`.

---

## 6. EXCEPTION HANDLING & SECURITY RULES
- **DomainExceptions:** Khi xảy ra lỗi nghiệp vụ, hãy throw các Exception cụ thể (`NotFoundException`, `DuplicateEntryException`, `UnauthorizedException`, `ForbiddenException`) kế thừa từ `DomainException` trực tiếp tại Handler.
- **Không check null ở Controller**: Controller chỉ nhận command, gửi qua mediator và trả về `ApiOk`. Bỏ qua các khối `try-catch` hoặc kiểm tra kết quả null thủ công để trả về lỗi, hãy để `GlobalExceptionMiddleware` tự bắt exception và format thành `ApiResponse`.
- **JWT Standard Claims:** Chỉ sử dụng standard claims từ `System.Security.Claims` (`ClaimTypes.NameIdentifier` cho UserId, `ClaimTypes.Name` cho FullName, `ClaimTypes.Email` cho Email, và `ClaimTypes.Role` cho Roles). `CurrentUserService` chỉ đọc thông tin qua các standard claims này để giữ kích thước token gọn gàng và chuẩn chỉ.

---

## 7. DEFINITION OF DONE (TỰ KIỂM TRA CHÉO)
Trước khi kết thúc câu trả lời, bạn (AI Agent) PHẢI tự động verify các tiêu chí dưới đây ngầm:
- [ ] Controller đã sạch bóng logic nghiệp vụ và check null chưa? (Chỉ gửi qua Mediator và return ApiOk).
- [ ] Handler đã sử dụng `IUnitOfWork` (thông qua Repository<T>()) thay vì inject trực tiếp `AppDbContext` chưa?
- [ ] Các lỗi nghiệp vụ/không tìm thấy thực thể đã được xử lý bằng cách ném các Domain Exception phù hợp chưa?
- [ ] Token JWT phát hành và claims đọc từ `CurrentUserService` chỉ dùng standard `ClaimTypes` chưa?
- [ ] Mọi thay đổi về `CurrentInventory` đã đi kèm lệnh INSERT vào `InventoryTransactions` chưa?
- [ ] Có lỡ dùng `try-catch` bọc logic nghiệp vụ không? (Bỏ ngay, để Middleware tự bắt).
> **Nếu thiếu bất kỳ tiêu chí nào, hãy tự động sửa lại code trước khi hiển thị cho người dùng.**

---

## 8. 📝 QUY TẮC CẬP NHẬT TRẠNG THÁI (PROJECT-STATUS.md)
- **Tự động cập nhật tiến độ:** Mỗi khi hoàn thành code Backend, Frontend, viết Unit Test hoặc tài liệu cho bất kỳ task nào, AI Agent hoặc lập trình viên **BẮT BUỘC** phải cập nhật trạng thái của hạng mục đó trong file [PROJECT-STATUS.md](file:///d:/Semester_9_SU26/SEP490/Project/SEP490_G38/PROJECT-STATUS.md) (To Do ➔ 🚧 Đang làm ➔ ✅ Đã xong).
- **Đảm bảo tính đồng bộ:** Bảng theo dõi trong `PROJECT-STATUS.md` là nguồn tin cậy duy nhất giúp các thành viên nhóm và các AI Agent khác biết dự án đang phát triển đến đâu mà không cần bàn giao thủ công.

---

## 9. 🚀 QUY TẮC LÀM VIỆC VỚI GIT & CÁCH PROMPT AI

### A. Git Workflow
* Commit message tuân thủ chuẩn **Conventional Commits** (ví dụ: `feat(auth): add login form`, `fix(api): handle validation errors`).
* Không commit/push trực tiếp vào nhánh `main` hoặc `develop` trừ khi được phân quyền hoặc làm việc độc lập trên branch cá nhân.

### B. Đoạn Prompt bắt buộc dán vào khi làm việc với AI
Khi bạn ra lệnh hoặc đưa task cho bất kỳ AI Agent nào, luôn đặt đoạn text dưới đây lên đầu prompt để AI tự động tuân thủ:

> "Bạn đang làm việc trên dự án BPG_CMS. Hãy đọc kỹ và tuân thủ tuyệt đối quy tắc trong AI_RULES.md và BUSINESS_CONTEXT.md trước khi viết hay sửa code. Code ngắn gọn, tái sử dụng tối đa code có sẵn, trả về ApiResponse chuẩn thông qua GlobalExceptionMiddleware (ném Exception cụ thể từ Handler, không bắt try-catch hay check null ở Controller), dùng MediatR, FluentValidation, sử dụng IUnitOfWork/Repository thay vì inject trực tiếp AppDbContext vào Handler, và không viết Tailwind CSS ở Frontend. Hãy tuân thủ tuyệt đối BUSINESS_CONTEXT.md."

---

## 10. 🧪 QUY TẮC VIẾT UNIT TEST (xUnit + Moq + FluentAssertions)
Tất cả các Unit Test cho Handlers ở tầng Application phải tuân thủ nghiêm ngặt các nguyên tắc dưới đây để tránh lỗi test ảo (auto-pass nhưng chạy sai thực tế):

### A. Thiết Kế Test Case Theo Nghiệp Vụ Thực Tế (Tránh Bias Logic Code)
* **Bắt buộc đọc tài liệu nghiệp vụ (`BUSINESS_CONTEXT.md`, `dacta.md`):** Thiết kế kịch bản test dựa trên yêu cầu nghiệp vụ thực tế và các ràng buộc dữ liệu đầu vào. **TUYỆT ĐỐI KHÔNG** chỉ đọc code hiện tại của Handler rồi viết test copy lại logic đó (điều này sẽ tạo ra lỗi test bias, làm test luôn tự động pass (auto-pass) dù code của Handler có lỗi logic hoặc thiếu sót).
* **Viết Test phát hiện lỗi (Failing Tests are good):** Nếu tài liệu nghiệp vụ yêu cầu kiểm tra ràng buộc (ví dụ: cấm nhập tên rỗng sau khi trim, cấm trùng tên không phân biệt hoa thường, giới hạn ký tự nhập vào), nhưng trong code của Handler chưa xử lý hoặc xử lý thiếu:
  - **Phải viết test case đúng theo yêu cầu nghiệp vụ.**
  - **Mục tiêu là test case đó phải chạy THẤT BẠI (FAIL).**
  - Kết quả test thất bại chính là tín hiệu chỉ ra khoảng trống logic (logical gap) hoặc lỗi nghiệp vụ bị sót để lập trình viên/AI biết và vào cập nhật/sửa đổi code nguồn.

### B. Mock Đúng Phương Thức Thực Tế Được Gọi
* **Không lạm dụng `.Query().BuildMock()`:** Chỉ dùng `BuildMock()` trên `Query()` nếu Handler gọi `.Query()`.
* **Setup trực tiếp trên Repository:** Nếu Handler gọi các phương thức repository trực tiếp như `GetByIdAsync()`, `AnyAsync()`, `FindAsync()`, `FirstOrDefaultAsync()`, bạn **bắt buộc** phải setup chính xác các phương thức này trên mock repository. Nếu không, Moq sẽ trả về giá trị mặc định (`false` hoặc `null`), làm hỏng các ca kiểm thử trùng lặp/NotFound.

### C. Kỹ Thuật Mock Predicate Linh Hoạt (In-Memory Evaluation)
* Để kiểm thử chính xác các biểu thức logic (Lambda Expressions) truyền vào `AnyAsync`, `FindAsync`, `FirstOrDefaultAsync`, hãy chặn tham số `predicate` và chạy trực tiếp trên danh sách `in-memory` giả lập:
  ```csharp
  private void SetupAnyAsync(List<Supplier> existingSuppliers)
  {
      _mockSupplierRepo
          .Setup(r => r.AnyAsync(It.IsAny<Expression<Func<Supplier, bool>>>(), It.IsAny<CancellationToken>()))
          .Returns((Expression<Func<Supplier, bool>> predicate, CancellationToken ct) =>
              Task.FromResult(existingSuppliers.AsQueryable().Any(predicate)));
  }
  ```

### D. Thiết Kế Mock Data Khớp Với Business Context (Domain Rules)
* Dữ liệu đầu vào của các ca kiểm thử **phải tuân thủ đúng các ràng buộc của hệ thống** (đã định nghĩa trong FluentValidation).
* *Ví dụ:* Không viết test case thành công với `Rating = 0` hay `Status = "Suspended"` nếu FluentValidation chặn các giá trị này (Rating phải từ `1` đến `5` và Status chỉ được là `"Active"` hoặc `"Inactive"`).

### E. Kiểm Tra Nội Dung Ngoại Lệ & Kiểm Toán Tương Tác (Verify)
* **WithMessage:** Bắt buộc sử dụng `.WithMessage("...")` của FluentAssertions để kiểm tra thông điệp lỗi cụ thể của `DomainException` (ví dụ: thông tin ID không tồn tại, tên trường trùng lặp).
* **Verify:** Kiểm tra xem `Update`, `AddRangeAsync` và `SaveChangesAsync` có được gọi đúng số lần và đúng tham số truyền vào hay không (`Times.Once()`, `Times.Never()`).
* **UTCID Naming:** Đặt tên test case theo định dạng `UTCIDXX_Handle_[Condition]_[ExpectedBehavior]` và phân loại rõ ràng:
  - **N (Normal):** Happy path, dữ liệu hợp lệ.
  - **A (Abnormal):** Trường hợp ngoại lệ, dữ liệu lỗi, không tìm thấy, trùng lặp.
  - **B (Boundary):** Dữ liệu cận biên (ví dụ: Rating = 1, Rating = 5, danh sách người nhận trống).
* **Số lượng test case quy chuẩn:**
  - Đối với mỗi Handler/Feature, hãy thiết lập **từ 10 đến 15 test cases** nhằm bao phủ đầy đủ tất cả các trường hợp hay gặp nhất (Normal, Abnormal, Boundary).
  - Tối thiểu có thể linh động tùy theo độ phức tạp của nghiệp vụ miễn là bao phủ hết Happy Path, nhưng **khuyến khích đạt mốc 10-15 test cases** để dễ dàng đồng bộ điền vào bảng báo cáo kiểm thử (Unit Test Report) của nhóm.




