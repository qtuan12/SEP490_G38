# UpdateDailyLogCommandHandler.Handle - Unit Test Suite Matrix

Class Name: `UpdateDailyLogCommandHandler`  
Function Name: `Handle(UpdateDailyLogCommand request, CancellationToken cancellationToken)`  
Created By: `DucHV`  
Executed By: `DucHV`

Test requirement: Passed `13`, Failed `0`, Untested `0`, N/A/B `6 / 5 / 2`, Total Test Cases `13`

| Condition | Precondition / Input / Output | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 | UTCID06 | UTCID07 | UTCID08 | UTCID09 | UTCID10 | UTCID11 | UTCID12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Condition | User is authenticated | O | O | O | O | O | O | O | O | O | O | O | O |
|  | DailyLog exists in DB | O |  | O | O | O | O | O | O | O | O | O | O |
|  | DailyLog does NOT exist |  | O |  |  |  |  |  |  |  |  |  |  |
|  | User is assigned engineer; handler business rule allows field log editing/reporting |  |  |  |  |  |  | O |  |  |  |  |  |
|  | User is not Admin/TechnicalManager, not Project Leader, and not assigned engineer |  |  | O |  |  |  |  |  |  |  |  |  |
|  | Project status is NOT InProgress |  |  |  | O |  |  |  |  |  |  |  |  |
|  | Task is locked |  |  |  |  | O |  |  |  |  |  |  |  |
|  | Ancestor task is obsolete |  |  |  |  |  |  |  |  |  |  | O |  |
|  | Edit window is expired |  |  |  |  |  |  |  |  |  | O |  |  |
|  | Images are replaced or cleared | O |  |  |  |  | O |  | O | O |  |  |  |
|  | Progress is unchanged while metadata/images change |  |  |  |  |  |  |  |  | O |  |  |  |
| Input | UpdateDailyLogCommand |  |  |  |  |  |  |  |  |  |  |  |  |
|  | `{`<br>`  LogId = 800,`<br>`  Description = "Updated description with new details",`<br>`  Images = ["http://site.com/old1.jpg", "http://site.com/new1.jpg"]`<br>`}` | O |  |  |  |  |  |  |  |  |  |  |  |
|  | `{`<br>`  LogId = 999,`<br>`  Description = "New Desc",`<br>`  Images = null`<br>`}` |  | O |  |  |  |  |  |  |  |  |  |  |
|  | `{`<br>`  LogId = 800,`<br>`  Description = "New Desc",`<br>`  Images = null`<br>`}` |  |  | O | O | O |  |  |  |  |  |  |  |
|  | `{`<br>`  LogId = 800,`<br>`  Description = "Multiple images",`<br>`  Images = ["1.jpg", "2.jpg", "3.jpg", "4.jpg", "5.jpg"]`<br>`}` |  |  |  |  |  | O |  |  |  |  |  |  |
|  | `{`<br>`  LogId = 800,`<br>`  Description = "New Description",`<br>`  Images = null`<br>`}` |  |  |  |  |  |  | O |  |  |  |  |  |
|  | `{`<br>`  LogId = 800,`<br>`  Description = "Desc",`<br>`  Images = null`<br>`}` |  |  |  |  |  |  |  | O |  |  |  |  |
|  | `{`<br>`  LogId = 800,`<br>`  Description = "New Description - Progress remains 50%",`<br>`  Images = ["new1.jpg", "new2.jpg"]`<br>`}` |  |  |  |  |  |  |  |  | O |  |  |  |
|  | `{`<br>`  LogId = 800,`<br>`  Description = "Late update",`<br>`  Images = null`<br>`}` |  |  |  |  |  |  |  |  |  | O |  |  |
|  | `{`<br>`  LogId = 800,`<br>`  Description = "Update obsolete branch",`<br>`  Images = null`<br>`}` |  |  |  |  |  |  |  |  |  |  | O |  |
|  | `{`<br>`  LogId = 800,`<br>`  Description = "Leader update",`<br>`  Images = null`<br>`}` |  |  |  |  |  |  |  |  |  |  |  | O |
| Input | CancellationToken.None | O | O | O | O | O | O | O | O | O | O | O | O |
| Confirm | Return |  |  |  |  |  |  |  |  |  |  |  |  |
|  | `{`<br>`  LogId = 800,`<br>`  TaskId = 100,`<br>`  Description = "Updated description with new details",`<br>`  OldProgressPercent = 20,`<br>`  Images = ["http://site.com/old1.jpg", "http://site.com/new1.jpg"],`<br>`  EditWindowHours = 24,`<br>`  CanEdit = true`<br>`}` | O |  |  |  |  |  |  |  |  |  |  |  |
|  | `{`<br>`  LogId = 800,`<br>`  TaskId = 100,`<br>`  Description = "Multiple images",`<br>`  Images = ["1.jpg", "2.jpg", "3.jpg", "4.jpg", "5.jpg"],`<br>`  EditWindowHours = 24,`<br>`  CanEdit = true`<br>`}` |  |  |  |  |  | O |  |  |  |  |  |  |
|  | `{`<br>`  LogId = 800,`<br>`  TaskId = 100,`<br>`  Description = "New Description",`<br>`  Images = [],`<br>`  EditWindowHours = 24,`<br>`  CanEdit = true`<br>`}` |  |  |  |  |  |  | O |  |  |  |  |  |
|  | `{`<br>`  LogId = 800,`<br>`  TaskId = 100,`<br>`  Description = "Desc",`<br>`  Images = [],`<br>`  EditWindowHours = 24,`<br>`  CanEdit = true`<br>`}` |  |  |  |  |  |  |  | O |  |  |  |  |
|  | `{`<br>`  LogId = 800,`<br>`  TaskId = 100,`<br>`  Description = "New Description - Progress remains 50%",`<br>`  OldProgressPercent = 40,`<br>`  NewProgressPercent = 50,`<br>`  Images = ["new1.jpg", "new2.jpg"],`<br>`  EditWindowHours = 24,`<br>`  CanEdit = true`<br>`}` |  |  |  |  |  |  |  |  | O |  |  |  |
|  | `{`<br>`  LogId = 800,`<br>`  TaskId = 100,`<br>`  Description = "Leader update",`<br>`  Images = [],`<br>`  EditWindowHours = 24,`<br>`  CanEdit = true`<br>`}` |  |  |  |  |  |  |  |  |  |  |  | O |
| Confirm | Exception |  |  |  |  |  |  |  |  |  |  |  |  |
|  | Throws `NotFoundException` — `BIZ_001`: `DailyLog với ID [999] không tồn tại.` |  | O |  |  |  |  |  |  |  |  |  |  |
|  | Throws `ForbiddenException` — `AUTH_002`: `Chỉ Trưởng dự án (Leader), Ban quản lý hoặc Kỹ sư được gán vào công việc mới được phép chỉnh sửa nhật ký thi công.` |  |  | O |  |  |  |  |  |  |  |  |  |
|  | Throws `BusinessException` — `ERR_PROJECT_NOT_ACTIVE`: `Dự án không ở trạng thái hoạt động, không thể thực hiện thao tác này.` |  |  |  | O |  |  |  |  |  |  |  |  |
|  | Throws `BusinessException` — `ERR_TASK_LOCKED`: `Công việc này đã được nghiệm thu và khóa tiến độ, không thể chỉnh sửa nhật ký thi công.` |  |  |  |  | O |  |  |  |  |  |  |  |
|  | Throws `BusinessException` — `ERR_EDIT_WINDOW_EXPIRED`: `Nhật ký thi công chỉ được phép chỉnh sửa trong vòng 24 giờ kể từ lúc tạo (cấu hình bởi Quản trị viên). Quá thời han, vui lòng tạo nhật ký mới hoặc liên hệ Quản trị viên.` |  |  |  |  |  |  |  |  |  | O |  |  |
|  | Throws `BusinessException` — `ERR_TASK_OBSOLETE`: `Không thể chỉnh sửa nhật ký vì công việc hoặc cấp cha [Obsolete parent] đã bị loại bỏ (obsolete).` |  |  |  |  |  |  |  |  |  |  | O |  |
| Confirm | Log message |  |  |  |  |  |  |  |  |  |  |  |  |
| Result | Type(N : Normal, A : Abnormal, B : Boundary) | N | A | A | A | A | B | N | B | N | A | A | N |
|  | Passed/Failed | P | P | P | P | P | P | P | P | P | P | P | P |
|  | Executed Date | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 |
|  | Defect ID |  |  |  |  |  |  |  |  |  |  |  |  |

