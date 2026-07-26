using AutoMapper;
using BPG.Application.DTOs.DailyLogs;
using BPG.Application.Features.DailyLogs.Commands;
using BPG.Application.Features.DailyLogs.Handlers;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Application.UnitTests.Helpers;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using MockQueryable;
using Moq;
using DomainTaskStatus = BPG.Domain.Constants.TaskStatus;
using RoleConstants = BPG.Domain.Constants.UserRole;

namespace BPG.Application.UnitTests.DailyLogs
{
    public class CreateDailyLogCommandHandlerTests
    {
        private const long CurrentUserId = 10;
        private const long ProjectId = 5;
        private const long TaskId = 100;
        private const long ParentTaskId = 90;
        private const long GeneratedLogId = 800;
        private const string ProjectGroup = "Project_5";
        private const string ReceiveDailyLogCreated = "ReceiveDailyLogCreated";

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IMapper> _mockMapper;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly Mock<INotificationService> _mockNotificationService;
        private readonly Mock<IRealtimeNotificationSender> _mockRealtimeSender;
        private readonly Mock<IGenericRepository<ProjectTask>> _mockTaskRepo;
        private readonly Mock<IGenericRepository<ProjectMember>> _mockMemberRepo;
        private readonly Mock<IGenericRepository<TaskAssignee>> _mockAssigneeRepo;
        private readonly Mock<IGenericRepository<TaskDependency>> _mockDependencyRepo;
        private readonly Mock<IGenericRepository<DailyLog>> _mockLogRepo;
        private readonly Mock<IGenericRepository<Attachment>> _mockAttachmentRepo;
        private readonly Mock<IGenericRepository<TaskProgressLog>> _mockProgressLogRepo;
        private readonly Mock<IGenericRepository<User>> _mockUserRepo;
        private readonly Mock<IGenericRepository<SystemConfig>> _mockConfigRepo;
        private readonly CreateDailyLogCommandHandler _handler;

        public CreateDailyLogCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockMapper = new Mock<IMapper>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();
            _mockNotificationService = new Mock<INotificationService>();
            _mockRealtimeSender = new Mock<IRealtimeNotificationSender>();
            _mockTaskRepo = new Mock<IGenericRepository<ProjectTask>>();
            _mockMemberRepo = new Mock<IGenericRepository<ProjectMember>>();
            _mockAssigneeRepo = new Mock<IGenericRepository<TaskAssignee>>();
            _mockDependencyRepo = new Mock<IGenericRepository<TaskDependency>>();
            _mockLogRepo = new Mock<IGenericRepository<DailyLog>>();
            _mockAttachmentRepo = new Mock<IGenericRepository<Attachment>>();
            _mockProgressLogRepo = new Mock<IGenericRepository<TaskProgressLog>>();
            _mockUserRepo = new Mock<IGenericRepository<User>>();
            _mockConfigRepo = new Mock<IGenericRepository<SystemConfig>>();

            _mockUow.Setup(u => u.Repository<ProjectTask>()).Returns(_mockTaskRepo.Object);
            _mockUow.Setup(u => u.Repository<ProjectMember>()).Returns(_mockMemberRepo.Object);
            _mockUow.Setup(u => u.Repository<TaskAssignee>()).Returns(_mockAssigneeRepo.Object);
            _mockUow.Setup(u => u.Repository<TaskDependency>()).Returns(_mockDependencyRepo.Object);
            _mockUow.Setup(u => u.Repository<DailyLog>()).Returns(_mockLogRepo.Object);
            _mockUow.Setup(u => u.Repository<Attachment>()).Returns(_mockAttachmentRepo.Object);
            _mockUow.Setup(u => u.Repository<TaskProgressLog>()).Returns(_mockProgressLogRepo.Object);
            _mockUow.Setup(u => u.Repository<User>()).Returns(_mockUserRepo.Object);
            _mockUow.Setup(u => u.Repository<SystemConfig>()).Returns(_mockConfigRepo.Object);

            SetupProjectMembers();
            SetupTaskAssignees();
            SetupDependencies();
            SetupSystemConfig();
            SetupCreator("Admin User");
            SetupDailyLogIdGeneration();
            SetupMapper();

            _handler = new CreateDailyLogCommandHandler(
                _mockUow.Object,
                _mockMapper.Object,
                _mockCurrentUserService.Object,
                _mockNotificationService.Object,
                _mockRealtimeSender.Object);
        }

        [Fact]
        public async Task UTCID01_Handle_ValidLeafTaskWithImages_ShouldCreateLogUpdateProgressAndNotify()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.TechnicalManager);
            var task = LeafTask(name: "Concrete Slab", progress: 20);
            SetupTasks(task);

            var command = Command(
                progress: 50,
                description: "Poured half slab",
                images: new[] { "1", "2", "3", "4", "5", "6", "7", "8" });

            var result = await _handler.Handle(command, CancellationToken.None);

            result.Should().BeEquivalentTo(new DailyLogDto
            {
                LogId = GeneratedLogId,
                TaskId = TaskId,
                TaskName = "Concrete Slab",
                CreatorName = "Admin User",
                OldProgressPercent = 20,
                NewProgressPercent = 50,
                Description = "Poured half slab",
                Images = command.Images,
                EditWindowHours = 24,
                CanEdit = true
            }, options => options.Excluding(dto => dto.LogDate).Excluding(dto => dto.CreatedAt));
            task.ProgressPercent.Should().Be(50);
            task.Status.Should().Be(DomainTaskStatus.InProgress);
            VerifyAttachmentsSaved(8);
            VerifyProgressLogSaved(TaskId, 20, 50);
            VerifyCommittedAndRealtimeSent();
        }

        [Fact]
        public async Task UTCID02_Handle_ProgressPercent100_ShouldSetTaskCompleted()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.TechnicalManager);
            var task = LeafTask(progress: 50);
            SetupTasks(task);

            var result = await _handler.Handle(Command(progress: 100, description: "Finished Slab"), CancellationToken.None);

            result.NewProgressPercent.Should().Be(100);
            result.OldProgressPercent.Should().Be(50);
            task.ProgressPercent.Should().Be(100);
            task.Status.Should().Be(DomainTaskStatus.Completed);
            VerifyCommittedAndRealtimeSent();
        }

        [Fact]
        public async Task UTCID03_Handle_TaskNotFound_ShouldThrowNotFoundException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.TechnicalManager);
            SetupTasks();

            var act = async () => await _handler.Handle(Command(taskId: 999, progress: 50), CancellationToken.None);

            await act.Should().ThrowAsync<NotFoundException>()
                .WithMessage("ProjectTask với ID [999] không tồn tại.");
            VerifyTransactionNeverStarted();
        }

        [Fact]
        public async Task UTCID04_Handle_ProjectNotInProgress_ShouldThrowBusinessException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.TechnicalManager);
            SetupTasks(LeafTask(projectStatus: ProjectStatus.Completed));

            var act = async () => await _handler.Handle(Command(progress: 50), CancellationToken.None);

            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage(ValidationMessages.ProjectNotActive);
            VerifyTransactionNeverStarted();
        }

        [Fact]
        public async Task UTCID05_Handle_LockedAncestorTask_ShouldThrowBusinessException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.TechnicalManager);
            var parentTask = LeafTask(taskId: ParentTaskId, name: "Structure Parent", isLocked: true);
            var childTask = LeafTask(parentTaskId: ParentTaskId, name: "Slab");
            SetupTasks(parentTask, childTask);

            var act = async () => await _handler.Handle(Command(progress: 50), CancellationToken.None);

            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("*Structure Parent*");
            VerifyTransactionNeverStarted();
        }

        [Fact]
        public async Task UTCID06_Handle_TaskHasActiveSubtasks_ShouldThrowBusinessException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.TechnicalManager);
            SetupTasks(ParentTaskWithChild());

            var act = async () => await _handler.Handle(Command(progress: 50), CancellationToken.None);

            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Không thể cập nhật tiến độ thủ công cho công việc cha có chứa các công việc con.");
            VerifyTransactionNeverStarted();
        }

        [Fact]
        public async Task UTCID07_Handle_AnyPredecessorIncomplete_ShouldThrowBusinessException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.TechnicalManager);
            SetupTasks(LeafTask(progress: 0));
            SetupDependencies(
                Dependency(91, "Completed Foundation", 100, DomainTaskStatus.Completed),
                Dependency(92, "Unfinished Foundation Work", 50, DomainTaskStatus.InProgress));

            var act = async () => await _handler.Handle(Command(progress: 10, description: "Trying to progress despite incomplete predecessor"), CancellationToken.None);

            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("*Unfinished Foundation Work*");
            VerifyTransactionNeverStarted();
        }

        [Fact]
        public async Task UTCID08_Handle_DecreaseProgressByProjectLeader_ShouldThrowBusinessException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.SiteEngineer, hasRole: false);
            SetupTasks(LeafTask(progress: 50));
            SetupProjectMembers(new ProjectMember { ProjectId = ProjectId, UserId = CurrentUserId, IsLeader = true });

            var act = async () => await _handler.Handle(Command(progress: 30, description: "Correction needed"), CancellationToken.None);

            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Chỉ Quản trị viên hoặc Trưởng phòng kỹ thuật mới có quyền giảm tiến độ công việc.");
            VerifyTransactionNeverStarted();
        }

        [Fact]
        public async Task UTCID09_Handle_DecreaseProgressByTechnicalManagerWithoutReason_ShouldThrowBusinessException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.TechnicalManager);
            SetupTasks(LeafTask(progress: 50));

            var act = async () => await _handler.Handle(Command(progress: 30, description: string.Empty), CancellationToken.None);

            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Vui lòng nhập lý do giảm tiến độ công việc.");
            VerifyTransactionNeverStarted();
        }

        [Fact]
        public async Task UTCID10_Handle_DecreaseChildProgressByTechnicalManager_ShouldRollUpParentAndCreateParentLog()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.TechnicalManager);
            SetupCreator("TM User");
            var parentTask = LeafTask(taskId: ParentTaskId, progress: 80);
            var childTask = LeafTask(parentTaskId: ParentTaskId, progress: 80);
            parentTask.SubTasks.Add(childTask);
            SetupTasks(parentTask, childTask);
            var capturedLogs = CaptureAddedDailyLogs();

            var result = await _handler.Handle(Command(progress: 50, description: "Decreasing child task progress"), CancellationToken.None);

            result.CreatorName.Should().Be("TM User");
            result.OldProgressPercent.Should().Be(80);
            result.NewProgressPercent.Should().Be(50);
            childTask.ProgressPercent.Should().Be(50);
            parentTask.ProgressPercent.Should().Be(50);
            capturedLogs.Should().ContainSingle(log => log.TaskId == TaskId && log.NewProgressPercent == 50);
            capturedLogs.Should().ContainSingle(log => log.TaskId == ParentTaskId && log.NewProgressPercent == 50 && log.Description.Contains("Tiến độ giảm tự động"));
            VerifyCommittedAndRealtimeSent();
        }

        [Fact]
        public async Task UTCID11_Handle_UserWithoutPermission_ShouldThrowForbiddenException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.SiteEngineer, hasRole: false);
            SetupTasks(LeafTask());

            var act = async () => await _handler.Handle(Command(progress: 50), CancellationToken.None);

            await act.Should().ThrowAsync<ForbiddenException>()
                .WithMessage("Chỉ Trưởng dự án (Leader), Ban quản lý hoặc Kỹ sư được gán vào công việc mới được phép tạo nhật ký thi công.");
            VerifyTransactionNeverStarted();
        }

        [Fact]
        public async Task UTCID12_Handle_ExceptionDuringTransaction_ShouldRollbackAndRethrow()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.TechnicalManager);
            SetupTasks(LeafTask());
            _mockUow.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ThrowsAsync(new Exception("DB Error"));

            var act = async () => await _handler.Handle(Command(progress: 50, description: "Succeed"), CancellationToken.None);

            await act.Should().ThrowAsync<Exception>().WithMessage("DB Error");
            _mockUow.Verify(u => u.RollbackTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID13_Handle_AssignedEngineerReportsZeroProgress_ShouldSkipDependencyBlockAndSucceed()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.SiteEngineer, hasRole: false);
            var task = LeafTask(progress: 0);
            SetupTasks(task);
            SetupTaskAssignees(new TaskAssignee { TaskId = TaskId, UserId = CurrentUserId });
            SetupDependencies(Dependency(99, "Unfinished Prep Work", 50, DomainTaskStatus.InProgress));

            var result = await _handler.Handle(Command(progress: 0, description: "Site inspection, no progress yet"), CancellationToken.None);

            result.NewProgressPercent.Should().Be(0);
            result.CanEdit.Should().BeTrue();
            task.ProgressPercent.Should().Be(0);
            VerifyCommittedAndRealtimeSent();
        }

        private static CreateDailyLogCommand Command(
            long taskId = TaskId,
            byte progress = 50,
            string description = "",
            IEnumerable<string>? images = null)
            => new()
            {
                TaskId = taskId,
                NewProgressPercent = progress,
                Description = description,
                Images = images?.ToList() ?? new List<string>()
            };

        private static ProjectTask LeafTask(
            long taskId = TaskId,
            long? parentTaskId = null,
            string? name = null,
            byte progress = 0,
            bool isLocked = false,
            string projectStatus = ProjectStatus.InProgress)
            => new()
            {
                TaskId = taskId,
                ParentTaskId = parentTaskId,
                Name = name ?? string.Empty,
                ProgressPercent = progress,
                IsLocked = isLocked,
                Phase = new Phase { Project = new Project { ProjectId = ProjectId, Name = "BPG Project", Status = projectStatus } },
                SubTasks = new List<ProjectTask>()
            };

        private static ProjectTask ParentTaskWithChild()
        {
            var parentTask = LeafTask();
            parentTask.SubTasks.Add(new ProjectTask { TaskId = 101, IsDeleted = false });
            return parentTask;
        }

        private static TaskDependency Dependency(long predecessorTaskId, string predecessorName, byte progress, string status)
            => new()
            {
                TaskId = TaskId,
                PredecessorTaskId = predecessorTaskId,
                Predecessor = new ProjectTask
                {
                    TaskId = predecessorTaskId,
                    Name = predecessorName,
                    ProgressPercent = progress,
                    Status = status
                }
            };

        private void SetupTasks(params ProjectTask[] tasks)
        {
            _mockTaskRepo.Setup(r => r.Query()).Returns(tasks.AsQueryable().BuildMock());
        }

        private void SetupProjectMembers(params ProjectMember[] members)
        {
            _mockMemberRepo.Setup(r => r.Query()).Returns(members.AsQueryable().BuildMock());
        }

        private void SetupTaskAssignees(params TaskAssignee[] assignees)
        {
            _mockAssigneeRepo.Setup(r => r.Query()).Returns(assignees.AsQueryable().BuildMock());
        }

        private void SetupDependencies(params TaskDependency[] dependencies)
        {
            _mockDependencyRepo.Setup(r => r.Query()).Returns(dependencies.AsQueryable().BuildMock());
        }

        private void SetupCreator(string fullName)
        {
            var user = new User { UserId = CurrentUserId, FullName = fullName, UserRoles = new List<BPG.Domain.Entities.UserRole>() };
            _mockUserRepo.Setup(r => r.Query()).Returns(new[] { user }.AsQueryable().BuildMock());
        }

        private void SetupSystemConfig()
        {
            var configs = new[]
            {
                new SystemConfig { ConfigKey = SystemConfigKeys.DailyLogEditWindowHours, ConfigValue = "24" }
            };
            _mockConfigRepo.Setup(r => r.Query()).Returns(configs.AsQueryable().BuildMock());
        }

        private void SetupDailyLogIdGeneration()
        {
            _mockLogRepo.Setup(r => r.AddAsync(It.IsAny<DailyLog>(), It.IsAny<CancellationToken>()))
                .Callback<DailyLog, CancellationToken>((log, _) => log.LogId = GeneratedLogId)
                .Returns(Task.CompletedTask);
        }

        private List<DailyLog> CaptureAddedDailyLogs()
        {
            var capturedLogs = new List<DailyLog>();
            _mockLogRepo.Setup(r => r.AddAsync(It.IsAny<DailyLog>(), It.IsAny<CancellationToken>()))
                .Callback<DailyLog, CancellationToken>((log, _) =>
                {
                    log.LogId = GeneratedLogId + capturedLogs.Count;
                    capturedLogs.Add(log);
                })
                .Returns(Task.CompletedTask);
            return capturedLogs;
        }

        private void SetupMapper()
        {
            _mockMapper.Setup(m => m.Map<DailyLogDto>(It.IsAny<DailyLog>()))
                .Returns((DailyLog source) => new DailyLogDto
                {
                    LogId = source.LogId,
                    TaskId = source.TaskId,
                    NewProgressPercent = source.NewProgressPercent,
                    Description = source.Description
                });
        }

        private void VerifyAttachmentsSaved(int count)
        {
            _mockAttachmentRepo.Verify(r => r.AddRangeAsync(
                It.Is<IEnumerable<Attachment>>(attachments => attachments.Count() == count),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        private void VerifyProgressLogSaved(long taskId, byte oldProgress, byte newProgress)
        {
            _mockProgressLogRepo.Verify(r => r.AddAsync(It.Is<TaskProgressLog>(log =>
                log.TaskId == taskId &&
                log.OldProgress == oldProgress &&
                log.NewProgress == newProgress), It.IsAny<CancellationToken>()), Times.Once);
        }

        private void VerifyCommittedAndRealtimeSent()
        {
            _mockUow.Verify(u => u.BeginTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
            _mockUow.Verify(u => u.CommitTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
            _mockRealtimeSender.Verify(s => s.SendToGroupAsync(
                ProjectGroup, ReceiveDailyLogCreated, It.IsAny<DailyLogDto>(), It.IsAny<CancellationToken>()), Times.Once);
        }

        private void VerifyTransactionNeverStarted()
        {
            _mockUow.Verify(u => u.BeginTransactionAsync(It.IsAny<CancellationToken>()), Times.Never);
            _mockLogRepo.Verify(r => r.AddAsync(It.IsAny<DailyLog>(), It.IsAny<CancellationToken>()), Times.Never);
        }
    }
}
