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
    }

    [Fact]
    public async Task UTCID02_Handle_TaskNotFound_ShouldThrowNotFoundException()
    {
        SetupTasks();

        Func<Task> act = () => _handler.Handle(Command(50), CancellationToken.None);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task UTCID03_Handle_ObsoleteTask_ShouldThrowExpectedErrorCode()
    {
        SetupTasks(ValidTask(status: BPG.Domain.Constants.TaskStatus.Obsolete));

        Func<Task> act = () => _handler.Handle(Command(50), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_TASK_OBSOLETE");
    }

    [Fact]
    public async Task UTCID04_Handle_NonManager_ShouldThrowForbiddenException()
    {
        _currentUser.SetupUser(1);

        Func<Task> act = () => _handler.Handle(Command(50), CancellationToken.None);

        await act.Should().ThrowAsync<ForbiddenException>();
    }

    [Fact]
    public async Task UTCID05_Handle_IncompletePredecessor_ShouldThrowDependencyBlocked()
    {
        SetupDependencies(new TaskDependency
        {
            TaskId = TaskId,
            PredecessorTaskId = 99,
            Predecessor = new ProjectTask
            {
                TaskId = 99,
                Name = "Preparation",
                ProgressPercent = 80,
                Status = BPG.Domain.Constants.TaskStatus.InProgress
            }
        });

        Func<Task> act = () => _handler.Handle(Command(10), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_TASK_DEPENDENCY_BLOCKED");
    }

    [Fact]
    public async Task UTCID06_Handle_ZeroProgressWithIncompletePredecessor_ShouldReturnSuccess()
    {
        SetupDependencies(new TaskDependency
        {
            TaskId = TaskId,
            PredecessorTaskId = 99,
            Predecessor = new ProjectTask { TaskId = 99, ProgressPercent = 20 }
        });

        var result = await _handler.Handle(Command(0), CancellationToken.None);

        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task UTCID07_Handle_AdjustCompletedTaskToZeroWithoutAssignee_ShouldSetStatusToNew()
    {
        var task = ValidTask(BPG.Domain.Constants.TaskStatus.Completed);
        task.ProgressPercent = 100;
        SetupTasks(task);

        await _handler.Handle(Command(0), CancellationToken.None);

        task.Status.Should().Be(BPG.Domain.Constants.TaskStatus.New);
    }

    [Fact]
    public async Task UTCID08_Handle_AdjustCompletedTaskToZeroWithAssignee_ShouldSetStatusToAssigned()
    {
        var task = ValidTask(BPG.Domain.Constants.TaskStatus.Completed);
        task.ProgressPercent = 100;
        task.Assignees.Add(new TaskAssignee { TaskId = TaskId, UserId = 2 });
        SetupTasks(task);

        await _handler.Handle(Command(0), CancellationToken.None);

        task.Status.Should().Be(BPG.Domain.Constants.TaskStatus.Assigned);
    }

    private static AdjustTaskProgressCommand Command(byte progress) => new(TaskId, progress, "Technical correction");

    private static ProjectTask ValidTask(string status = BPG.Domain.Constants.TaskStatus.InProgress) => new()
    {
        TaskId = TaskId,
        Name = "Foundation",
        Status = status,
        ProgressPercent = 20,
        Phase = new Phase
        {
            PhaseId = 2,
            ProjectId = 3,
            Project = new Project { ProjectId = 3, Status = ProjectStatus.InProgress }
        },
        Assignees = new List<TaskAssignee>(),
        ProgressLogs = new List<TaskProgressLog>()
    };

    private void SetupTasks(params ProjectTask[] tasks) =>
        _taskRepo.Setup(x => x.Query()).Returns(tasks.AsQueryable().BuildMock());

    private void SetupDependencies(params TaskDependency[] dependencies) =>
        _dependencyRepo.Setup(x => x.Query()).Returns(dependencies.AsQueryable().BuildMock());
}
