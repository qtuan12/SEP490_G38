# GetTaskProgressHistoryQueryHandler.Handle - Unit Test Suite Matrix

Class Name: `GetTaskProgressHistoryQueryHandler`  
Function Name: `Handle(GetTaskProgressHistoryQuery request, CancellationToken cancellationToken)`  
Created By: `DucHV`  
Executed By: `Not executed`

Test requirement: Passed `0`, Failed `0`, Untested `5`, N/A/B `2 / 2 / 1`, Total Test Cases `5`

| Condition | Precondition / Input / Output | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 |
|---|---|---|---|---|---|---|
| Condition | Task 100 exists | O | O |  | O | O |
|  | Task 999 does NOT exist |  |  | O |  |  |
|  | User is a project member without privileged role |  | O |  |  |  |
|  | User is not a global project-view role and is not a project member |  |  |  | O |  |
|  | Task progress logs exist | O | O |  |  |  |
|  | Task has no progress logs |  |  |  |  | O |
| Input | GetTaskProgressHistoryQuery |  |  |  |  |  |
|  | `{`<br>`  TaskId = 100`<br>`}` | O | O |  | O | O |
|  | `{`<br>`  TaskId = 999`<br>`}` |  |  | O |  |  |
| Input | CancellationToken.None | O | O | O | O | O |
| Confirm | Return |  |  |  |  |  |
|  | `[`<br>`  { TaskProgressLogId = 2, TaskId = 100, OldProgress = 50, NewProgress = 80, UpdateReason = "Continued construction", UpdatedAt = 2026-07-14T10:00:00Z },`<br>`  { TaskProgressLogId = 1, TaskId = 100, OldProgress = 20, NewProgress = 50, UpdateReason = "Daily site update", UpdatedAt = 2026-07-14T08:00:00Z }`<br>`]` | O | O |  |  |  |
|  | `[]` |  |  |  |  | O |
| Confirm | Exception |  |  |  |  |  |
|  | Throws `NotFoundException` — `BIZ_001`: `ProjectTask với ID [999] không tồn tại.` |  |  | O |  |  |
|  | Throws `ForbiddenException` — `AUTH_002`: `Bạn không phải thành viên của dự án này.` |  |  |  | O |  |
| Confirm | Log message |  |  |  |  |  |
| Result | Type(N : Normal, A : Abnormal, B : Boundary) | N | N | A | A | B |
|  | Passed/Failed | U | U | U | U | U |
|  | Executed Date |  |  |  |  |  |
|  | Defect ID |  |  |  |  |  |

Note: Admin and TechnicalManager share one global project-view role branch; one representative privileged-role case is sufficient.
