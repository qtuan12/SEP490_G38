# AddCommentCommandHandler.Handle - Unit Test Suite Matrix

Class Name: `AddCommentCommandHandler`  
Function Name: `Handle(AddCommentCommand request, CancellationToken cancellationToken)`  
Created By: `DucHV`  
Executed By: `Not executed`

Test requirement: Passed `0`, Failed `0`, Untested `4`, N/A/B `2 / 2 / 0`, Total Test Cases `4`

| Condition | Precondition / Input / Output | UTCID01 | UTCID02 | UTCID03 | UTCID04 |
|---|---|---|---|---|---|
| Condition | DailyLog 100 exists | O | O |  | O |
|  | DailyLog 999 does NOT exist |  |  | O |  |
|  | Current user record and role exist for DTO mapping | O | O |  |  |
| Input | AddCommentCommand |  |  |  |  |
|  | `{`<br>`  LogId = 100,`<br>`  Content = "Great job!"`<br>`}` | O | O |  | O |
|  | `{`<br>`  LogId = 999,`<br>`  Content = "Great job!"`<br>`}` |  |  | O |  |
| Input | CancellationToken.None | O | O | O | O |
| Confirm | Return |  |  |  |  |
|  | `{`<br>`  CommentId = 500,`<br>`  LogId = 100,`<br>`  AuthorId = 11,`<br>`  AuthorName = "TM User",`<br>`  AuthorRole = "TechnicalManager",`<br>`  Content = "Great job!",`<br>`  CreatedAt = <UTC DateTime>`<br>`}` | O |  |  |  |
|  | `{`<br>`  CommentId = 501,`<br>`  LogId = 100,`<br>`  AuthorId = 12,`<br>`  AuthorName = "Site Engineer User",`<br>`  AuthorRole = "SiteEngineer",`<br>`  Content = "Great job!",`<br>`  CreatedAt = <UTC DateTime>`<br>`}` |  | O |  |  |
| Confirm | Exception |  |  |  |  |
|  | Throws `NotFoundException` — `BIZ_001`: `DailyLog với ID [999] không tồn tại.` |  |  | O |  |
|  | Throws `ForbiddenException` — `AUTH_002`: `Bạn không phải thành viên của dự án này.` |  |  |  | O |
| Confirm | Log message |  |  |  |  |
| Result | Type(N : Normal, A : Abnormal, B : Boundary) | N | N | A | A |
|  | Passed/Failed | U | U | U | U |
|  | Executed Date |  |  |  |  |
|  | Defect ID |  |  |  |  |

Note: Creator and previous-commenter notification branches are excluded because they do not change the returned CommentDto or exception.
Note: Content validation belongs to AddCommentCommandValidator and is not tested by direct Handle invocation.
