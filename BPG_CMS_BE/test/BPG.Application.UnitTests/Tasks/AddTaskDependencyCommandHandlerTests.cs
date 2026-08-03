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
    public class AddTaskDependencyCommandHandlerTests
    {
        private const long CurrentUserId = 10;
        private const long ProjectId = 5;
        private const long PhaseId = 10;
        private const long TaskId = 100;
        private const long PredecessorTaskId = 90;

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly Mock<IGenericRepository<ProjectTask>> _mockTaskRepo;
        private readonly Mock<IGenericRepository<ProjectMember>> _mockMemberRepo;
        private readonly Mock<IGenericRepository<TaskDependency>> _mockDependencyRepo;
        private readonly AddTaskDependencyCommandHandler _handler;

        public AddTaskDependencyCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();
            _mockTaskRepo = new Mock<IGenericRepository<ProjectTask>>();
            _mockMemberRepo = new Mock<IGenericRepository<ProjectMember>>();
            _mockDependencyRepo = new Mock<IGenericRepository<TaskDependency>>();

            _mockUow.Setup(u => u.Repository<ProjectTask>()).Returns(_mockTaskRepo.Object);
            _mockUow.Setup(u => u.Repository<ProjectMember>()).Returns(_mockMemberRepo.Object);
            _mockUow.Setup(u => u.Repository<TaskDependency>()).Returns(_mockDependencyRepo.Object);
            _mockUow.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

            SetupTasks(DefaultTask(), DefaultTask(PredecessorTaskId));
            SetupProjectMembers();
            SetupDependencies();

            _handler = new AddTaskDependencyCommandHandler(
                _mockUow.Object,
                ServiceStubFactory.RealtimeSender(),
                _mockCurrentUserService.Object);
        }

        [Fact]
        public async Task UTCID01_Handle_ValidDependency_ShouldReturnSuccess()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.TechnicalManager);

            var result = await _handler.Handle(Command(), CancellationToken.None);

            result.Success.Should().BeTrue();
            _mockDependencyRepo.Verify(r => r.AddAsync(It.IsAny<TaskDependency>(), It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID02_Handle_TaskNotFound_ShouldThrowNotFoundException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.TechnicalManager);
            SetupTasks(DefaultTask(PredecessorTaskId));

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<NotFoundException>();
            exception.Which.ErrorCode.Should().Be("BIZ_001");
        }

        [Fact]
        public async Task UTCID03_Handle_PredecessorNotFound_ShouldThrowNotFoundException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.TechnicalManager);
            SetupTasks(DefaultTask());

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<NotFoundException>();
            exception.Which.ErrorCode.Should().Be("BIZ_001");
        }

        [Fact]
        public async Task UTCID04_Handle_SelfDependency_ShouldThrowBusinessException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.TechnicalManager);
            SetupTasks(DefaultTask());

            var act = async () => await _handler.Handle(Command(TaskId, TaskId), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_DEPENDENCY_SELF");
        }

        [Fact]
        public async Task UTCID05_Handle_DifferentPhases_ShouldThrowBusinessException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.TechnicalManager);
            SetupTasks(
                DefaultTask(TaskId, phaseId: 10),
                DefaultTask(PredecessorTaskId, phaseId: 20));

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_DEPENDENCY_DIFFERENT_PHASES");
        }

        [Fact]
        public async Task UTCID06_Handle_DependencyAlreadyExists_ShouldReturnSuccessIdempotent()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.TechnicalManager);
            SetupDependencies(new TaskDependency { TaskId = TaskId, PredecessorTaskId = PredecessorTaskId });

            var result = await _handler.Handle(Command(), CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Message.Should().Be("Liên kết phụ thuộc đã tồn tại.");
        }

        [Fact]
        public async Task UTCID07_Handle_SiteEngineerNotLeader_ShouldThrowForbiddenException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.SiteEngineer);
            _mockMemberRepo.Setup(r => r.AnyAsync(It.IsAny<System.Linq.Expressions.Expression<Func<ProjectMember, bool>>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(false);

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            await act.Should().ThrowAsync<ForbiddenException>();
        }

        [Fact]
        public async Task UTCID08_Handle_ParentDependsOnChild_ShouldThrowBusinessException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.TechnicalManager);
            SetupTasks(
                DefaultTask(TaskId),
                DefaultTask(PredecessorTaskId, parentTaskId: TaskId));

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_DEPENDENCY_CHILD");
        }

        [Fact]
        public async Task UTCID09_Handle_ChildDependsOnParent_ShouldThrowBusinessException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.TechnicalManager);
            SetupTasks(
                DefaultTask(TaskId, parentTaskId: PredecessorTaskId),
                DefaultTask(PredecessorTaskId));

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_DEPENDENCY_PARENT");
        }

        [Fact]
        public async Task UTCID10_Handle_CircularDependency_ShouldThrowBusinessException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.TechnicalManager);
            
            // Existing dependency: Predecessor -> Task
            // New dependency: Task -> Predecessor (causes cycle)
            SetupDependencies(new TaskDependency 
            { 
                TaskId = PredecessorTaskId, 
                PredecessorTaskId = TaskId,
                Task = new ProjectTask { Phase = new Phase { ProjectId = ProjectId } }
            });

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_CIRCULAR_DEPENDENCY");
        }

        // ==================== Factory Methods ====================

        private static AddTaskDependencyCommand Command(long taskId = TaskId, long predecessorTaskId = PredecessorTaskId)
            => new(taskId, predecessorTaskId);

        private static ProjectTask DefaultTask(long taskId = TaskId, long phaseId = PhaseId, long? parentTaskId = null)
            => new()
            {
                TaskId = taskId,
                PhaseId = phaseId,
                ParentTaskId = parentTaskId,
                Name = $"Test Task {taskId}",
                Phase = new Phase { PhaseId = phaseId, ProjectId = ProjectId }
            };

        // ==================== Setup Methods ====================

        private void SetupTasks(params ProjectTask[] tasks)
        {
            _mockTaskRepo.Setup(r => r.Query()).Returns(tasks.AsQueryable().BuildMock());
        }

        private void SetupProjectMembers(params ProjectMember[] members)
        {
            _mockMemberRepo.Setup(r => r.Query()).Returns(members.AsQueryable().BuildMock());
        }

        private void SetupDependencies(params TaskDependency[] dependencies)
        {
            _mockDependencyRepo.Setup(r => r.Query()).Returns(dependencies.AsQueryable().BuildMock());
        }
    }
}
