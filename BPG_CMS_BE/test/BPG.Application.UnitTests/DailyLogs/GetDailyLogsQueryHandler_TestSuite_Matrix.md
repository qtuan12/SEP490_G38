# GetDailyLogsQueryHandler.Handle - Unit Test Suite Matrix

Class Name: `GetDailyLogsQueryHandler`  
Function Name: `Handle(GetDailyLogsQuery request, CancellationToken cancellationToken)`  
Created By: `DucHV`  
Executed By: `Not executed`

Test requirement: Passed `0`, Failed `0`, Untested `9`, N/A/B `5 / 0 / 4`, Total Test Cases `9`

| Condition | Precondition / Input / Output | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 | UTCID06 | UTCID07 | UTCID08 | UTCID09 |
|---|---|---|---|---|---|---|---|---|---|---|
| Condition | Project 5 has Daily Logs | O | O | O | O | O |  | O | O | O |
|  | No Daily Log matches the filters |  |  |  |  |  | O |  |  |  |
|  | Task 100 has descendant task 101 |  | O |  |  |  |  |  |  |  |
|  | CreatedBy filter is provided |  |  | O |  |  |  |  |  |  |
|  | LogDate filter is provided |  |  |  | O |  |  |  |  |  |
|  | Requested LogId is not on the current page but exists |  |  |  |  | O |  |  |  |  |
|  | Requested LogId is already on the current page |  |  |  |  |  |  |  |  | O |
|  | Configured edit window is 48 hours | O | O | O | O | O |  |  |  | O |
|  | Edit-window config is missing or invalid and falls back to 24 hours |  |  |  |  |  |  | O |  |  |
|  | Daily Log is outside the edit window |  |  |  |  |  |  | O |  |  |
|  | Requested second page contains one record |  |  |  |  |  |  |  | O |  |
|  | Active DailyLog attachments and matching progress logs exist | O | O | O | O | O |  | O | O | O |
|  | Multiple matching progress logs exist and the nearest timestamp must be selected | O |  |  |  |  |  |  |  | O |
|  | A deleted DailyLog attachment exists and must be excluded | O |  |  |  |  |  |  |  | O |
| Input | GetDailyLogsQuery |  |  |  |  |  |  |  |  |  |
|  | `{`<br>`  ProjectId = 5,`<br>`  TaskId = null,`<br>`  CreatedBy = null,`<br>`  LogDate = null,`<br>`  LogId = null,`<br>`  Search = null,`<br>`  SortBy = null,`<br>`  SortDescending = false,`<br>`  PageNumber = 1,`<br>`  PageSize = 10`<br>`}` | O |  |  |  |  |  | O |  |  |
|  | `{`<br>`  ProjectId = 5,`<br>`  TaskId = 100,`<br>`  CreatedBy = null,`<br>`  LogDate = null,`<br>`  LogId = null,`<br>`  Search = null,`<br>`  SortBy = null,`<br>`  SortDescending = false,`<br>`  PageNumber = 1,`<br>`  PageSize = 10`<br>`}` |  | O |  |  |  |  |  |  |  |
|  | `{`<br>`  ProjectId = 5,`<br>`  TaskId = null,`<br>`  CreatedBy = 20,`<br>`  LogDate = null,`<br>`  LogId = null,`<br>`  Search = null,`<br>`  SortBy = null,`<br>`  SortDescending = false,`<br>`  PageNumber = 1,`<br>`  PageSize = 10`<br>`}` |  |  | O |  |  |  |  |  |  |
|  | `{`<br>`  ProjectId = 5,`<br>`  TaskId = null,`<br>`  CreatedBy = null,`<br>`  LogDate = 2026-07-14,`<br>`  LogId = null,`<br>`  Search = null,`<br>`  SortBy = null,`<br>`  SortDescending = false,`<br>`  PageNumber = 1,`<br>`  PageSize = 10`<br>`}` |  |  |  | O |  |  |  |  |  |
|  | `{`<br>`  ProjectId = 5,`<br>`  TaskId = null,`<br>`  CreatedBy = null,`<br>`  LogDate = null,`<br>`  LogId = 900,`<br>`  Search = null,`<br>`  SortBy = null,`<br>`  SortDescending = false,`<br>`  PageNumber = 1,`<br>`  PageSize = 1`<br>`}` |  |  |  |  | O |  |  |  |  |
|  | `{`<br>`  ProjectId = 5,`<br>`  TaskId = null,`<br>`  CreatedBy = 999,`<br>`  LogDate = null,`<br>`  LogId = null,`<br>`  Search = null,`<br>`  SortBy = null,`<br>`  SortDescending = false,`<br>`  PageNumber = 1,`<br>`  PageSize = 10`<br>`}` |  |  |  |  |  | O |  |  |  |
|  | `{`<br>`  ProjectId = 5,`<br>`  TaskId = null,`<br>`  CreatedBy = null,`<br>`  LogDate = null,`<br>`  LogId = null,`<br>`  Search = null,`<br>`  SortBy = null,`<br>`  SortDescending = false,`<br>`  PageNumber = 2,`<br>`  PageSize = 1`<br>`}` |  |  |  |  |  |  |  | O |  |
|  | `{`<br>`  ProjectId = 5,`<br>`  TaskId = null,`<br>`  CreatedBy = null,`<br>`  LogDate = null,`<br>`  LogId = 800,`<br>`  Search = null,`<br>`  SortBy = null,`<br>`  SortDescending = false,`<br>`  PageNumber = 1,`<br>`  PageSize = 10`<br>`}` |  |  |  |  |  |  |  |  | O |
| Input | CancellationToken.None | O | O | O | O | O | O | O | O | O |
| Confirm | Return |  |  |  |  |  |  |  |  |  |
|  | `{`<br>`  Items = [`<br>`    {`<br>`      LogId = 800,`<br>`      TaskId = 100,`<br>`      TaskName = "Concrete Slab",`<br>`      OldProgressPercent = 20,`<br>`      NewProgressPercent = 50,`<br>`      Description = "Poured half slab",`<br>`      CreatedBy = 10,`<br>`      CreatorName = "Admin User",`<br>`      LogDate = 2026-07-14,`<br>`      CreatedAt = <UTC DateTime within the last hour>,`<br>`      IsEdited = false,`<br>`      LastEditedAt = null,`<br>`      CanEdit = true,`<br>`      EditWindowHours = 48,`<br>`      Images = ["daily-800.jpg"],`<br>`      Comments = [{ CommentId = 1, LogId = 800, AuthorId = 11, AuthorName = "TM User", AuthorRole = "TechnicalManager", Content = "Good progress", CreatedAt = 2026-07-14T09:00:00Z }]`<br>`    },`<br>`    {`<br>`      LogId = 801,`<br>`      TaskId = 101,`<br>`      TaskName = "Concrete Slab Detail",`<br>`      OldProgressPercent = 0,`<br>`      NewProgressPercent = 25,`<br>`      Description = "Started detail work",`<br>`      CreatedBy = 20,`<br>`      CreatorName = "Site Engineer",`<br>`      LogDate = 2026-07-13,`<br>`      CreatedAt = <UTC DateTime within the last hour>,`<br>`      IsEdited = false,`<br>`      LastEditedAt = null,`<br>`      CanEdit = true,`<br>`      EditWindowHours = 48,`<br>`      Images = [],`<br>`      Comments = []`<br>`    }`<br>`  ],`<br>`  PageNumber = 1,`<br>`  PageSize = 10,`<br>`  TotalCount = 2,`<br>`  TotalPages = 1`<br>`}` | O |  |  |  |  |  |  |  | O |
|  | `{`<br>`  Items = [`<br>`    { LogId = 800, TaskId = 100, TaskName = "Concrete Slab", OldProgressPercent = 20, NewProgressPercent = 50, EditWindowHours = 48, CanEdit = true, Images = ["daily-800.jpg"] },`<br>`    { LogId = 801, TaskId = 101, TaskName = "Concrete Slab Detail", OldProgressPercent = 0, NewProgressPercent = 25, EditWindowHours = 48, CanEdit = true, Images = [] }`<br>`  ],`<br>`  PageNumber = 1,`<br>`  PageSize = 10,`<br>`  TotalCount = 2,`<br>`  TotalPages = 1`<br>`}` |  | O |  |  |  |  |  |  |  |
|  | `{`<br>`  Items = [`<br>`    { LogId = 801, TaskId = 101, CreatedBy = 20, CreatorName = "Site Engineer", LogDate = 2026-07-13, NewProgressPercent = 25, EditWindowHours = 48, CanEdit = true, Images = [] }`<br>`  ],`<br>`  PageNumber = 1,`<br>`  PageSize = 10,`<br>`  TotalCount = 1,`<br>`  TotalPages = 1`<br>`}` |  |  | O |  |  |  |  |  |  |
|  | `{`<br>`  Items = [`<br>`    { LogId = 800, TaskId = 100, CreatedBy = 10, CreatorName = "Admin User", LogDate = 2026-07-14, NewProgressPercent = 50, EditWindowHours = 48, CanEdit = true, Images = ["daily-800.jpg"] }`<br>`  ],`<br>`  PageNumber = 1,`<br>`  PageSize = 10,`<br>`  TotalCount = 1,`<br>`  TotalPages = 1`<br>`}` |  |  |  | O |  |  |  |  |  |
|  | `{`<br>`  Items = [`<br>`    { LogId = 900, TaskId = 102, TaskName = "Target Task", Description = "Target log", EditWindowHours = 48, CanEdit = true, Images = ["daily-900.jpg"] },`<br>`    { LogId = 800, TaskId = 100, TaskName = "Concrete Slab", Description = "Poured half slab", EditWindowHours = 48, CanEdit = true, Images = ["daily-800.jpg"] }`<br>`  ],`<br>`  PageNumber = 1,`<br>`  PageSize = 1,`<br>`  TotalCount = 2,`<br>`  TotalPages = 2`<br>`}` |  |  |  |  | O |  |  |  |  |
|  | `{`<br>`  Items = [],`<br>`  PageNumber = 1,`<br>`  PageSize = 10,`<br>`  TotalCount = 0,`<br>`  TotalPages = 0`<br>`}` |  |  |  |  |  | O |  |  |  |
|  | `{`<br>`  Items = [`<br>`    { LogId = 800, TaskId = 100, OldProgressPercent = 20, NewProgressPercent = 50, EditWindowHours = 24, CanEdit = false, Images = ["daily-800.jpg"] },`<br>`    { LogId = 801, TaskId = 101, OldProgressPercent = 0, NewProgressPercent = 25, EditWindowHours = 24, CanEdit = false, Images = [] }`<br>`  ],`<br>`  PageNumber = 1,`<br>`  PageSize = 10,`<br>`  TotalCount = 2,`<br>`  TotalPages = 1`<br>`}` |  |  |  |  |  |  | O |  |  |
|  | `{`<br>`  Items = [`<br>`    { LogId = 801, TaskId = 101, TaskName = "Concrete Slab Detail", NewProgressPercent = 25, EditWindowHours = 48, CanEdit = true, Images = [] }`<br>`  ],`<br>`  PageNumber = 2,`<br>`  PageSize = 1,`<br>`  TotalCount = 2,`<br>`  TotalPages = 2`<br>`}` |  |  |  |  |  |  |  | O |  |
| Confirm | Exception |  |  |  |  |  |  |  |  |  |
| Confirm | Log message |  |  |  |  |  |  |  |  |  |
| Result | Type(N : Normal, A : Abnormal, B : Boundary) | N | N | N | N | N | B | B | B | B |
|  | Passed/Failed | U | U | U | U | U | U | U | U | U |
|  | Executed Date |  |  |  |  |  |  |  |  |  |
|  | Defect ID |  |  |  |  |  |  |  |  |  |

Note: Search and SortBy are inherited by the query but are not read by this handler, so no test case claims that they filter or sort Daily Logs.
Note: Known code gap: the fallback lookup for LogId is not constrained by ProjectId. Fix that production query before adding a cross-project isolation test.
