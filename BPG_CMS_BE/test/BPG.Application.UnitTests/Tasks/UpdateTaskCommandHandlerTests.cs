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
        var mapper = new Mock<IMapper>();
        mapper.Setup(x => x.Map(It.IsAny<UpdateTaskCommand>(), It.IsAny<ProjectTask>()))
            .Returns((UpdateTaskCommand _, ProjectTask task) => task);
        _handler = new UpdateTaskCommandHandler(_uow.Object, ServiceStubFactory.RealtimeSender(), mapper.Object, ServiceStubFactory.ProgressRollupService(), _currentUser.Object);
    }

    [Fact]
    public async Task UTCID01_Handle_ValidRequest_ShouldReturnSuccess()
    {
        var result = await _handler.Handle(Command(), CancellationToken.None);
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task UTCID02_Handle_TaskNotFound_ShouldThrowNotFoundException()
    {
        SetupTasks();
        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);
        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task UTCID03_Handle_StartedTaskChangedWithoutReason_ShouldThrowExpectedErrorCode()
    {
        SetupTasks(TaskEntity(progress: 10));
        Func<Task> act = () => _handler.Handle(Command(name: "Changed", reason: null), CancellationToken.None);
        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_TASK_UPDATE_REASON_REQUIRED");
    }

    [Fact]
    public async Task UTCID04_Handle_DateOutsidePhase_ShouldThrowDateInvalid()
    {
        Func<Task> act = () => _handler.Handle(Command(start: new DateOnly(2026, 7, 31)), CancellationToken.None);
        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_TASK_DATE_INVALID");
    }

    private static UpdateTaskCommand Command(string name = "Foundation", string? reason = null, DateOnly? start = null) =>
        new(10, name, null, 1, start ?? new DateOnly(2026, 8, 1), new DateOnly(2026, 8, 31), reason, 1);

    private static ProjectTask TaskEntity(byte progress = 0) => new()
    {
        TaskId = 10,
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
            Project = new Project { ProjectId = 3, Status = ProjectStatus.InProgress }
        }
    };

    private void SetupTasks(params ProjectTask[] tasks) => _taskRepo.Setup(x => x.Query()).Returns(tasks.AsQueryable().BuildMock());
}
