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

public class CreateTaskCommandHandlerTests
{
    private const long ProjectId = 10;
    private const long PhaseId = 20;
    private const long UserId = 30;
    private const long GeneratedTaskId = 40;

    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IGenericRepository<Phase>> _phaseRepo = new();
    private readonly Mock<IGenericRepository<ProjectTask>> _taskRepo = new();
    private readonly Mock<IGenericRepository<ProjectMember>> _memberRepo = new();
    private readonly Mock<IGenericRepository<TaskAssignee>> _assigneeRepo = new();
    private readonly Mock<ICurrentUserService> _currentUser = new();
    private readonly Mock<IMapper> _mapper = new();
    private readonly CreateTaskCommandHandler _handler;

    public CreateTaskCommandHandlerTests()
    {
        _uow.Setup(x => x.Repository<Phase>()).Returns(_phaseRepo.Object);
        _uow.Setup(x => x.Repository<ProjectTask>()).Returns(_taskRepo.Object);
        _uow.Setup(x => x.Repository<ProjectMember>()).Returns(_memberRepo.Object);
        _uow.Setup(x => x.Repository<TaskAssignee>()).Returns(_assigneeRepo.Object);
        _uow.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        _currentUser.SetupUser(UserId, BPG.Domain.Constants.UserRole.TechnicalManager);
        SetupPhases(ValidPhase());
        SetupTasks();
        SetupMembers();

        _mapper.Setup(x => x.Map<ProjectTask>(It.IsAny<CreateTaskCommand>()))
            .Returns((CreateTaskCommand command) => new ProjectTask
            {
                TaskId = GeneratedTaskId,
                PhaseId = command.PhaseId,
                ParentTaskId = command.ParentTaskId,
                Name = command.Name,
                Description = command.Description,
                OrderIndex = command.OrderIndex,
                StartDate = command.StartDate,
                EndDate = command.EndDate,
                Weight = command.Weight,
                Assignees = new List<TaskAssignee>(),
                ProgressLogs = new List<TaskProgressLog>()
            });

        _taskRepo.Setup(x => x.AddAsync(It.IsAny<ProjectTask>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        _handler = new CreateTaskCommandHandler(
            _uow.Object,
            ServiceStubFactory.NotificationService(),
            ServiceStubFactory.RealtimeSender(),
            _mapper.Object,
            ServiceStubFactory.ProgressRollupService(),
            _currentUser.Object);
    }

    [Fact]
    public async Task UTCID01_Handle_ValidTaskWithAssignee_ShouldReturnCreatedTaskId()
    {
        var result = await _handler.Handle(Command(assigneeIds: new List<long> { 88 }), CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Data.Should().Be(GeneratedTaskId);
    }

    [Fact]
    public async Task UTCID02_Handle_PhaseNotFound_ShouldThrowNotFoundException()
    {
        SetupPhases();

        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task UTCID03_Handle_ProjectInactive_ShouldThrowInvalidTransition()
    {
        SetupPhases(ValidPhase(ProjectStatus.Completed));

        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be(ErrorCodes.InvalidTransition);
    }

    [Theory]
    [InlineData("2026-07-31", "2026-08-10")]
    [InlineData("2026-08-01", "2026-09-01")]
    public async Task UTCID04_Handle_TaskOutsidePhaseDates_ShouldThrowDateInvalid(string start, string end)
    {
        Func<Task> act = () => _handler.Handle(
            Command(DateOnly.Parse(start), DateOnly.Parse(end)), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_TASK_DATE_INVALID");
    }

    [Fact]
    public async Task UTCID05_Handle_UserWithoutManagerOrLeaderPermission_ShouldThrowForbiddenException()
    {
        _currentUser.SetupUser(UserId);
        SetupMembers(new ProjectMember { ProjectId = ProjectId, UserId = UserId, IsLeader = false });

        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

        await act.Should().ThrowAsync<ForbiddenException>();
    }

    [Fact]
    public async Task UTCID06_Handle_ParentIsAlreadySubtask_ShouldThrowMaxDepthExceeded()
    {
        SetupTasks(new ProjectTask
        {
            TaskId = 50,
            PhaseId = PhaseId,
            ParentTaskId = 49,
            StartDate = new DateOnly(2026, 8, 1),
            EndDate = new DateOnly(2026, 8, 31),
            Assignees = new List<TaskAssignee>()
        });

        Func<Task> act = () => _handler.Handle(Command(parentTaskId: 50), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_MAX_DEPTH_EXCEEDED");
    }

    private static CreateTaskCommand Command(
        DateOnly? start = null,
        DateOnly? end = null,
        long? parentTaskId = null,
        List<long>? assigneeIds = null) => new(
            PhaseId,
            parentTaskId,
            "Foundation",
            "Build foundation",
            1,
            start ?? new DateOnly(2026, 8, 1),
            end ?? new DateOnly(2026, 8, 31),
            assigneeIds,
            1);

    private static Phase ValidPhase(string status = ProjectStatus.InProgress) => new()
    {
        PhaseId = PhaseId,
        ProjectId = ProjectId,
        StartDate = new DateOnly(2026, 8, 1),
        EndDate = new DateOnly(2026, 8, 31),
        Project = new Project { ProjectId = ProjectId, Status = status }
    };

    private void SetupPhases(params Phase[] phases) =>
        _phaseRepo.Setup(x => x.Query()).Returns(phases.AsQueryable().BuildMock());

    private void SetupTasks(params ProjectTask[] tasks) =>
        _taskRepo.Setup(x => x.Query()).Returns(tasks.AsQueryable().BuildMock());

    private void SetupMembers(params ProjectMember[] members)
    {
        _memberRepo.Setup(x => x.Query()).Returns(members.AsQueryable().BuildMock());
    }
}
