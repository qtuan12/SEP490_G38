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

public class AdjustTaskProgressCommandHandlerTests
{
    private const long TaskId = 30;

    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IGenericRepository<ProjectTask>> _taskRepo = new();
    private readonly Mock<IGenericRepository<TaskDependency>> _dependencyRepo = new();
    private readonly Mock<ICurrentUserService> _currentUser = new();
    private readonly AdjustTaskProgressCommandHandler _handler;

    public AdjustTaskProgressCommandHandlerTests()
    {
        _uow.Setup(x => x.Repository<ProjectTask>()).Returns(_taskRepo.Object);
        _uow.Setup(x => x.Repository<TaskDependency>()).Returns(_dependencyRepo.Object);
        _uow.Setup(x => x.BeginTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        _uow.Setup(x => x.CommitTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        _uow.Setup(x => x.RollbackTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        _uow.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        _currentUser.SetupUser(1, BPG.Domain.Constants.UserRole.TechnicalManager);
        SetupTasks(ValidTask());
        SetupDependencies();

        _handler = new AdjustTaskProgressCommandHandler(
            _uow.Object,
            ServiceStubFactory.ProgressRollupService(),
            ServiceStubFactory.NotificationService(),
            ServiceStubFactory.RealtimeSender(),
            _currentUser.Object);
    }

    [Fact]
    public async Task UTCID01_Handle_ValidAdjustment_ShouldReturnSuccess()
    {
        var result = await _handler.Handle(Command(50), CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Message.Should().Be("Điều chỉnh tiến độ task thành công.");
    }

    [Fact]
    public async Task UTCID02_Handle_TaskNotFound_ShouldThrowNotFoundException()
    {
        SetupTasks();

        Func<Task> act = () => _handler.Handle(Command(50), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<NotFoundException>();
        exception.Which.ErrorCode.Should().Be(ErrorCodes.NotFound);
    }

    [Fact]
    public async Task UTCID03_Handle_ProjectNotInProgress_ShouldThrowInvalidTransition()
    {
        SetupTasks(ValidTask(projectStatus: ProjectStatus.Completed));

        Func<Task> act = () => _handler.Handle(Command(50), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be(ErrorCodes.InvalidTransition);
    }

    [Fact]
    public async Task UTCID04_Handle_ObsoleteTask_ShouldThrowExpectedErrorCode()
    {
        SetupTasks(ValidTask(status: BPG.Domain.Constants.TaskStatus.Obsolete));

        Func<Task> act = () => _handler.Handle(Command(50), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_TASK_OBSOLETE");
    }

    [Fact]
    public async Task UTCID05_Handle_NonManager_ShouldThrowForbiddenException()
    {
        _currentUser.SetupUser(1);

        Func<Task> act = () => _handler.Handle(Command(50), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<ForbiddenException>();
        exception.Which.ErrorCode.Should().Be(ErrorCodes.Forbidden);
    }

    [Fact]
    public async Task UTCID06_Handle_IncompletePredecessor_ShouldThrowDependencyBlocked()
    {
        SetupDependencies(Dependency(progress: 80));

        Func<Task> act = () => _handler.Handle(Command(10), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_TASK_DEPENDENCY_BLOCKED");
    }

    [Fact]
    public async Task UTCID07_Handle_CompletedPredecessor_ShouldReturnSuccess()
    {
        SetupDependencies(Dependency(progress: 100, status: BPG.Domain.Constants.TaskStatus.Completed));

        var result = await _handler.Handle(Command(10), CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Message.Should().Be("Điều chỉnh tiến độ task thành công.");
    }

    [Fact]
    public async Task UTCID08_Handle_ObsoletePredecessor_ShouldReturnSuccess()
    {
        SetupDependencies(Dependency(progress: 80, status: BPG.Domain.Constants.TaskStatus.Obsolete));

        var result = await _handler.Handle(Command(10), CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Message.Should().Be("Điều chỉnh tiến độ task thành công.");
    }

    [Fact]
    public async Task UTCID09_Handle_IncompleteAncestorPredecessor_ShouldReturnSuccess()
    {
        var task = ValidTask(parentTaskId: 99);
        SetupTasks(task, new ProjectTask { TaskId = 99 });
        SetupDependencies(Dependency(progress: 80));

        var result = await _handler.Handle(Command(10), CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Message.Should().Be("Điều chỉnh tiến độ task thành công.");
    }

    [Fact]
    public async Task UTCID10_Handle_ZeroProgressWithIncompletePredecessor_ShouldReturnSuccess()
    {
        SetupDependencies(Dependency(progress: 80));

        var result = await _handler.Handle(Command(0), CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Message.Should().Be("Điều chỉnh tiến độ task thành công.");
    }

    private static AdjustTaskProgressCommand Command(byte progress) => new(TaskId, progress, "Technical correction");

    private static ProjectTask ValidTask(
        string status = BPG.Domain.Constants.TaskStatus.InProgress,
        string projectStatus = ProjectStatus.InProgress,
        long? parentTaskId = null) => new()
    {
        TaskId = TaskId,
        ParentTaskId = parentTaskId,
        Name = "Foundation",
        Status = status,
        ProgressPercent = 20,
        Phase = new Phase
        {
            PhaseId = 2,
            ProjectId = 3,
            Project = new Project { ProjectId = 3, Status = projectStatus }
        },
        Assignees = new List<TaskAssignee>(),
        ProgressLogs = new List<TaskProgressLog>()
    };

    private static TaskDependency Dependency(
        byte progress,
        string status = BPG.Domain.Constants.TaskStatus.InProgress) => new()
    {
        TaskId = TaskId,
        PredecessorTaskId = 99,
        Predecessor = new ProjectTask
        {
            TaskId = 99,
            Name = "Preparation",
            ProgressPercent = progress,
            Status = status
        }
    };

    private void SetupTasks(params ProjectTask[] tasks) =>
        _taskRepo.Setup(x => x.Query()).Returns(tasks.AsQueryable().BuildMock());

    private void SetupDependencies(params TaskDependency[] dependencies) =>
        _dependencyRepo.Setup(x => x.Query()).Returns(dependencies.AsQueryable().BuildMock());
}
