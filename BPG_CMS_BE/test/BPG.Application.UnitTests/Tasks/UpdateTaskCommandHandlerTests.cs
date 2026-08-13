using AutoMapper;
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

public class UpdateTaskCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IGenericRepository<ProjectTask>> _taskRepo = new();
    private readonly Mock<IGenericRepository<ProjectMember>> _memberRepo = new();
    private readonly Mock<ICurrentUserService> _currentUser = new();
    private readonly UpdateTaskCommandHandler _handler;

    public UpdateTaskCommandHandlerTests()
    {
        _uow.Setup(x => x.Repository<ProjectTask>()).Returns(_taskRepo.Object);
        _uow.Setup(x => x.Repository<ProjectMember>()).Returns(_memberRepo.Object);
        _uow.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        _currentUser.SetupUser(1, BPG.Domain.Constants.UserRole.TechnicalManager);
        SetupTasks(TaskEntity());
        SetupMembers();
        var mapper = new Mock<IMapper>();
        mapper.Setup(x => x.Map(It.IsAny<UpdateTaskCommand>(), It.IsAny<ProjectTask>()))
            .Returns((UpdateTaskCommand _, ProjectTask task) => task);
        _handler = new UpdateTaskCommandHandler(_uow.Object, ServiceStubFactory.RealtimeSender(), mapper.Object, ServiceStubFactory.ProgressRollupService(), _currentUser.Object);
    }

    [Fact]
    public async Task UTCID01_Handle_PhaseBoundaryDatesByTechnicalManager_ShouldReturnSuccess()
    {
        var result = await _handler.Handle(Command(), CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Message.Should().Be("Cập nhật công việc thành công.");
    }

    [Fact]
    public async Task UTCID02_Handle_ValidRequestByProjectLeader_ShouldReturnSuccess()
    {
        _currentUser.SetupUser(1);
        SetupMembers(new ProjectMember { ProjectId = 3, UserId = 1, IsLeader = true });

        var result = await _handler.Handle(Command(), CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Message.Should().Be("Cập nhật công việc thành công.");
    }

    [Fact]
    public async Task UTCID03_Handle_TaskNotFound_ShouldThrowNotFoundException()
    {
        SetupTasks();

        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<NotFoundException>();
        exception.Which.ErrorCode.Should().Be(ErrorCodes.NotFound);
    }

    [Fact]
    public async Task UTCID04_Handle_ProjectInInvalidStatus_ShouldThrowInvalidTransition()
    {
        SetupTasks(TaskEntity(projectStatus: ProjectStatus.Completed));

        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be(ErrorCodes.InvalidTransition);
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
    public async Task UTCID06_Handle_StartDateBeforePhase_ShouldThrowDateInvalid()
    {
        Func<Task> act = () => _handler.Handle(
            Command(start: new DateOnly(2026, 7, 31)),
            CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_TASK_DATE_INVALID");
    }

    [Fact]
    public async Task UTCID07_Handle_EndDateAfterPhase_ShouldThrowDateInvalid()
    {
        Func<Task> act = () => _handler.Handle(
            Command(end: new DateOnly(2026, 9, 1)),
            CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_TASK_DATE_INVALID");
    }

    [Fact]
    public async Task UTCID08_Handle_ChildDatesOutsideParent_ShouldThrowDateInvalid()
    {
        SetupTasks(
            TaskEntity(parentTaskId: 99),
            ParentTask());

        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_TASK_DATE_INVALID");
    }

    [Fact]
    public async Task UTCID09_Handle_StartedTaskChangedWithoutReason_ShouldThrowExpectedErrorCode()
    {
        SetupTasks(TaskEntity(progress: 10));

        Func<Task> act = () => _handler.Handle(Command(name: "Changed", reason: null), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_TASK_UPDATE_REASON_REQUIRED");
    }

    [Fact]
    public async Task UTCID10_Handle_StartedTaskChangedWithReason_ShouldReturnSuccess()
    {
        SetupTasks(TaskEntity(progress: 10));

        var result = await _handler.Handle(
            Command(name: "Changed", reason: "Scope clarified"),
            CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Message.Should().Be("Cập nhật công việc thành công.");
    }

    private static UpdateTaskCommand Command(
        string name = "Foundation",
        string? reason = null,
        DateOnly? start = null,
        DateOnly? end = null) =>
        new(
            10,
            name,
            null,
            1,
            start ?? new DateOnly(2026, 8, 1),
            end ?? new DateOnly(2026, 8, 31),
            reason,
            1);

    private static ProjectTask TaskEntity(
        byte progress = 0,
        string projectStatus = ProjectStatus.InProgress,
        long? parentTaskId = null) => new()
    {
        TaskId = 10,
        ParentTaskId = parentTaskId,
        Name = "Foundation",
        StartDate = new DateOnly(2026, 8, 1),
        EndDate = new DateOnly(2026, 8, 31),
        Weight = 1,
        ProgressPercent = progress,
        ProgressLogs = new List<TaskProgressLog>(),
        Phase = new Phase
        {
            PhaseId = 2,
            ProjectId = 3,
            StartDate = new DateOnly(2026, 8, 1),
            EndDate = new DateOnly(2026, 8, 31),
            Project = new Project { ProjectId = 3, Status = projectStatus }
        }
    };

    private static ProjectTask ParentTask() => new()
    {
        TaskId = 99,
        Name = "Parent task",
        StartDate = new DateOnly(2026, 8, 5),
        EndDate = new DateOnly(2026, 8, 25)
    };

    private void SetupTasks(params ProjectTask[] tasks) => _taskRepo.Setup(x => x.Query()).Returns(tasks.AsQueryable().BuildMock());

    private void SetupMembers(params ProjectMember[] members) =>
        _memberRepo.Setup(x => x.Query()).Returns(members.AsQueryable().BuildMock());
}
