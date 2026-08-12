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

public class DeleteTaskCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IGenericRepository<ProjectTask>> _taskRepo = new();
    private readonly Mock<IGenericRepository<ProjectMember>> _memberRepo = new();
    private readonly Mock<ICurrentUserService> _currentUser = new();
    private readonly DeleteTaskCommandHandler _handler;

    public DeleteTaskCommandHandlerTests()
    {
        _uow.Setup(x => x.Repository<ProjectTask>()).Returns(_taskRepo.Object);
        _uow.Setup(x => x.Repository<ProjectMember>()).Returns(_memberRepo.Object);
        _uow.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        _currentUser.SetupUser(1, BPG.Domain.Constants.UserRole.TechnicalManager);
        SetupTasks(TaskEntity());
        _handler = new DeleteTaskCommandHandler(_uow.Object, ServiceStubFactory.RealtimeSender(), _currentUser.Object);
    }

    [Fact]
    public async Task UTCID01_Handle_ValidTask_ShouldReturnSuccess()
    {
        var result = await _handler.Handle(new DeleteTaskCommand(10), CancellationToken.None);
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task UTCID02_Handle_TaskNotFound_ShouldThrowNotFoundException()
    {
        SetupTasks();
        Func<Task> act = () => _handler.Handle(new DeleteTaskCommand(10), CancellationToken.None);
        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task UTCID03_Handle_TaskInProgress_ShouldThrowExpectedErrorCode()
    {
        SetupTasks(TaskEntity(progress: 1));
        Func<Task> act = () => _handler.Handle(new DeleteTaskCommand(10), CancellationToken.None);
        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_TASK_IN_PROGRESS");
    }

    [Fact]
    public async Task UTCID04_Handle_SubtaskInProgress_ShouldThrowExpectedErrorCode()
    {
        SetupTasks(TaskEntity(children: new[] { new ProjectTask { TaskId = 11, ProgressPercent = 1 } }));
        Func<Task> act = () => _handler.Handle(new DeleteTaskCommand(10), CancellationToken.None);
        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_SUBTASK_IN_PROGRESS");
    }

    private static ProjectTask TaskEntity(byte progress = 0, IEnumerable<ProjectTask>? children = null) => new()
    {
        TaskId = 10,
        ProgressPercent = progress,
        Phase = new Phase { PhaseId = 2, ProjectId = 3, Project = new Project { ProjectId = 3, Status = ProjectStatus.InProgress } },
        SubTasks = children?.ToList() ?? new List<ProjectTask>()
    };

    private void SetupTasks(params ProjectTask[] tasks) => _taskRepo.Setup(x => x.Query()).Returns(tasks.AsQueryable().BuildMock());
}
