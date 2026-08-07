# UpdateCommentCommandHandler.Handle - Unit Test Suite Matrix

Class Name: `UpdateCommentCommandHandler`  
Function Name: `Handle(UpdateCommentCommand request, CancellationToken cancellationToken)`  
Created By: `DucHV`  
Executed By: `Not executed`

Test requirement: Passed `0`, Failed `0`, Untested `4`, N/A/B `1 / 3 / 0`, Total Test Cases `4`

| Condition | Precondition / Input / Output | UTCID01 | UTCID02 | UTCID03 | UTCID04 |
|---|---|---|---|---|---|
| Condition | Comment 500 exists | O |  | O | O |
|  | Comment 999 does NOT exist |  | O |  |  |
|  | Comment belongs to a DailyLog whose project status is `InProgress` | O |  | O |  |
|  | Comment belongs to a DailyLog whose project status is `Paused` |  |  |  | O |
|  | Current user is the comment author | O |  |  | O |
|  | Current user is NOT the comment author |  |  | O |  |
|  | Comment author and role are loaded for DTO mapping | O |  |  |  |
| Input | UpdateCommentCommand |  |  |  |  |
|  | `{`<br>`  CommentId = 500,`<br>`  Content = "Updated comment"`<br>`}` | O |  | O | O |
|  | `{`<br>`  CommentId = 999,`<br>`  Content = "Updated comment"`<br>`}` |  | O |  |  |
| Input | CancellationToken.None | O | O | O | O |
| Confirm | Return |  |  |  |  |
|  | `{`<br>`  CommentId = 500,`<br>`  LogId = 100,`<br>`  AuthorId = 12,`<br>`  AuthorName = "Site Engineer User",`<br>`  AuthorRole = "SiteEngineer",`<br>`  Content = "Updated comment",`<br>`  CreatedAt = 2026-07-14T08:00:00Z`<br>`}` | O |  |  |  |
| Confirm | Exception |  |  |  |  |
|  | Throws `NotFoundException` — `BIZ_001`: `Comment với ID [999] không tồn tại.` |  | O |  |  |
|  | Throws `ForbiddenException` — `AUTH_002`: `Bạn không có quyền chỉnh sửa bình luận này.` |  |  | O |  |
|  | Throws `BusinessException` — `ERR_PROJECT_NOT_ACTIVE`: `Dự án không ở trạng thái hoạt động, không thể thực hiện thao tác này.` |  |  |  | O |
| Confirm | Log message |  |  |  |  |
| Result | Type(N : Normal, A : Abnormal, B : Boundary) | N | A | A | A |
|  | Passed/Failed | U | U | U | U |
|  | Executed Date |  |  |  |  |
|  | Defect ID |  |  |  |  |

Note: Realtime broadcasting and UpdatedAt entity state are excluded; the observable contract is CommentDto or exception.
