# GetMyNotificationsQueryHandler.Handle - Unit Test Suite Matrix

Class Name: `GetMyNotificationsQueryHandler`  
Function Name: `Handle(GetMyNotificationsQuery request, CancellationToken cancellationToken)`  
Created By: `DucHV`  
Executed By: `DucHV`

Test requirement: Passed `7`, Failed `0`, Untested `0`, N/A/B `4 / 1 / 2`, Total Test Cases `7`

| Condition | Precondition / Input / Output | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 | UTCID06 | UTCID07 |
|---|---|---|---|---|---|---|---|---|
| Condition | User is authenticated | O | O | O | O | O |  | O |
|  | User is NOT authenticated |  |  |  |  |  | O |  |
|  | User has notifications | O |  | O | O | O |  | O |
|  | User has NO notifications |  | O |  |  |  |  |  |
|  | Other users notifications exist |  |  | O |  |  |  |  |
|  | Pagination is requested |  |  |  |  | O |  |  |
|  | Invalid pagination values are provided |  |  |  |  |  |  | O |
| Input | GetMyNotificationsQuery |  |  |  |  |  |  |  |
|  | `{`<br>`  PageNumber = 1,`<br>`  PageSize = 10`<br>`}` | O | O | O | O |  | O |  |
|  | `{`<br>`  PageNumber = 2,`<br>`  PageSize = 2`<br>`}` |  |  |  |  | O |  |  |
|  | `{`<br>`  PageNumber = 0,`<br>`  PageSize = -10`<br>`}` |  |  |  |  |  |  | O |
| Input | CancellationToken.None | O | O | O | O | O | O | O |
| Confirm | Return |  |  |  |  |  |  |  |
|  | `{`<br>`  Items.Count = 3,`<br>`  TotalCount = 3,`<br>`  All Items.UserId = 10`<br>`}` | O |  |  |  |  |  |  |
|  | `{`<br>`  Items = [],`<br>`  TotalCount = 0`<br>`}` |  | O |  |  |  |  |  |
|  | `{`<br>`  Items.Count = 1,`<br>`  Items[0].NotificationId = 3,`<br>`  TotalCount = 1`<br>`}` |  |  | O |  |  |  |  |
|  | `{`<br>`  Items.NotificationId order contains 4, 1, 2`<br>`}` |  |  |  | O |  |  |  |
|  | `{`<br>`  Items.Count = 1,`<br>`  Items[0].NotificationId = 2,`<br>`  TotalCount = 3,`<br>`  PageNumber = 2,`<br>`  PageSize = 2`<br>`}` |  |  |  |  | O |  |  |
|  | `{`<br>`  PageNumber = 1,`<br>`  PageSize = 1`<br>`}` |  |  |  |  |  |  | O |
| Confirm | Exception |  |  |  |  |  |  |  |
|  | Throws `UnauthorizedAccessException`: `User is not authenticated.` |  |  |  |  |  | O |  |
| Confirm | Log message |  |  |  |  |  |  |  |
| Result | Type(N : Normal, A : Abnormal, B : Boundary) | N | B | N | N | N | A | B |
|  | Passed/Failed | P | P | P | P | P | P | P |
|  | Executed Date | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 | 07/14 |
|  | Defect ID |  |  |  |  |  |  |  |
