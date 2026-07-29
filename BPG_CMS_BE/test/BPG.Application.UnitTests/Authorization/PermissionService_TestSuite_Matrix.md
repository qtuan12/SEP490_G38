# PermissionService - Unit Test Suite Matrix

Class Name: `PermissionService`  
Function Name: `GetSystemPermissions`, `GetProjectPermissionsAsync`, `GetProjectIdsWithPermissionAsync`  
Created By: `DucHV`  
Executed By: `DucHV`

Test requirement: Passed `8`, Failed `0`, Untested `0`, N/A/B `5 / 3 / 0`, Total Test Cases `8`

| Condition | Precondition / Input / Output | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 | UTCID06 | UTCID07 | UTCID08 |
|---|---|---|---|---|---|---|---|---|---|
| Condition | User is anonymous | O |  | O |  |  |  |  |  |
|  | User has Admin role |  | O |  |  |  |  |  | O |
|  | User has SiteEngineer role |  |  |  | O | O |  | O |  |
|  | User has TechnicalManager role |  |  |  |  |  | O |  |  |
|  | User is project member, not leader |  |  |  | O |  |  | O |  |
|  | User is project leader |  |  |  |  | O |  | O |  |
|  | User has no project membership |  |  |  |  |  | O |  |  |
| Input | Permission request |  |  |  |  |  |  |  |  |
|  | `GetSystemPermissions()` | O | O |  |  |  |  |  |  |
|  | `GetProjectPermissionsAsync(projectId: 1)` |  |  | O | O | O | O |  |  |
|  | `GetProjectIdsWithPermissionAsync(project.view)` |  |  |  |  |  |  | O |  |
|  | `GetProjectIdsWithPermissionAsync(project.execution.manage)` |  |  |  |  |  |  | O |  |
|  | `GetProjectIdsWithPermissionAsync(project.reports.view)` |  |  |  |  |  |  |  | O |
| Confirm | Return |  |  |  |  |  |  |  |  |
|  | Empty system permission list | O |  |  |  |  |  |  |  |
|  | All system permissions |  | O |  |  |  |  |  |  |
|  | `[project.view]` |  |  |  | O |  |  |  |  |
|  | `[project.view, project.execution.manage, project.inventory.manage]` |  |  |  |  | O |  |  |  |
|  | TechnicalManager global project permissions |  |  |  |  |  | O |  |  |
|  | Viewable projects are `[1, 2]`; executable projects are `[2]` |  |  |  |  |  |  | O |  |
|  | Admin receives all project IDs `[1, 2, 3]` |  |  |  |  |  |  |  | O |
| Confirm | Exception |  |  |  |  |  |  |  |  |
|  | Throws `UnauthorizedException` |  |  | O |  |  |  |  |  |
| Confirm | Log message |  |  |  |  |  |  |  |  |
| Result | Type(N : Normal, A : Abnormal, B : Boundary) | B | N | A | N | N | N | N | N |
|  | Passed/Failed | P | P | P | P | P | P | P | P |
|  | Executed Date | 07/29 | 07/29 | 07/29 | 07/29 | 07/29 | 07/29 | 07/29 | 07/29 |
|  | Defect ID |  |  |  |  |  |  |  |  |

Note: Roles are tested only as permission sources. There are no per-user grant/deny overrides and no runtime permission editor behavior in this service.
