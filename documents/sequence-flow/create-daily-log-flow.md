# Create Daily Log

> All handlers use **`IUnitOfWork`** → **`IGenericRepository<T>`** (generic), no custom repository per entity. 🐶
> SignalR hub `RealtimeNotificationSender` calls: `ReceiveDailyLogCreated`, `ReceiveDailyLogUpdated`.

## 1. Class Diagram

```mermaid
%%{init: { 'themeConfig': { 'showMethods': false, 'showAttributes': false } } }%
classDiagram

    %% ================= FRONTEND LAYER (ReactJS) =================
    class ProjectDailyLogs
    class DailyLogFormModal
    class projectService

    %% ================= API / CONTROLLER LAYER =================
    class DailyLogsController
    class IMediator {
        <<interface>>
    }

    %% ================= APPLICATION LAYER (CQRS & MediatR) =================
    class CreateDailyLogCommand
    class DailyLogDto
    class ValidationBehavior
    class CreateDailyLogCommandValidator
    class CreateDailyLogCommandHandler

    %% ================= INFRASTRUCTURE LAYER =================
    class IUnitOfWork {
        <<interface>>
    }
    class UnitOfWork
    class IGenericRepository {
        <<interface>>
    }
    class GenericRepository

    %% ================= DOMAIN ENTITIES =================
    class DailyLog
    class ProjectTask
    class Phase
    class User

    %% ================= RELATIONSHIPS & UML ARROWS =================
    %% Frontend Layer
    ProjectDailyLogs *-- DailyLogFormModal
    DailyLogFormModal ..> projectService : calls create log

    %% FE <-> BE Integration Boundary (Vòng khép kín FE-BE)
    projectService ..> DailyLogsController : POST /daily-logs (gửi log payload)
    DailyLogsController ..> projectService : HTTP 200 OK (trả DailyLogDto)

    %% API / Controller Layer
    DailyLogsController o-- IMediator
    DailyLogsController ..> CreateDailyLogCommand : binds body
    DailyLogsController ..> DailyLogDto : returns result

    %% Application Layer (MediatR CQRS)
    ValidationBehavior o-- CreateDailyLogCommandValidator
    CreateDailyLogCommandValidator ..> CreateDailyLogCommand : validates
    CreateDailyLogCommandHandler o-- IUnitOfWork
    CreateDailyLogCommandHandler ..> CreateDailyLogCommand : handles
    CreateDailyLogCommandHandler ..> DailyLogDto : maps result
    CreateDailyLogCommandHandler ..> DailyLog : creates

    %% Infrastructure Layer (Realization & Aggregation)
    IUnitOfWork o-- IGenericRepository
    UnitOfWork ..|> IUnitOfWork
    GenericRepository ..|> IGenericRepository
    UnitOfWork o-- GenericRepository
    GenericRepository ..> DailyLog : persists

    %% Domain Entities Association
    DailyLog --> ProjectTask
    DailyLog --> User
    ProjectTask --> Phase
```

## 2. Sequence Diagram

```mermaid
    actor "Site Engineer / TM / Project Leader" as User
    participant ": DailyLogFormModal" as UI
    participant ": projectService" as Service
    participant ": DailyLogsController" as Controller
    participant ": FilesController" as FilesCtrl
    participant ": Mediator" as Mediator
    participant ": CreateDailyLogCommandHandler" as Handler
    participant ": UnitOfWork (EF Core)" as UOW
    participant ": CloudinaryService (Storage)" as CloudSvc
    participant ": NotificationService" as NotifSvc
    participant ": SignalR Hub" as SignalR
    database ": SQL Server (Database)" as DB
    database ": Cloudinary (External)" as Cloudinary
    actor "Online Project Members" as Members
    alt [progress decreased]
        User ->> UI: 1.1 Drags slider DOWN, fills mandatory Description (reason)
        activate UI
    else [progress increased]
        User ->> UI: 1.2 Drags slider UP, fills optional Description, selects photos
        activate UI
    end
    opt [has photos]
        UI ->> Service: 2.1 uploadFiles(files, 'dailylogs')
        activate Service
        Service ->> FilesCtrl: 2.2 POST /api/files/upload-multiple (multipart/form-data)
        activate FilesCtrl
        FilesCtrl ->> CloudSvc: 2.3 UploadFileAsync(file, folder)
        activate CloudSvc
        CloudSvc ->> Cloudinary: 2.4 API POST UploadAsync(fileStream)
        activate Cloudinary
        Cloudinary -->> CloudSvc: 2.5 Returns secure image URL
        deactivate Cloudinary
        CloudSvc -->> FilesCtrl: 2.6 Returns file URL result
        deactivate CloudSvc
        FilesCtrl -->> Service: 2.7 HTTP 200 OK (List of UploadFileResponse)
        deactivate FilesCtrl
        Service -->> UI: 2.8 Returns image URLs array
        deactivate Service
    end
    UI ->> UI: 3. Client-side Zod validation (progress range 0-100, reason if decreased)
    UI ->> Service: 4. createDailyLog({ TaskId, NewProgressPercent, Description, Images: imageUrls })
    activate Service
    Service ->> Controller: 5. POST /api/v1/daily-logs (JSON body)
    activate Controller
    Controller ->> Mediator: 6. Send(CreateDailyLogCommand)
    activate Mediator
    Mediator ->> Handler: 7. Route command to handler
    activate Handler
    Handler ->> UOW: 8. ProjectTasks.GetByIdWithDetailsAsync(taskId)
    activate UOW
    UOW ->> DB: 8.1 SELECT task, subtasks, phase & project records
    activate DB
    DB -->> UOW: 8.2 Returns task & project entity data
    deactivate DB
    UOW -->> Handler: 8.3 task + project entities
    deactivate UOW
    Handler ->> UOW: 9. ProjectMembers.IsLeaderAsync(userId, projectId) & TaskAssignees.IsAssigneeAsync(userId, taskId)
    activate UOW
    UOW ->> DB: 9.1 SELECT member and assignee records
    activate DB
    DB -->> UOW: 9.2 Returns authorization data
    deactivate DB
    UOW -->> Handler: 9.3 Membership & Assignment status
    deactivate UOW
    Handler ->> Handler: 10. Validate project.Status == InProgress
    Handler ->> Handler: 11. Validate task has no active children (leaf task)
    alt [progress decrease validation]
        Handler ->> Handler: 12.1 Check isTM == true
        Handler ->> Handler: 12.2 Check Description not empty
    end
    Handler ->> UOW: 13. BeginTransaction()
    activate UOW
    UOW ->> DB: 13.1 BEGIN TRANSACTION
    activate DB
    DB -->> UOW: 13.2 Transaction Started
    deactivate DB
    UOW -->> Handler: 13.3 Transaction context initialized
    deactivate UOW
    Handler ->> UOW: 14. DailyLogs.AddAsync(dailyLogEntity)
    activate UOW
    UOW -->> Handler: 14.1 DailyLog tracked in ChangeTracker
    deactivate UOW
    opt [has photos]
        Handler ->> UOW: 15. Attachments.AddRangeAsync(attachments)
        activate UOW
        UOW -->> Handler: 15.1 Attachments tracked in ChangeTracker
        deactivate UOW
    end
    Handler ->> UOW: 16. ProjectTasks.Update(task)
    activate UOW
    UOW -->> Handler: 16.1 Task state set to Modified
    deactivate UOW
    Handler ->> UOW: 17. TaskProgressLogs.AddAsync(progressLog)
    activate UOW
    UOW -->> Handler: 17.1 ProgressLog tracked in ChangeTracker
    deactivate UOW
    note over Handler, DB: SyncParentTasksProgressAsync — WBS Climb
    loop [parentTaskId != null]
        Handler ->> UOW: 18. ProjectTasks.GetByIdWithSubTasksAsync(parentTaskId)
        activate UOW
        UOW ->> DB: 18.1 SELECT parent task & sibling subtask records
        activate DB
        DB -->> UOW: 18.2 Returns parent & sibling data
        deactivate DB
        UOW -->> Handler: 18.3 parent entity + sibling collection
        deactivate UOW
        Handler ->> Handler: 18.4 Calculate newParentProgress = Round(Average(siblings.ProgressPercent))
        Handler ->> UOW: 18.5 ProjectTasks.Update(parentTask)
        activate UOW
        UOW -->> Handler: 18.6 parentTask state set to Modified
        deactivate UOW
        Handler ->> UOW: 18.7 TaskProgressLogs.AddAsync(parentProgressLog)
        activate UOW
        UOW -->> Handler: 18.8 parentProgressLog tracked in ChangeTracker
        deactivate UOW
    end
    Handler ->> UOW: 19. SaveChangesAsync() + CommitTransaction()
    activate UOW
    UOW ->> DB: 19.1 INSERT DailyLogs, Attachments, TaskProgressLogs; UPDATE ProjectTasks; COMMIT TRANSACTION
    activate DB
    DB -->> UOW: 19.2 Transaction committed success (LogId generated)
    deactivate DB
    UOW -->> Handler: 19.3 Changes persisted successfully
    deactivate UOW
    Handler ->> UOW: 20. Users.GetByIdWithRolesAsync(currentUserId)
    activate UOW
    UOW ->> DB: 20.1 SELECT User + UserRoles records
    activate DB
    DB -->> UOW: 20.2 Returns user details
    deactivate DB
    UOW -->> Handler: 20.3 User entity
    deactivate UOW
    par [System Notifications]
        Handler ->> NotifSvc: 21.1 SendNotificationAsync(leader.UserId, "Progress log update", taskRef)
        activate NotifSvc
        Handler ->> NotifSvc: 21.2 SendNotificationToRoleAsync("TechnicalManager", "New progress log", taskRef)
        NotifSvc -->> Handler: 21.3 Notifications queued/sent
        deactivate NotifSvc
        Handler ->> SignalR: 21.4 SendToGroupAsync("Project_{projectId}", "ReceiveDailyLogCreated", DailyLogDto)
        activate SignalR
        SignalR ->> Members: 21.5 Broadcast ReceiveDailyLogCreated to Project_{projectId} group
        SignalR -->> Handler: 21.6 Realtime broadcast completed
        deactivate SignalR
    end
    Handler -->> Mediator: 22. Returns DailyLogDto
    deactivate Handler
    Mediator -->> Controller: 23. Returns DailyLogDto
    deactivate Mediator
    Controller -->> Service: 24. HTTP 200 OK (ApiResponse<DailyLogDto>)
    deactivate Controller
    Service -->> UI: 25. success callback (unwrapped DailyLogDto)
    deactivate Service
    UI -->> User: 26. Close modal + success toast notification
    deactivate UI
```
