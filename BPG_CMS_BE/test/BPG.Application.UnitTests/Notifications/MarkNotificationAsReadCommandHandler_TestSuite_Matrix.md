# MarkNotificationAsReadCommandHandler.Handle - Unit Test Suite Matrix

Class Name: `MarkNotificationAsReadCommandHandler`  
Function Name: `Handle(MarkNotificationAsReadCommand request, CancellationToken cancellationToken)`  
Created By: `DucHV`  
Executed By: `DucHV`

Test requirement: Passed `7`, Failed `0`, Untested `0`, N/A/B `4 / 1 / 2`, Total Test Cases `7`

| Condition | Precondition / Input / Output | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 | UTCID06 | UTCID07 |
|---|---|---|---|---|---|---|---|---|
| Condition | UserId is provided | O | O | O | O | O | O | O |
|  | MarkAll is true | O | O |  |  |  |  | O |
|  | MarkAll is false |  |  | O | O | O | O |  |
|  | Unread notifications exist | O |  | O |  |  |  |  |
|  | No unread notifications exist |  | O |  |  |  |  |  |
|  | Specific notification exists |  |  | O | O |  |  | O |
|  | Specific notification does NOT exist |  |  |  |  | O |  |  |
|  | Specific notification is already read |  |  |  | O |  |  |  |
|  | No action requested |  |  |  |  |  | O |  |
|  | Both MarkAll and NotificationId are provided |  |  |  |  |  |  | O |
| Input | MarkNotificationAsReadCommand |  |  |  |  |  |  |  |
|  | `{`<br>`  UserId = 10,`<br>`  NotificationId = null,`<br>`  MarkAll = true`<br>`}` | O | O |  |  |  |  |  |
|  | `{`<br>`  UserId = 10,`<br>`  NotificationId = 123,`<br>`  MarkAll = false`<br>`}` |  |  | O | O | O |  |  |
|  | `{`<br>`  UserId = 10,`<br>`  NotificationId = null,`<br>`  MarkAll = false`<br>`}` |  |  |  |  |  | O |  |
|  | `{`<br>`  UserId = 10,`<br>`  NotificationId = 1,`<br>`  MarkAll = true`<br>`}` |  |  |  |  |  |  | O |
| Input | CancellationToken.None | O | O | O | O | O | O | O |
| Confirm | Return |  |  |  |  |  |  |  |
|  | true | O | O | O | O |  |  | O |
|  | false |  |  |  |  |  | O |  |
| Confirm | Exception |  |  |  |  |  |  |  |
|  | Throws `NotFoundException` — `BIZ_001`: `Notification với ID [123] không tồn tại.` |  |  |  |  | O |  |  |
| Confirm | Log message |  |  |  |  |  |  |  |
| Result | Type(N : Normal, A : Abnormal, B : Boundary) | N | B | N | B | A | B | N |
|  | Passed/Failed | P | P | P | P | P | P | P |
|  | Executed Date | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 |
|  | Defect ID |  |  |  |  |  |  |  |
