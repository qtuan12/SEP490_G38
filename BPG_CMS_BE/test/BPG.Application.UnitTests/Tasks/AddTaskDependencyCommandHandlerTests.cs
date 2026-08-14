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

namespace BPG.Application.UnitTests.Tasks;

public class AddTaskDependencyCommandHandlerTests
{
    private const long ProjectId = 10;
    private const long PhaseId = 20;
    private const long TaskId = 30;
    private const long PredecessorId = 31;

    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IGenericRepository<ProjectTask>> _taskRepo = new();
    private readonly Mock<IGenericRepository<TaskDependency>> _dependencyRepo = new();
    private readonly Mock<IGenericRepository<ProjectMember>> _memberRepo = new();
    private readonly Mock<ICurrentUserService> _currentUser = new();
    private readonly AddTaskDependencyCommandHandler _handler;

    public AddTaskDependencyCommandHandlerTests()
    {
        _uow.Setup(x => x.Repository<ProjectTask>()).Returns(_taskRepo.Object);
        _uow.Setup(x => x.Repository<TaskDependency>()).Returns(_dependencyRepo.Object);
        _uow.Setup(x => x.Repository<ProjectMember>()).Returns(_memberRepo.Object);
        _uow.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        _dependencyRepo.Setup(x => x.AddAsync(It.IsAny<TaskDependency>(), It.IsAny<CancellationToken>()))
            .Returns(System.Threading.Tasks.Task.CompletedTask);

        _currentUser.SetupUser(1, BPG.Domain.Constants.UserRole.TechnicalManager);
        SetupTasks(Task(TaskId), Task(PredecessorId));
        SetupDependencies();

        _handler = new AddTaskDependencyCommandHandler(
            _uow.Object,
            ServiceStubFactory.RealtimeSender(),
            _currentUser.Object);
    }

    [Fact]
    public async Task UTCID01_Handle_ValidDependency_ShouldReturnSuccess()
    {
        var result = await _handler.Handle(Command(), CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Message.Should().Be("Thêm liên kết phụ thuộc thành công.");
    }

    [Fact]
    public async Task UTCID02_Handle_TaskNotFound_ShouldThrowNotFoundException()
    {
        SetupTasks(Task(PredecessorId));

        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<NotFoundException>();
        exception.Which.ErrorCode.Should().Be(ErrorCodes.NotFound);
    }

    [Fact]
    public async Task UTCID03_Handle_ProjectNotInProgress_ShouldThrowInvalidTransition()
    {
        SetupTasks(Task(TaskId, projectStatus: ProjectStatus.Completed), Task(PredecessorId));

        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be(ErrorCodes.InvalidTransition);
    }

    [Fact]
    public async Task UTCID04_Handle_ProjectLeader_ShouldReturnSuccess()
    {
        _currentUser.SetupUser(1);
        SetupProjectLeaderAccess(true);

        var result = await _handler.Handle(Command(), CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Message.Should().Be("Thêm liên kết phụ thuộc thành công.");
    }

    [Fact]
    public async Task UTCID05_Handle_UserWithoutManagerOrLeaderPermission_ShouldThrowForbiddenException()
    {
        _currentUser.SetupUser(1);
        SetupProjectLeaderAccess(false);

        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<ForbiddenException>();
        exception.Which.ErrorCode.Should().Be(ErrorCodes.Forbidden);
    }

    [Fact]
    public async Task UTCID06_Handle_PredecessorNotFound_ShouldThrowNotFoundException()
    {
        SetupTasks(Task(TaskId));

        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<NotFoundException>();
        exception.Which.ErrorCode.Should().Be(ErrorCodes.NotFound);
        exception.Which.Message.Should().Contain("PredecessorTask");
    }

    [Fact]
    public async Task UTCID07_Handle_SelfDependency_ShouldThrowExpectedErrorCode()
    {
        Func<Task> act = () => _handler.Handle(
            new AddTaskDependencyCommand(TaskId, TaskId), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_DEPENDENCY_SELF");
    }

    [Fact]
    public async Task UTCID08_Handle_PredecessorIsAncestor_ShouldThrowExpectedErrorCode()
    {
        SetupTasks(Task(TaskId, parentTaskId: PredecessorId), Task(PredecessorId));

        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_DEPENDENCY_PARENT");
    }

    [Fact]
    public async Task UTCID09_Handle_PredecessorIsDescendant_ShouldThrowExpectedErrorCode()
    {
        SetupTasks(Task(TaskId), Task(PredecessorId, parentTaskId: TaskId));

        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_DEPENDENCY_CHILD");
    }

    [Fact]
    public async Task UTCID10_Handle_DifferentPhases_ShouldThrowExpectedErrorCode()
    {
        SetupTasks(Task(TaskId), Task(PredecessorId, phaseId: 99));

        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_DEPENDENCY_DIFFERENT_PHASES");
    }

    [Fact]
    public async Task UTCID11_Handle_ExistingDependency_ShouldReturnSuccess()
    {
        SetupDependencies(Dependency(TaskId, PredecessorId));

        var result = await _handler.Handle(Command(), CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Message.Should().Be("Liên kết phụ thuộc đã tồn tại.");
    }

    [Fact]
    public async Task UTCID12_Handle_CircularDependency_ShouldThrowExpectedErrorCode()
    {
        SetupDependencies(Dependency(PredecessorId, TaskId));

        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_CIRCULAR_DEPENDENCY");
    }

    private static AddTaskDependencyCommand Command() => new(TaskId, PredecessorId);

    private static ProjectTask Task(
        long id,
        long phaseId = PhaseId,
        long? parentTaskId = null,
        string projectStatus = ProjectStatus.InProgress) => new()
    {
        TaskId = id,
        PhaseId = phaseId,
        ParentTaskId = parentTaskId,
        Phase = new Phase
        {
            PhaseId = phaseId,
            ProjectId = ProjectId,
            Project = new Project { ProjectId = ProjectId, Status = projectStatus }
        }
    };

    private static TaskDependency Dependency(long taskId, long predecessorId) => new()
    {
        TaskId = taskId,
        PredecessorTaskId = predecessorId,
        Task = Task(taskId)
    };

    private void SetupTasks(params ProjectTask[] tasks) =>
        _taskRepo.Setup(x => x.Query()).Returns(tasks.AsQueryable().BuildMock());

    private void SetupDependencies(params TaskDependency[] dependencies) =>
        _dependencyRepo.Setup(x => x.Query()).Returns(dependencies.AsQueryable().BuildMock());

    private void SetupProjectLeaderAccess(bool isLeader) =>
        _memberRepo.Setup(x => x.AnyAsync(
                It.IsAny<System.Linq.Expressions.Expression<Func<ProjectMember, bool>>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(isLeader);
}
