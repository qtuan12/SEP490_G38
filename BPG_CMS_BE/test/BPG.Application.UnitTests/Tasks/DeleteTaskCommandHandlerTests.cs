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
    private readonly Mock<IProgressRollupService> _rollupService = new();
    private readonly DeleteTaskCommandHandler _handler;

    public DeleteTaskCommandHandlerTests()
    {
        _uow.Setup(x => x.Repository<ProjectTask>()).Returns(_taskRepo.Object);
        _uow.Setup(x => x.Repository<ProjectMember>()).Returns(_memberRepo.Object);
        _uow.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        _currentUser.SetupUser(1, BPG.Domain.Constants.UserRole.TechnicalManager);
        SetupTasks(TaskEntity());
        _handler = new DeleteTaskCommandHandler(_uow.Object, ServiceStubFactory.RealtimeSender(), _currentUser.Object, _rollupService.Object);
    }

    [Fact]
    public async Task UTCID01_Handle_ValidTask_ShouldReturnSuccess()
    {
        var result = await _handler.Handle(Command(), CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Message.Should().Be("Xóa task thành công.");
    }

    [Fact]
    public async Task UTCID02_Handle_TaskNotFound_ShouldThrowNotFoundException()
    {
        SetupTasks();
        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<NotFoundException>();
        exception.Which.ErrorCode.Should().Be(ErrorCodes.NotFound);
    }

    [Fact]
    public async Task UTCID03_Handle_ProjectInInvalidStatus_ShouldThrowInvalidTransition()
    {
        SetupTasks(TaskEntity(projectStatus: ProjectStatus.Completed));

        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be(ErrorCodes.InvalidTransition);
    }

    [Fact]
    public async Task UTCID04_Handle_ProjectLeader_ShouldReturnSuccess()
    {
        _currentUser.SetupUser(1);
        SetupMembers(new ProjectMember { ProjectId = 3, UserId = 1, IsLeader = true });

        var result = await _handler.Handle(Command(), CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Message.Should().Be("Xóa task thành công.");
    }

    [Fact]
    public async Task UTCID05_Handle_UserWithoutPermission_ShouldThrowForbiddenException()
    {
        _currentUser.SetupUser(1);
        SetupMembers();

        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<ForbiddenException>();
        exception.Which.ErrorCode.Should().Be(ErrorCodes.Forbidden);
    }

    [Fact]
    public async Task UTCID06_Handle_TaskProgressAtOne_ShouldThrowExpectedErrorCode()
    {
        SetupTasks(TaskEntity(progress: 1));
        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_TASK_IN_PROGRESS");
    }

    [Fact]
    public async Task UTCID07_Handle_SubtaskProgressAtOne_ShouldThrowExpectedErrorCode()
    {
        SetupTasks(TaskEntity(children: new[] { new ProjectTask { TaskId = 11, ProgressPercent = 1 } }));
        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_SUBTASK_IN_PROGRESS");
    }

    [Fact]
    public async Task UTCID08_Handle_SubtaskProgressAtZero_ShouldReturnSuccess()
    {
        SetupTasks(TaskEntity(children: new[] { new ProjectTask { TaskId = 11, ProgressPercent = 0 } }));

        var result = await _handler.Handle(Command(), CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Message.Should().Be("Xóa task thành công.");
    }

    private static DeleteTaskCommand Command() => new(10);

    private static ProjectTask TaskEntity(
        byte progress = 0,
        IEnumerable<ProjectTask>? children = null,
        string projectStatus = ProjectStatus.InProgress) => new()
    {
        TaskId = 10,
        ProgressPercent = progress,
        Phase = new Phase { PhaseId = 2, ProjectId = 3, Project = new Project { ProjectId = 3, Status = projectStatus } },
        SubTasks = children?.ToList() ?? new List<ProjectTask>()
    };

    private void SetupTasks(params ProjectTask[] tasks) => _taskRepo.Setup(x => x.Query()).Returns(tasks.AsQueryable().BuildMock());

    private void SetupMembers(params ProjectMember[] members) =>
        _memberRepo.Setup(x => x.Query()).Returns(members.AsQueryable().BuildMock());
}
