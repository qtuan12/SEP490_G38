# ProjectAuthorizationBehavior.Handle - Unit Test Suite Matrix

Class Name: `ProjectAuthorizationBehavior<TRequest, TResponse>`  
Function Name: `Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken cancellationToken)`  
Created By: `DucHV`  
Executed By: `DucHV`

Test requirement: Passed `3`, Failed `0`, Untested `0`, N/A/B `1 / 2 / 0`, Total Test Cases `3`

| Condition | Precondition / Input / Output | UTCID01 | UTCID02 | UTCID03 |
|---|---|---|---|---|
| Condition | Request implements `IProjectResourceRequirement` | O | O | O |
|  | Resource resolver returns ProjectId 10 | O | O | O |
|  | Current user is unauthenticated | O |  |  |
|  | Current user is authenticated |  | O | O |
|  | User lacks required project permission |  | O |  |
|  | User has required project permission |  |  | O |
| Input | TestProjectCommand | O | O | O |
|  | `RequiredPermission = project.execution.manage` | O | O | O |
|  | `ProjectResource = Project(10)` | O | O | O |
| Input | CancellationToken.None | O | O | O |
| Confirm | Return |  |  |  |
|  | Calls next delegate and returns `"handled"` |  |  | O |
| Confirm | Exception |  |  |  |
|  | Throws `UnauthorizedException` | O |  |  |
|  | Throws `ForbiddenException` |  | O |  |
| Confirm | Log message |  |  |  |
| Result | Type(N : Normal, A : Abnormal, B : Boundary) | A | A | N |
|  | Passed/Failed | P | P | P |
|  | Executed Date | 07/29 | 07/29 | 07/29 |
|  | Defect ID |  |  |  |

Note: This is the central project permission pipeline test. Handler unit tests should not duplicate 401/403 permission checks unless the handler has an additional business authorization rule.
