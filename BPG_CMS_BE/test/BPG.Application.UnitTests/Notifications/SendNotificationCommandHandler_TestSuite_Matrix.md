# SendNotificationCommandHandler.Handle - Unit Test Suite Matrix

Class Name: `SendNotificationCommandHandler`  
Function Name: `Handle(SendNotificationCommand request, CancellationToken cancellationToken)`  
Created By: `DucHV`  
Executed By: `DucHV`

Test requirement: Passed `5`, Failed `0`, Untested `0`, N/A/B `4 / 0 / 1`, Total Test Cases `5`

| Condition | Precondition / Input / Output | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 |
|---|---|---|---|---|---|---|
| Condition | Active users exist | O | O |  |  | O |
|  | Specific active user exists |  |  | O |  |  |
|  | Specific user does NOT exist |  |  |  | O |  |
|  | SendToAll is true | O | O |  |  |  |
|  | Excluded user is provided |  | O |  |  |  |
|  | RoleName is provided |  |  |  |  | O |
| Input | SendNotificationCommand |  |  |  |  |  |
|  | `{`<br>`  UserId = null,`<br>`  Title = "Thông báo",`<br>`  Content = "Nội dung",`<br>`  NotificationType = "Progress",`<br>`  SendToAll = true,`<br>`  RoleName = null,`<br>`  ReferenceType = null,`<br>`  ReferenceId = null,`<br>`  ExcludeUserId = null`<br>`}` | O |  |  |  |  |
|  | `{`<br>`  UserId = null,`<br>`  Title = "Thông báo",`<br>`  Content = "Nội dung",`<br>`  NotificationType = "Progress",`<br>`  SendToAll = true,`<br>`  RoleName = null,`<br>`  ReferenceType = null,`<br>`  ReferenceId = null,`<br>`  ExcludeUserId = 20`<br>`}` |  | O |  |  |  |
|  | `{`<br>`  UserId = 10,`<br>`  Title = "Thông báo",`<br>`  Content = "Nội dung",`<br>`  NotificationType = "Progress",`<br>`  SendToAll = false,`<br>`  RoleName = null,`<br>`  ReferenceType = null,`<br>`  ReferenceId = null,`<br>`  ExcludeUserId = null`<br>`}` |  |  | O | O |  |
|  | `{`<br>`  UserId = null,`<br>`  Title = "Thông báo",`<br>`  Content = "Nội dung",`<br>`  NotificationType = "Progress",`<br>`  SendToAll = false,`<br>`  RoleName = "TechnicalManager",`<br>`  ReferenceType = null,`<br>`  ReferenceId = null,`<br>`  ExcludeUserId = null`<br>`}` |  |  |  |  | O |
| Input | CancellationToken.None | O | O | O | O | O |
| Confirm | Return |  |  |  |  |  |
|  | Completes without throwing exception | O | O | O | O | O |
| Confirm | Exception |  |  |  |  |  |
| Confirm | Log message |  |  |  |  |  |
| Result | Type(N : Normal, A : Abnormal, B : Boundary) | N | N | N | B | N |
|  | Passed/Failed | P | P | P | P | P |
|  | Executed Date | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 |
|  | Defect ID |  |  |  |  |  |
