# CreateDailyLogCommandHandler.Handle - Unit Test Suite Matrix

Class Name: `CreateDailyLogCommandHandler`  
Function Name: `Handle(CreateDailyLogCommand request, CancellationToken cancellationToken)`  
Created By: `DucHV`  
Executed By: `DucHV`

Test requirement: Passed `13`, Failed `0`, Untested `0`, N/A/B `3 / 8 / 2`, Total Test Cases `13`

| Condition | Precondition / Input / Output | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 | UTCID06 | UTCID07 | UTCID08 | UTCID09 | UTCID10 | UTCID11 | UTCID12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Condition | User is authenticated | O | O | O | O | O | O | O | O | O | O | O | O |
|  | Task exists in DB | O | O |  | O | O | O | O | O | O | O | O | O |
|  | Task does NOT exist |  |  | O |  |  |  |  |  |  |  |  |  |
|  | User is assigned engineer; handler business rule allows field log editing/reporting |  |  |  |  |  |  |  |  |  |  |  | O |
|  | User is not Admin/TechnicalManager, not Project Leader, and not assigned engineer |  |  |  |  |  |  |  |  |  |  | O |  |
|  | Project status is NOT InProgress |  |  |  | O |  |  |  |  |  |  |  |  |
|  | Ancestor task is locked |  |  |  |  | O |  |  |  |  |  |  |  |
|  | Task has active subtasks |  |  |  |  |  | O |  |  |  |  |  |  |
|  | Incomplete predecessor dependency exists |  |  |  |  |  |  | O |  |  |  |  | O |
|  | Existing progress is higher than requested progress |  |  |  |  |  |  |  | O | O | O |  |  |
|  | Decrease progress reason is missing |  |  |  |  |  |  |  |  | O |  |  |  |
|  | Parent task exists and must be recalculated |  |  |  |  |  |  |  |  |  | O |  |  |
| Input | CreateDailyLogCommand |  |  |  |  |  |  |  |  |  |  |  |  |
|  | `{`<br>`  TaskId = 100,`<br>`  NewProgressPercent = 50,`<br>`  Description = "Poured half slab",`<br>`  Images = ["1", "2", "3", "4", "5", "6", "7", "8"]`<br>`}` | O |  |  |  |  |  |  |  |  |  |  |  |
|  | `{`<br>`  TaskId = 100,`<br>`  NewProgressPercent = 100,`<br>`  Description = "Finished Slab",`<br>`  Images = []`<br>`}` |  | O |  |  |  |  |  |  |  |  |  |  |
|  | `{`<br>`  TaskId = 999,`<br>`  NewProgressPercent = 50,`<br>`  Description = "",`<br>`  Images = []`<br>`}` |  |  | O |  |  |  |  |  |  |  |  |  |
|  | `{`<br>`  TaskId = 100,`<br>`  NewProgressPercent = 50,`<br>`  Description = "",`<br>`  Images = []`<br>`}` |  |  |  | O | O | O |  |  |  |  | O |  |
|  | `{`<br>`  TaskId = 100,`<br>`  NewProgressPercent = 10,`<br>`  Description = "Trying to progress despite incomplete predecessor",`<br>`  Images = []`<br>`}` |  |  |  |  |  |  | O |  |  |  |  |  |
|  | `{`<br>`  TaskId = 100,`<br>`  NewProgressPercent = 30,`<br>`  Description = "Correction needed",`<br>`  Images = []`<br>`}` |  |  |  |  |  |  |  | O |  |  |  |  |
|  | `{`<br>`  TaskId = 100,`<br>`  NewProgressPercent = 30,`<br>`  Description = "",`<br>`  Images = []`<br>`}` |  |  |  |  |  |  |  |  | O |  |  |  |
|  | `{`<br>`  TaskId = 100,`<br>`  NewProgressPercent = 50,`<br>`  Description = "Decreasing child task progress",`<br>`  Images = []`<br>`}` |  |  |  |  |  |  |  |  |  | O |  |  |
|  | `{`<br>`  TaskId = 100,`<br>`  NewProgressPercent = 0,`<br>`  Description = "Site inspection, no progress yet",`<br>`  Images = []`<br>`}` |  |  |  |  |  |  |  |  |  |  |  | O |
| Input | CancellationToken.None | O | O | O | O | O | O | O | O | O | O | O | O |
| Confirm | Return |  |  |  |  |  |  |  |  |  |  |  |  |
|  | `{`<br>`  LogId = 800,`<br>`  TaskId = 100,`<br>`  TaskName = "Concrete Slab",`<br>`  CreatorName = "Admin User",`<br>`  OldProgressPercent = 20,`<br>`  NewProgressPercent = 50,`<br>`  Description = "Poured half slab",`<br>`  Images = ["1", "2", "3", "4", "5", "6", "7", "8"],`<br>`  EditWindowHours = 24,`<br>`  CanEdit = true`<br>`}` | O |  |  |  |  |  |  |  |  |  |  |  |
|  | `{`<br>`  LogId = 800,`<br>`  TaskId = 100,`<br>`  TaskName = "",`<br>`  CreatorName = "Admin User",`<br>`  OldProgressPercent = 50,`<br>`  NewProgressPercent = 100,`<br>`  Description = "Finished Slab",`<br>`  Images = [],`<br>`  EditWindowHours = 24,`<br>`  CanEdit = true`<br>`}` |  | O |  |  |  |  |  |  |  |  |  |  |
|  | `{`<br>`  LogId = 800,`<br>`  TaskId = 100,`<br>`  TaskName = "",`<br>`  CreatorName = "TM User",`<br>`  OldProgressPercent = 80,`<br>`  NewProgressPercent = 50,`<br>`  Description = "Decreasing child task progress",`<br>`  Images = [],`<br>`  EditWindowHours = 24,`<br>`  CanEdit = true`<br>`}` |  |  |  |  |  |  |  |  |  | O |  |  |
|  | `{`<br>`  LogId = 800,`<br>`  TaskId = 100,`<br>`  TaskName = "",`<br>`  CreatorName = "Admin User",`<br>`  OldProgressPercent = 0,`<br>`  NewProgressPercent = 0,`<br>`  Description = "Site inspection, no progress yet",`<br>`  Images = [],`<br>`  EditWindowHours = 24,`<br>`  CanEdit = true`<br>`}` |  |  |  |  |  |  |  |  |  |  |  | O |
| Confirm | Exception |  |  |  |  |  |  |  |  |  |  |  |  |
|  | Throws `NotFoundException` — `BIZ_001`: `ProjectTask với ID [999] không tồn tại.` |  |  | O |  |  |  |  |  |  |  |  |  |
|  | Throws `BusinessException` — `ERR_PROJECT_NOT_ACTIVE`: `Dự án không ở trạng thái hoạt động, không thể thực hiện thao tác này.` |  |  |  | O |  |  |  |  |  |  |  |  |
|  | Throws `BusinessException` — `ERR_TASK_LOCKED`: `Không thể cập nhật tiến độ vì công việc hoặc cấp cha [Structure Parent] đã được nghiệm thu và khóa.` |  |  |  |  | O |  |  |  |  |  |  |  |
|  | Throws `BusinessException` — `ERR_TASK_HAS_SUBTASKS`: `Không thể cập nhật tiến độ thủ công cho công việc cha có chứa các công việc con.` |  |  |  |  |  | O |  |  |  |  |  |  |
|  | Throws `BusinessException` — `ERR_TASK_DEPENDENCY_BLOCKED`: `Không thể cập nhật tiến độ. Các công việc tiên quyết chưa hoàn thành: Unfinished Foundation Work` |  |  |  |  |  |  | O |  |  |  |  |  |
|  | Throws `BusinessException` — `ERR_DECREASE_PROGRESS_FORBIDDEN`: `Chỉ Quản trị viên hoặc Trưởng phòng kỹ thuật mới có quyền giảm tiến độ công việc.` |  |  |  |  |  |  |  | O |  |  |  |  |
|  | Throws `BusinessException` — `ERR_DECREASE_PROGRESS_REASON_REQUIRED`: `Vui lòng nhập lý do giảm tiến độ công việc.` |  |  |  |  |  |  |  |  | O |  |  |  |
|  | Throws `ForbiddenException` — `AUTH_002`: `Chỉ Trưởng dự án (Leader), Ban quản lý hoặc Kỹ sư được gán vào công việc mới được phép tạo nhật ký thi công.` |  |  |  |  |  |  |  |  |  |  | O |  |
| Confirm | Log message |  |  |  |  |  |  |  |  |  |  |  |  |
| Result | Type(N : Normal, A : Abnormal, B : Boundary) | N | B | A | A | A | A | A | A | A | N | A | B |
|  | Passed/Failed | P | P | P | P | P | P | P | P | P | P | P | P |
|  | Executed Date | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 |
|  | Defect ID |  |  |  |  |  |  |  |  |  |  |  |  |


Note: There is no DB-error test case in `CreateDailyLogCommandHandlerTests.cs`, so the matrix does not add the sample `Throws Exception: "DB Error"` row.
