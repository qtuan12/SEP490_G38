# UNIT TEST GUIDE — APPLICATION HANDLERS

**BPG-CMS | xUnit · Moq · FluentAssertions · MockQueryable**

> Đây là nguồn quy tắc chính thức khi viết hoặc refactor unit test cho các `CommandHandler` và `QueryHandler` trong tầng Application.  
> Nếu hướng dẫn unit test ở tài liệu khác mâu thuẫn với file này, ưu tiên file này.

## 1. Mục tiêu và phạm vi

Unit test của handler chỉ kiểm tra hành vi quan sát được qua giao diện công khai của `Handle`:

```text
Command/Query + CancellationToken + preconditions
                         ↓
                    Handler.Handle
                         ↓
             Returned result hoặc exception
```

### Được kiểm tra

- DTO, `ApiResponse<T>`, `PagedList<T>`, ID, `bool`, chuỗi hoặc giá trị trả về khác.
- Loại exception nghiệp vụ.
- `ErrorCode` khi nhiều nhánh cùng ném một loại exception.
- Các nhánh phân quyền, business rule và boundary được xử lý trực tiếp trong handler.
- Trường hợp hoàn thành không lỗi đối với handler trả về `Task` và không có dữ liệu.

### Không kiểm tra trong handler unit test

- Repository đã gọi `Add`, `Update`, `SaveChanges` bao nhiêu lần.
- Notification, realtime, email hoặc file upload đã được gửi.
- Entity nội bộ đã đổi trạng thái, soft-delete hoặc tăng/giảm số lượng.
- Transaction đã commit/rollback.
- Progress roll-up hoặc dữ liệu của aggregate khác đã thay đổi.
- SQL, EF Core mapping, database constraint, `sp_getapplock`, concurrency.
- HTTP status, middleware, controller, authentication pipeline.

Các nội dung trên thuộc integration test hoặc system test. Nếu một giá trị thay đổi được trả ra trong DTO thì được phép assert **giá trị DTO**, không assert trực tiếp entity hoặc mock interaction.

## 2. Nguồn sự thật trước khi thiết kế test

AI Agent phải đọc theo thứ tự:

1. Command/Query và kiểu trả về.
2. Handler phiên bản hiện tại.
3. Entity, constants, exception và service interface được handler dùng.
4. Validator tương ứng để dựng dữ liệu happy path hợp lệ.
5. Phần nghiệp vụ liên quan trong `BUSINESS_CONTEXT.md`.
6. Test cũ chỉ để nhận diện file cần thay thế, không dùng làm nguồn sự thật.

Nếu code và nghiệp vụ mâu thuẫn:

- Không sửa expected result để hợp thức hóa code sai.
- Nêu rõ điểm lệch.
- Nếu task cho phép sửa production code: thêm test thể hiện yêu cầu rồi sửa handler trong cùng thay đổi.
- Nếu task chỉ cho phép sửa test: không để test cố ý fail trong branch; ghi nhận khoảng trống để xử lý riêng.

## 3. Validation đúng tầng

Gọi trực tiếp `handler.Handle(...)` **không chạy** `FluentValidation` hoặc `ValidationBehavior`.

Vì vậy:

- Handler unit test chỉ kiểm tra guard/business rule nằm trong handler.
- Không viết handler test cho `NotEmpty`, `MaximumLength`, định dạng hoặc rule chỉ tồn tại trong validator.
- Validator chỉ test riêng khi task yêu cầu hoặc validator có custom rule đáng kể.
- Việc xác nhận MediatR pipeline thực sự chặn request không hợp lệ thuộc integration test.

## 4. Số lượng test case

Không đặt quota 10–15 test cho mỗi handler. Số test được quyết định bởi các **kết quả quan sát được khác nhau**, không bởi độ lớn của bảng báo cáo.

Một bộ test gọn thường gồm:

- Một happy-path đại diện.
- Mỗi nhánh exception nghiệp vụ độc lập một test.
- Mỗi nhánh permission độc lập một test success; một test forbidden cuối cùng.
- Boundary chỉ khi nó làm thay đổi output hoặc exception.
- Các biến thể output thật sự khác nhau.

Không tạo nhiều test chỉ vì:

- Nội dung chuỗi khác nhau nhưng đi cùng một nhánh.
- Nhiều role cùng đi qua một điều kiện.
- Muốn đủ số cột trong file test report.
- Muốn kiểm tra side effect đã được chuyển sang integration test.

## 5. Cấu trúc file test

```csharp
public class UpdateDailyLogCommandHandlerTests
{
    private const long CurrentUserId = 10;
    private const long LogId = 100;

    private readonly Mock<IUnitOfWork> _mockUow;
    private readonly Mock<ICurrentUserService> _mockCurrentUserService;
    private readonly Mock<IGenericRepository<DailyLog>> _mockLogRepo;
    private readonly UpdateDailyLogCommandHandler _handler;

    public UpdateDailyLogCommandHandlerTests()
    {
        // Chỉ setup baseline hợp lệ và dependency dùng chung.
    }

    // Success
    // Exception
    // Builders và Setup helpers
}
```

Quy tắc:

- Một handler tương ứng một file test.
- Constructor chỉ chứa baseline hợp lệ, nhỏ và dễ nhìn.
- Mỗi test chỉ override precondition đang kiểm tra.
- Dùng `// Arrange`, `// Act`, `// Assert` khi test không còn tự giải thích được.
- Không giữ mock field, repository setup hoặc helper không được test nào sử dụng.
- Dependency cố định, chỉ cần giúp flow chạy, nên dùng stub dùng chung thay vì class-level mock.

## 6. Mock và stub dependency

### 6.1 Setup đúng API mà handler gọi

- Handler gọi `Query()` thì setup `Query()` bằng `BuildMock()`.
- Handler gọi `GetByIdAsync`, `FindAsync`, `FirstOrDefaultAsync`, `AnyAsync` thì setup đúng phương thức đó.
- Không setup cả hai kiểu “cho chắc”.
- Với predicate, chạy predicate trên danh sách in-memory để dữ liệu test phản ánh đúng điều kiện.

```csharp
_mockRepo
    .Setup(repository => repository.AnyAsync(
        It.IsAny<Expression<Func<Supplier, bool>>>(),
        It.IsAny<CancellationToken>()))
    .Returns((Expression<Func<Supplier, bool>> predicate, CancellationToken _) =>
        Task.FromResult(existingSuppliers.AsQueryable().Any(predicate)));
```

### 6.2 Stub mọi dependency async được `await`

Dependency không được assert vẫn phải trả về `Task.CompletedTask` hoặc kết quả hợp lệ để success flow không gặp `await null`.

Ưu tiên helper hiện có:

```csharp
ServiceStubFactory.RealtimeSender()
ServiceStubFactory.NotificationService()
ServiceStubFactory.ProgressRollupService()
```

Không thêm `Verify()` cho các stub này.

### 6.3 Chỉ giữ mock thực sự cần điều khiển

Giữ `Mock<T>` ở cấp class khi nhiều test cần thay đổi setup hoặc dependency ảnh hưởng đến output/exception.

Nếu dependency:

- chỉ được inject vào constructor;
- luôn có cùng hành vi;
- và không phải đối tượng test;

thì dùng stub cục bộ hoặc `ServiceStubFactory`, không tạo field riêng.

### 6.4 Mock AutoMapper không được tự tạo đáp án

Sai:

```csharp
_mockMapper.Setup(mapper => mapper.Map<DailyLogDto>(It.IsAny<DailyLog>()))
    .Returns(ExpectedDto());
```

Setup trên có thể làm test pass dù handler đưa sai entity vào mapper.

Đúng:

```csharp
_mockMapper.Setup(mapper => mapper.Map<DailyLogDto>(It.IsAny<DailyLog>()))
    .Returns((DailyLog source) => new DailyLogDto
    {
        LogId = source.LogId,
        TaskId = source.TaskId,
        Description = source.Description,
        NewProgressPercent = source.NewProgressPercent
    });
```

Có thể dùng AutoMapper profile thật khi mapping là phần quan trọng của output và việc khởi tạo profile vẫn nhẹ.

## 7. Tái sử dụng test data

Tạo một bộ dữ liệu hợp lệ mặc định và chỉ thay đổi field điều khiển nhánh test:

```csharp
private static UpdateDailyLogCommand ValidCommand(
    long logId = LogId,
    string description = "Updated site progress",
    List<string>? images = null)
    => new()
    {
        LogId = logId,
        Description = description,
        Images = images ?? ["daily-log-01.jpg"]
    };
```

Nguyên tắc:

- Dùng giá trị thật, dễ đọc; không dùng placeholder mơ hồ như `<ValidValue>`.
- Dùng constants cho ID và giá trị lặp lại.
- Dùng builder cho entity graph hợp lệ.
- Hai test cùng command thì gọi cùng builder; không tạo hai command chỉ khác câu chữ vô nghĩa.
- Không trừu tượng hóa quá mức khiến người mới phải mở nhiều helper mới hiểu dữ liệu.
- `CancellationToken.None` là input mặc định; chỉ thêm test cancellation khi handler có hành vi cancellation riêng.

## 8. Naming convention

```text
UTCID{xx}_Handle_{Precondition}_Should{ExpectedOutcome}
```

Ví dụ:

```text
UTCID01_Handle_ValidRequestByTechnicalManager_ShouldReturnDailyLogDto
UTCID05_Handle_TaskLocked_ShouldThrowBusinessException
UTCID09_Handle_EditWindowExpired_ShouldThrowExpectedErrorCode
```

Tên test chỉ mô tả output hoặc exception. Không hứa side effect không được assert:

```text
UTCID01_Handle_ValidRequest_ShouldCreateLogAndNotifyLeader // Sai
```

`N`, `A`, `B` được ghi trong test design/report; không cần nhét vào code nếu tên `UTCID` đã map được sang tài liệu.

## 9. Fact và Theory

Dùng `[Theory]` khi toàn bộ setup và assertion giống nhau, chỉ thay đổi một vài scalar.

Dùng `[Fact]` khi:

- Repository data hoặc entity graph khác.
- Đi qua nhánh permission/query khác.
- Kiểu output khác.
- Success và exception khác nhau.

Không dùng `if` hoặc `switch` lớn bên trong Theory để dựng từng kịch bản; khi đó tách thành `[Fact]`.

## 10. Assertion rules

### 10.1 Handler trả DTO

Một happy-path đại diện assert đầy đủ các field ổn định của DTO:

```csharp
result.Should().BeEquivalentTo(new DailyLogDto
{
    LogId = GeneratedLogId,
    TaskId = TaskId,
    Description = command.Description,
    NewProgressPercent = 50,
    Images = command.Images,
    EditWindowHours = 24,
    CanEdit = true
}, options => options
    .Excluding(dto => dto.LogDate)
    .Excluding(dto => dto.CreatedAt));
```

Các success test còn lại chỉ assert field bị ảnh hưởng bởi precondition.

### 10.2 `ApiResponse<T>`

Assert `Success` và `Data`. Chỉ assert `Message` khi wording là contract nghiệp vụ bắt buộc.

```csharp
result.Success.Should().BeTrue();
result.Data.Should().Be(GeneratedReceiptId);
```

### 10.3 `PagedList<T>`

Assert:

- Items được trả về đúng.
- Filter/sort/page làm thay đổi kết quả đúng.
- Metadata phân trang liên quan.

Không assert query/repository đã được gọi.

### 10.4 Giá trị đơn

Với `bool`, ID, string hoặc enum, assert giá trị chính xác.

### 10.5 Handler không trả dữ liệu

Với `IRequestHandler<TCommand>` trả về `Task`, success case chỉ có output quan sát được là hoàn thành không lỗi:

```csharp
Func<Task> act = () => _handler.Handle(command, CancellationToken.None);
await act.Should().NotThrowAsync();
```

Không dùng `Verify()` để biến nó thành interaction test. Hiệu ứng lưu/gửi thực tế được kiểm tra ở integration test.

### 10.6 Exception

```csharp
Func<Task> act = () => _handler.Handle(command, CancellationToken.None);

var exception = await act.Should().ThrowAsync<BusinessException>();
exception.Which.ErrorCode.Should().Be(ErrorCodes.InvalidTransition);
```

Quy tắc:

- Luôn assert loại exception cụ thể nhất.
- Khi nhiều nhánh dùng cùng exception type, assert `ErrorCode`.
- Chỉ assert toàn bộ message khi message là contract bắt buộc hoặc exception không có mã ổn định.
- Không bắt buộc `.WithMessage(...)` cho wording tiếng Việt có thể được chỉnh.

### 10.7 Thời gian runtime

- Không assert bằng tuyệt đối với `DateTime.UtcNow`.
- Field timestamp không phải trọng tâm có thể exclude khỏi `BeEquivalentTo`.
- Nếu timestamp là output quan trọng, dùng khoảng thời gian hoặc `BeCloseTo`.
- Với cửa sổ thời gian, dùng dữ liệu cách boundary một khoảng an toàn để tránh flaky test; muốn test chính xác điểm cắt thì production code nên inject clock.

## 11. Permission rules

Test theo nhánh code, không theo số lượng role:

```text
Cùng một điều kiện role       → một success đại diện
Khác query/nhánh permission   → một success cho mỗi nhánh
Rule riêng của một role       → success/fail riêng cho rule đó
Không thỏa nhánh nào          → một forbidden
```

Ví dụ Technical Manager, Project Leader và Task Assignee đi qua ba nhánh độc lập thì cần ba success case. Director và Technical Manager cùng đi qua một `IsInAnyRole(...)` thì chỉ cần một role đại diện, trừ khi có rule riêng.

## 12. Boundary rules

Chỉ thêm boundary khi handler đang test trực tiếp sử dụng boundary và nó làm đổi output/exception:

- Min/max số lượng hoặc phần trăm.
- Bằng giá trị hiện tại.
- Ngay trước/ngay sau cửa sổ thời gian.
- Empty/null collection khi handler phân nhánh.
- `IsDeleted`, locked, obsolete hoặc completed khi handler kiểm tra.
- Thiếu config/fallback khi fallback thể hiện trong output hoặc exception.

Không lặp lại boundary chỉ được FluentValidation xử lý trong handler test.

## 13. Persistence và transaction failure

Không bắt buộc test `SaveChangesAsync` ném một `Exception` chung nếu handler chỉ rethrow nguyên trạng. Test đó chủ yếu chứng minh hành vi của Moq/.NET và không kiểm tra business contract.

Chỉ thêm persistence-failure test khi handler:

- chuyển lỗi hạ tầng thành exception nghiệp vụ cụ thể;
- trả output khác khi lưu thất bại;
- có logic catch riêng làm thay đổi hành vi quan sát được.

Atomicity, rollback và không lưu dữ liệu một phần phải được kiểm tra bằng integration test với database.

## 14. Điều cấm

```csharp
_mockRepo.Verify(...);                         // Không kiểm tra side effect
_mockUow.Verify(...);
_mockNotificationService.Verify(...);
_mockRealtimeSender.Verify(...);

entity.Status.Should().Be(...);                // Không assert state nội bộ
entity.IsDeleted.Should().BeTrue();

await act.Should().ThrowAsync<Exception>();    // Quá chung khi có exception cụ thể
```

Ngoài ra không:

- Đặt quota test case.
- Copy nguyên setup lớn sang nhiều test.
- Dùng random data làm test khó lặp lại.
- Giữ mock/setup không dùng.
- Để test cố ý fail trong branch bàn giao.
- Sửa production code ngoài phạm vi chỉ để test dễ viết.

## 15. Quy trình bắt buộc cho AI Agent

1. Đọc source theo mục 2.
2. Liệt kê các output/exception và nhánh permission độc lập.
3. Loại các side effect khỏi phạm vi UT.
4. Chọn một valid command/query và valid entity graph dùng chung.
5. Viết một happy-path đại diện.
6. Viết các exception và permission branch cần thiết.
7. Thêm boundary có ý nghĩa.
8. Stub dependency async; xóa mock/setup không dùng.
9. Chạy test cụ thể, sau đó chạy test project hoặc feature liên quan.
10. Quét lại để bảo đảm không còn `Verify()` hoặc assertion state nội bộ.

Lệnh kiểm tra tham khảo:

```powershell
dotnet test BPG_CMS_BE/test/BPG.Application.UnitTests/BPG.Application.UnitTests.csproj --no-restore --filter "FullyQualifiedName~UpdateDailyLogCommandHandlerTests"
rg -n "\.Verify\(|WithMessage\(" BPG_CMS_BE/test/BPG.Application.UnitTests
```

`WithMessage` trong kết quả quét không tự động là sai, nhưng phải có lý do contract rõ ràng.

## 16. Definition of Done

- [ ] Đã đọc handler, input/output, validator và business context liên quan.
- [ ] Có một happy-path đại diện cho output.
- [ ] Mỗi kết quả exception nghiệp vụ độc lập đã được phủ.
- [ ] Permission được phủ theo nhánh code, không theo danh sách role.
- [ ] Boundary chỉ giữ khi ảnh hưởng output/exception.
- [ ] Không assert entity state hoặc verify side effect.
- [ ] Dependency async trong success path đã được stub.
- [ ] Không còn mock, setup, helper hoặc using không dùng.
- [ ] Test data hợp lệ được tái sử dụng, không copy-paste vô nghĩa.
- [ ] Test chạy độc lập, lặp lại được và không phụ thuộc thứ tự.
- [ ] Test liên quan đã pass.

## Ghi nhớ một câu

> Unit test handler của BPG-CMS kiểm tra **input và precondition → output hoặc exception**; phủ nhánh nghiệp vụ có ý nghĩa, dùng chung dữ liệu hợp lệ, không verify side effect và không chạy theo quota test case.
