using BPG.Application.Features.Phases.Commands;
using BPG.Application.Features.Phases.Handlers;
using BPG.Application.IRepositories;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using MockQueryable;
using Moq;

namespace BPG.Application.UnitTests.Phases;

public class UpdatePhaseCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IGenericRepository<Phase>> _phaseRepo = new();
    private readonly UpdatePhaseCommandHandler _handler;

    public UpdatePhaseCommandHandlerTests()
    {
        _uow.Setup(x => x.Repository<Phase>()).Returns(_phaseRepo.Object);
        _uow.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        SetupPhases(Phase());
        _handler = new UpdatePhaseCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task UTCID01_Handle_ValidRequest_ShouldReturnSuccess()
    {
        var result = await _handler.Handle(Command(), CancellationToken.None);
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task UTCID02_Handle_PhaseNotFound_ShouldThrowNotFoundException()
    {
        SetupPhases();
        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);
        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task UTCID03_Handle_PhaseHasTaskInProgress_ShouldThrowExpectedErrorCode()
    {
        SetupPhases(Phase(new ProjectTask { TaskId = 10, ProgressPercent = 1 }));
        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);
        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_PHASE_HAS_IN_PROGRESS_TASKS");
    }

    private static UpdatePhaseCommand Command() => new(1, "Updated", null, 1, null, null, 0);

    private static Phase Phase(params ProjectTask[] tasks) => new()
    {
        PhaseId = 1,
        ProjectId = 2,
        Project = new Project { ProjectId = 2, Status = ProjectStatus.InProgress },
        Tasks = tasks.ToList()
    };

    private void SetupPhases(params Phase[] phases) =>
        _phaseRepo.Setup(x => x.Query()).Returns(phases.AsQueryable().BuildMock());
}
