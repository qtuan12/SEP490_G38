using BPG.Application.Features.Phases.Commands.DeletePhase;
using BPG.Application.IRepositories;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using MockQueryable;
using Moq;

namespace BPG.Application.UnitTests.Phases;

public class DeletePhaseCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IGenericRepository<Phase>> _phaseRepo = new();
    private readonly Mock<IGenericRepository<ProjectTask>> _taskRepo = new();
    private readonly DeletePhaseCommandHandler _handler;

    public DeletePhaseCommandHandlerTests()
    {
        _uow.Setup(x => x.Repository<Phase>()).Returns(_phaseRepo.Object);
        _uow.Setup(x => x.Repository<ProjectTask>()).Returns(_taskRepo.Object);
        _uow.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        SetupPhases(Phase());
        _handler = new DeletePhaseCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task UTCID01_Handle_ValidPhase_ShouldReturnSuccess()
    {
        var result = await _handler.Handle(new DeletePhaseCommand(1), CancellationToken.None);
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task UTCID02_Handle_ApprovedPhase_ShouldThrowExpectedErrorCode()
    {
        SetupPhases(Phase(status: PhaseStatus.Approved));
        Func<Task> act = () => _handler.Handle(new DeletePhaseCommand(1), CancellationToken.None);
        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_PHASE_APPROVED");
    }

    [Fact]
    public async Task UTCID03_Handle_PhaseHasTaskInProgress_ShouldThrowExpectedErrorCode()
    {
        SetupPhases(Phase(new ProjectTask { TaskId = 10, ProgressPercent = 10 }));
        Func<Task> act = () => _handler.Handle(new DeletePhaseCommand(1), CancellationToken.None);
        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_PHASE_HAS_IN_PROGRESS_TASKS");
    }

    private static Phase Phase(ProjectTask? task = null, string status = PhaseStatus.Draft) => new()
    {
        PhaseId = 1,
        Status = status,
        Project = new Project { ProjectId = 2, Status = ProjectStatus.InProgress },
        Tasks = task == null ? new List<ProjectTask>() : new List<ProjectTask> { task }
    };

    private void SetupPhases(params Phase[] phases) =>
        _phaseRepo.Setup(x => x.Query()).Returns(phases.AsQueryable().BuildMock());
}
