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

public class RestoreTaskCommandHandlerTests
{
    private const long TaskId = 10;
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IGenericRepository<ProjectTask>> _taskRepo = new();
    private readonly Mock<IGenericRepository<ProjectMember>> _memberRepo = new();
    private readonly Mock<IGenericRepository<TaskDependency>> _dependencyRepo = new();
    private readonly Mock<IGenericRepository<User>> _userRepo = new();
    private readonly Mock<ICurrentUserService> _currentUser = new();
    private readonly RestoreTaskCommandHandler _handler;

    public RestoreTaskCommandHandlerTests()
    {
        _uow.Setup(x => x.Repository<ProjectTask>()).Returns(_taskRepo.Object);
        _uow.Setup(x => x.Repository<ProjectMember>()).Returns(_memberRepo.Object);
        _uow.Setup(x => x.Repository<TaskDependency>()).Returns(_dependencyRepo.Object);
        _uow.Setup(x => x.Repository<User>()).Returns(_userRepo.Object);
        _uow.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        _currentUser.SetupUser(1, BPG.Domain.Constants.UserRole.TechnicalManager);
        SetupTasks(TaskEntity());
        SetupMembers();
        SetupDependencies();
        _userRepo.Setup(x => x.GetByIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new User { UserId = 1, FullName = "Manager" });

        _handler = new RestoreTaskCommandHandler(
            _uow.Object,
            ServiceStubFactory.ProgressRollupService(),
            ServiceStubFactory.NotificationService(),
            ServiceStubFactory.RealtimeSender(),
            _currentUser.Object);
    }

    [Fact]
    public async Task UTCID01_Handle_ObsoleteTask_ShouldReturnSuccess()
    {
        var result = await _handler.Handle(new RestoreTaskCommand(TaskId), CancellationToken.None);
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task UTCID02_Handle_TaskNotFound_ShouldThrowNotFoundException()
    {
        SetupTasks();
        Func<Task> act = () => _handler.Handle(new RestoreTaskCommand(TaskId), CancellationToken.None);
        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task UTCID03_Handle_TaskNotObsolete_ShouldReturnIdempotentSuccess()
    {
        SetupTasks(TaskEntity(BPG.Domain.Constants.TaskStatus.InProgress));
        var result = await _handler.Handle(new RestoreTaskCommand(TaskId), CancellationToken.None);
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task UTCID04_Handle_TaskStoppedByIncident_ShouldThrowCannotRestore()
    {
        SetupTasks(TaskEntity(reason: "Sự cố thi công nghiêm trọng"));
        Func<Task> act = () => _handler.Handle(new RestoreTaskCommand(TaskId), CancellationToken.None);
        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_TASK_CANNOT_BE_RESTORED");
    }

    [Fact]
    public async Task UTCID05_Handle_ObsoletePredecessor_ShouldThrowExpectedErrorCode()
    {
        SetupDependencies(new TaskDependency
        {
            TaskId = TaskId,
            PredecessorTaskId = 99,
            Predecessor = new ProjectTask { TaskId = 99, Status = BPG.Domain.Constants.TaskStatus.Obsolete }
        });
        Func<Task> act = () => _handler.Handle(new RestoreTaskCommand(TaskId), CancellationToken.None);
        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_DEPENDENCY_OBSOLETE");
    }

    private static ProjectTask TaskEntity(string status = BPG.Domain.Constants.TaskStatus.Obsolete, string reason = "Paused by manager") => new()
    {
        TaskId = TaskId,
        Name = "Foundation",
        Status = status,
        ObsoleteReason = reason,
        ProgressPercent = 20,
        Phase = new Phase { PhaseId = 2, ProjectId = 3, Project = new Project { ProjectId = 3, Status = ProjectStatus.InProgress } },
        Assignees = new List<TaskAssignee>(),
        ProgressLogs = new List<TaskProgressLog>()
    };

    private void SetupTasks(params ProjectTask[] tasks) => _taskRepo.Setup(x => x.Query()).Returns(tasks.AsQueryable().BuildMock());
    private void SetupMembers(params ProjectMember[] members) => _memberRepo.Setup(x => x.Query()).Returns(members.AsQueryable().BuildMock());
    private void SetupDependencies(params TaskDependency[] dependencies) => _dependencyRepo.Setup(x => x.Query()).Returns(dependencies.AsQueryable().BuildMock());
}
