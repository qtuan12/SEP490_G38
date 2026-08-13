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

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IMapper> _mockMapper;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
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
            _mockUow.Setup(u => u.BeginTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
            _mockUow.Setup(u => u.ExecuteSqlAsync(It.IsAny<FormattableString>(), It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
            _mockUow.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
            _mockUow.Setup(u => u.CommitTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
            _mockUow.Setup(u => u.RollbackTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
            _mockAttachmentRepo.Setup(r => r.AddRangeAsync(It.IsAny<IEnumerable<Attachment>>(), It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);
            _mockProgressLogRepo.Setup(r => r.AddAsync(It.IsAny<TaskProgressLog>(), It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);

            SetupProjectMembers();
            SetupTaskAssignees();
            SetupDependencies();
            SetupSystemConfig();
            SetupCreator("Site Engineer");
            SetupDailyLogIdGeneration();
            SetupMapper();

            _handler = new CreateDailyLogCommandHandler(
                _mockUow.Object,
                _mockMapper.Object,
                _mockCurrentUserService.Object,
                ServiceStubFactory.NotificationService(),
                ServiceStubFactory.RealtimeSender(),
                ServiceStubFactory.ProgressRollupService());
        }

        [Fact]
        public async Task UTCID01_Handle_AssignedSiteEngineerWithValidLeafTask_ShouldReturnDailyLogDto()
        {
            SetupAssignedSiteEngineer();
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
                CreatorName = "Site Engineer",
                OldProgressPercent = 20,
                NewProgressPercent = 50,
                Description = "Poured half slab",
                Images = command.Images,
                EditWindowHours = 24,
                CanEdit = true
            }, options => options.Excluding(dto => dto.LogDate).Excluding(dto => dto.CreatedAt));
        }

        [Fact]
        public async Task UTCID02_Handle_ProgressPercent100_ShouldReturnDailyLogDto()
        {
            SetupAssignedSiteEngineer();
            var task = LeafTask(progress: 50);
            SetupTasks(task);

            var result = await _handler.Handle(Command(progress: 100, description: "Finished Slab"), CancellationToken.None);

            result.NewProgressPercent.Should().Be(100);
            result.OldProgressPercent.Should().Be(50);
        }

        [Fact]
        public async Task UTCID03_Handle_TaskNotFound_ShouldThrowNotFoundException()
        {
            SetupAssignedSiteEngineer();
            SetupTasks();

            var act = async () => await _handler.Handle(Command(taskId: 999, progress: 50), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<NotFoundException>();
            exception.Which.ErrorCode.Should().Be("BIZ_001");
            exception.Which.Message.Should().Be("Công việc với ID [999] không tồn tại.");
        }

        [Fact]
        public async Task UTCID04_Handle_ProjectNotInProgress_ShouldThrowBusinessException()
        {
            SetupAssignedSiteEngineer();
            SetupTasks(LeafTask(projectStatus: ProjectStatus.Completed));

            var act = async () => await _handler.Handle(Command(progress: 50), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_PROJECT_NOT_ACTIVE");
            exception.Which.Message.Should().Be(ValidationMessages.ProjectNotActive);
        }

        [Fact]
        public async Task UTCID05_Handle_LockedAncestorTask_ShouldThrowBusinessException()
        {
            SetupAssignedSiteEngineer();
            var parentTask = LeafTask(taskId: ParentTaskId, name: "Structure Parent", isLocked: true);
            var childTask = LeafTask(parentTaskId: ParentTaskId, name: "Slab");
            SetupTasks(parentTask, childTask);

            var act = async () => await _handler.Handle(Command(progress: 50), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_TASK_LOCKED");
            exception.Which.Message.Should().Be("Không thể cập nhật tiến độ vì công việc hoặc cấp cha [Structure Parent] đã được nghiệm thu và khóa.");
        }

        [Fact]
        public async Task UTCID06_Handle_TaskHasActiveSubtasks_ShouldThrowBusinessException()
        {
            SetupAssignedSiteEngineer();
            SetupTasks(ParentTaskWithChild());

            var act = async () => await _handler.Handle(Command(progress: 50), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_TASK_HAS_SUBTASKS");
            exception.Which.Message.Should().Be("Không thể cập nhật tiến độ thủ công cho công việc cha có chứa các công việc con.");
        }

        [Fact]
        public async Task UTCID07_Handle_AnyPredecessorIncomplete_ShouldThrowBusinessException()
        {
            SetupAssignedSiteEngineer();
            SetupTasks(LeafTask(progress: 0));
            SetupDependencies(
                Dependency(91, "Completed Foundation", 100, DomainTaskStatus.Completed),
                Dependency(92, "Unfinished Foundation Work", 50, DomainTaskStatus.InProgress));

            var act = async () => await _handler.Handle(Command(progress: 10, description: "Trying to progress despite incomplete predecessor"), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_TASK_DEPENDENCY_BLOCKED");
            exception.Which.Message.Should().Be("Không thể cập nhật tiến độ. Các công việc tiên quyết chưa hoàn thành: Unfinished Foundation Work");
        }

        [Fact]
        public async Task UTCID08_Handle_DecreaseProgressByProjectLeader_ShouldThrowBusinessException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.SiteEngineer);
            SetupTasks(LeafTask(progress: 50));
            SetupProjectMembers(new ProjectMember { ProjectId = ProjectId, UserId = CurrentUserId, IsLeader = true });

            var act = async () => await _handler.Handle(Command(progress: 30, description: "Correction needed"), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_DECREASE_PROGRESS_FORBIDDEN");
            exception.Which.Message.Should().Be("Không thể giảm tiến độ qua nhật ký thi công. Vui lòng sử dụng chức năng điều chỉnh tiến độ được cấp quyền.");
        }

        [Theory]
        [InlineData(RoleConstants.Admin)]
        [InlineData(RoleConstants.TechnicalManager)]
        public async Task UTCID09_Handle_ManagerWhoAlsoHasSiteEngineerRole_ShouldThrowForbiddenBeforeTaskLookup(string role)
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, role, RoleConstants.SiteEngineer);
            SetupTasks();

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<ForbiddenException>();
            exception.Which.ErrorCode.Should().Be(ErrorCodes.Forbidden);
        }

        [Fact]
        public async Task UTCID10_Handle_UnassignedSiteEngineerWhoIsNotProjectLeader_ShouldThrowForbiddenException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.SiteEngineer);
            SetupTasks(LeafTask());
            SetupProjectMembers(new ProjectMember { ProjectId = ProjectId, UserId = CurrentUserId });

            var act = async () => await _handler.Handle(Command(progress: 50), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<ForbiddenException>();
            exception.Which.ErrorCode.Should().Be("AUTH_002");
            exception.Which.Message.Should().Be("Chỉ Trưởng dự án hoặc Kỹ sư được gán vào công việc mới được phép tạo nhật ký thi công.");
        }

        [Fact]
        public async Task UTCID11_Handle_HistoricalAssigneeWithoutActiveProjectMembership_ShouldThrowForbiddenException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.SiteEngineer);
            SetupTasks(LeafTask());
            SetupProjectMembers(new ProjectMember
            {
                ProjectId = ProjectId,
                UserId = CurrentUserId,
                IsDeleted = true
            });
            SetupTaskAssignees(new TaskAssignee { TaskId = TaskId, UserId = CurrentUserId });

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<ForbiddenException>();
            exception.Which.ErrorCode.Should().Be(ErrorCodes.Forbidden);
            exception.Which.Message.Should().Be("Chỉ thành viên hiện tại của dự án mới được phép tạo nhật ký thi công.");
        }

        [Fact]
        public async Task UTCID12_Handle_AssignedActiveProjectMemberReportsZeroProgress_ShouldReturnDailyLogDto()
        {
            SetupAssignedSiteEngineer();
            var task = LeafTask(progress: 0);
            SetupTasks(task);
            SetupDependencies(Dependency(99, "Unfinished Prep Work", 50, DomainTaskStatus.InProgress));

            var result = await _handler.Handle(Command(progress: 0, description: "Site inspection, no progress yet"), CancellationToken.None);

            result.NewProgressPercent.Should().Be(0);
            result.CanEdit.Should().BeTrue();
        }

        [Fact]
        public async Task UTCID13_Handle_ProjectLeaderIncreasesProgress_ShouldReturnDailyLogDto()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.SiteEngineer);
            SetupTasks(LeafTask(name: "Leader Task", progress: 10));
            SetupProjectMembers(new ProjectMember { ProjectId = ProjectId, UserId = CurrentUserId, IsLeader = true });

            var result = await _handler.Handle(Command(progress: 40, description: "Leader progress update"), CancellationToken.None);

            result.TaskName.Should().Be("Leader Task");
            result.OldProgressPercent.Should().Be(10);
            result.NewProgressPercent.Should().Be(40);
            result.Description.Should().Be("Leader progress update");
        }

        [Fact]
        public async Task UTCID14_Handle_ProjectLeaderFromAnotherProject_ShouldThrowForbiddenException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.SiteEngineer);
            SetupTasks(LeafTask());
            SetupProjectMembers(new ProjectMember
            {
                ProjectId = ProjectId + 1,
                UserId = CurrentUserId,
                IsLeader = true
            });

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<ForbiddenException>();
            exception.Which.ErrorCode.Should().Be(ErrorCodes.Forbidden);
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

        private void SetupAssignedSiteEngineer()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.SiteEngineer);
            SetupProjectMembers(new ProjectMember { ProjectId = ProjectId, UserId = CurrentUserId });
            SetupTaskAssignees(new TaskAssignee { TaskId = TaskId, UserId = CurrentUserId });
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
    }
}

