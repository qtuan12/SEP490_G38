# DeleteCommentCommandHandler.Handle - Unit Test Suite Matrix

Class Name: `DeleteCommentCommandHandler`  
Function Name: `Handle(DeleteCommentCommand request, CancellationToken cancellationToken)`  
Created By: `DucHV`  
Executed By: `Not executed`

Test requirement: Passed `0`, Failed `0`, Untested `5`, N/A/B `1 / 3 / 1`, Total Test Cases `5`

| Condition | Precondition / Input / Output | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 |
|---|---|---|---|---|---|---|
| Condition | Comment 500 exists | O | O |  | O | O |
|  | Comment 999 does NOT exist |  |  | O |  |  |
|  | Comment belongs to a DailyLog whose project status is `InProgress` | O | O |  | O |  |
|  | Comment belongs to a DailyLog whose project status is `Paused` |  |  |  |  | O |
|  | Current user is the comment author | O | O |  |  | O |
|  | Current user is NOT the comment author |  |  |  | O |  |
|  | SaveChangesAsync returns a value greater than 0 | O |  |  |  |  |
|  | SaveChangesAsync returns 0 |  | O |  |  |  |
| Input | DeleteCommentCommand |  |  |  |  |  |
|  | `{`<br>`  CommentId = 500`<br>`}` | O | O |  | O | O |
|  | `{`<br>`  CommentId = 999`<br>`}` |  |  | O |  |  |
| Input | CancellationToken.None | O | O | O | O | O |
| Confirm | Return |  |  |  |  |  |
|  | true | O |  |  |  |  |
|  | false |  | O |  |  |  |
| Confirm | Exception |  |  |  |  |  |
|  | Throws `NotFoundException` — `BIZ_001`: `Comment với ID [999] không tồn tại.` |  |  | O |  |  |
|  | Throws `ForbiddenException` — `AUTH_002`: `Bạn không có quyền xóa bình luận này.` |  |  |  | O |  |
|  | Throws `BusinessException` — `ERR_PROJECT_NOT_ACTIVE`: `Dự án không ở trạng thái hoạt động, không thể thực hiện thao tác này.` |  |  |  |  | O |
| Confirm | Log message |  |  |  |  |  |
| Result | Type(N : Normal, A : Abnormal, B : Boundary) | N | B | A | A | A |
|  | Passed/Failed | U | U | U | U | U |
|  | Executed Date |  |  |  |  |  |
|  | Defect ID |  |  |  |  |  |

Note: Soft-delete state and realtime broadcasting are excluded; SaveChanges result is retained because it directly determines the returned bool.
