using BPG.Application.Common.Models;
using BPG.Application.Features.Tasks.Commands;
using BPG.Application.Features.Tasks.Handlers;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Application.UnitTests.Helpers;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using MockQueryable;
using Moq;
using RoleConstants = BPG.Domain.Constants.UserRole;

namespace BPG.Application.UnitTests.Tasks
{
    public class RestoreTaskCommandHandlerTests
    {
        private const long CurrentUserId = 10;
        private const long ProjectId = 5;
        private const long PhaseId = 10;
        private const long TaskId = 100;

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly Mock<IGenericRepository<ProjectTask>> _mockTaskRepo;
        private readonly Mock<IGenericRepository<ProjectMember>> _mockMemberRepo;
        private readonly Mock<IGenericRepository<TaskDependency>> _mockDependencyRepo;
        private readonly Mock<IGenericRepository<User>> _mockUserRepo;
        private readonly RestoreTaskCommandHandler _handler;

        public RestoreTaskCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();
            _mockTaskRepo = new Mock<IGenericRepository<ProjectTask>>();
            _mockMemberRepo = new Mock<IGenericRepository<ProjectMember>>();
            _mockDependencyRepo = new Mock<IGenericRepository<TaskDependency>>();
            _mockUserRepo = new Mock<IGenericRepository<User>>();

            _mockUow.Setup(u => u.Repository<ProjectTask>()).Returns(_mockTaskRepo.Object);
            _mockUow.Setup(u => u.Repository<ProjectMember>()).Returns(_mockMemberRepo.Object);
            _mockUow.Setup(u => u.Repository<TaskDependency>()).Returns(_mockDependencyRepo.Object);
            _mockUow.Setup(u => u.Repository<User>()).Returns(_mockUserRepo.Object);
            _mockUow.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

            SetupTasks(ObsoleteTask());
            SetupDependencies();
            SetupUser("Admin User");

            _handler = new RestoreTaskCommandHandler(
                _mockUow.Object,
                ServiceStubFactory.ProgressRollupService(),
                ServiceStubFactory.NotificationService(),
                ServiceStubFactory.RealtimeSender(),
                _mockCurrentUserService.Object);
        }

        [Fact]
        public async Task UTCID01_Handle_ObsoleteTaskNoPredecessor_ShouldReturnSuccess()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.TechnicalManager);

            var result = await _handler.Handle(Command(), CancellationToken.None);

            result.Success.Should().BeTrue();
        }

        [Fact]
        public async Task UTCID02_Handle_TaskNotFound_ShouldThrowNotFoundException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.TechnicalManager);
            SetupTasks();

            var act = async () => await _handler.Handle(Command(999), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<NotFoundException>();
            exception.Which.ErrorCode.Should().Be("BIZ_001");
        }

        [Fact]
        public async Task UTCID03_Handle_SiteEngineerNotLeader_ShouldThrowForbiddenException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.SiteEngineer);
            _mockMemberRepo.Setup(r => r.AnyAsync(It.IsAny<System.Linq.Expressions.Expression<Func<ProjectMember, bool>>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(false);

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            await act.Should().ThrowAsync<ForbiddenException>();
        }

        [Fact]
        public async Task UTCID04_Handle_TaskNotObsolete_ShouldReturnSuccessMessage()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.TechnicalManager);
            SetupTasks(ObsoleteTask(status: BPG.Domain.Constants.TaskStatus.InProgress));

            var result = await _handler.Handle(Command(), CancellationToken.None);

            result.Success.Should().BeTrue();
        }

        [Fact]
        public async Task UTCID05_Handle_ObsoleteDueToEmergency_ShouldThrowBusinessException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.TechnicalManager);
            SetupTasks(ObsoleteTask(obsoleteReason: "Sự cố khẩn cấp tại công trường"));

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_TASK_CANNOT_BE_RESTORED");
        }

        [Fact]
        public async Task UTCID06_Handle_PredecessorStillObsolete_ShouldThrowBusinessException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.TechnicalManager);
            SetupDependencies(new TaskDependency
            {
                TaskId = TaskId,
                PredecessorTaskId = 91,
                Predecessor = new ProjectTask
                {
                    TaskId = 91,
                    Name = "Predecessor",
                    Status = BPG.Domain.Constants.TaskStatus.Obsolete
                }
            });

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_DEPENDENCY_OBSOLETE");
        }

        [Fact]
        public async Task UTCID07_Handle_Progress100_ShouldRestoreToCompleted()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.TechnicalManager);
            var task = ObsoleteTask(progress: 100);
            SetupTasks(task);

            await _handler.Handle(Command(), CancellationToken.None);

            task.Status.Should().Be(BPG.Domain.Constants.TaskStatus.Completed);
        }

        [Fact]
        public async Task UTCID08_Handle_ProgressAboveZero_ShouldRestoreToInProgress()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.TechnicalManager);
            var task = ObsoleteTask(progress: 50);
            SetupTasks(task);

            await _handler.Handle(Command(), CancellationToken.None);

            task.Status.Should().Be(BPG.Domain.Constants.TaskStatus.InProgress);
        }

        [Fact]
        public async Task UTCID09_Handle_ProgressZeroWithAssignees_ShouldRestoreToAssigned()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.TechnicalManager);
            var task = ObsoleteTask(progress: 0);
            task.Assignees.Add(new TaskAssignee { TaskId = TaskId, UserId = 20 });
            SetupTasks(task);

            await _handler.Handle(Command(), CancellationToken.None);

            task.Status.Should().Be(BPG.Domain.Constants.TaskStatus.Assigned);
        }

        // ==================== Factory Methods ====================

        private static RestoreTaskCommand Command(long taskId = TaskId) => new(taskId);

        private static ProjectTask ObsoleteTask(
            byte progress = 30,
            string? obsoleteReason = "Không phù hợp",
            string status = "Obsolete")
            => new()
            {
                TaskId = TaskId,
                PhaseId = PhaseId,
                Name = "Test Task",
                Status = status,
                ProgressPercent = progress,
                ObsoleteReason = obsoleteReason,
                Phase = new Phase { PhaseId = PhaseId, ProjectId = ProjectId },
                Assignees = new List<TaskAssignee>(),
                ProgressLogs = new List<TaskProgressLog>(),
                SubTasks = new List<ProjectTask>()
            };

        // ==================== Setup Methods ====================

        private void SetupTasks(params ProjectTask[] tasks)
        {
            _mockTaskRepo.Setup(r => r.Query()).Returns(tasks.AsQueryable().BuildMock());
        }

        private void SetupDependencies(params TaskDependency[] dependencies)
        {
            _mockDependencyRepo.Setup(r => r.Query()).Returns(dependencies.AsQueryable().BuildMock());
        }

        private void SetupUser(string fullName)
        {
            var user = new User { UserId = CurrentUserId, FullName = fullName, UserRoles = new List<BPG.Domain.Entities.UserRole>() };
            _mockUserRepo.Setup(r => r.GetByIdAsync(CurrentUserId, It.IsAny<CancellationToken>())).ReturnsAsync(user);
        }
    }
}
