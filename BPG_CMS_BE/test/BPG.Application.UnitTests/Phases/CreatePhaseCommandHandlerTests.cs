using BPG.Application.Features.Phases.Commands.CreatePhase;
using BPG.Application.IRepositories;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using MockQueryable;
using Moq;

namespace BPG.Application.UnitTests.Phases;

public class CreatePhaseCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IGenericRepository<Project>> _projectRepo = new();
    private readonly Mock<IGenericRepository<Phase>> _phaseRepo = new();
    private readonly CreatePhaseCommandHandler _handler;

    public CreatePhaseCommandHandlerTests()
    {
        _uow.Setup(x => x.Repository<Project>()).Returns(_projectRepo.Object);
        _uow.Setup(x => x.Repository<Phase>()).Returns(_phaseRepo.Object);
        _uow.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        _phaseRepo.Setup(x => x.AddAsync(It.IsAny<Phase>(), It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        SetupProjects(Project());
        _handler = new CreatePhaseCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task UTCID01_Handle_ValidRequest_ShouldReturnSuccess()
    {
        var result = await _handler.Handle(Command(), CancellationToken.None);
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task UTCID02_Handle_ProjectNotFound_ShouldThrowNotFoundException()
    {
        SetupProjects();
        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);
        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task UTCID03_Handle_ProjectInactive_ShouldThrowInvalidTransition()
    {
        SetupProjects(Project(ProjectStatus.Completed));
        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);
        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be(ErrorCodes.InvalidTransition);
    }

    [Theory]
    [InlineData("2025-12-31", "2026-06-30")]
    [InlineData("2026-01-01", "2027-01-01")]
    public async Task UTCID04_Handle_PhaseOutsideProjectDates_ShouldThrowDateInvalid(string start, string end)
    {
        Func<Task> act = () => _handler.Handle(Command(DateOnly.Parse(start), DateOnly.Parse(end)), CancellationToken.None);
        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_PHASE_DATE_INVALID");
    }

    private static CreatePhaseCommand Command(DateOnly? start = null, DateOnly? end = null) =>
        new(1, "Foundation", null, 1, start ?? new DateOnly(2026, 1, 1), end ?? new DateOnly(2026, 6, 30));

    private static Project Project(string status = ProjectStatus.InProgress) => new()
    {
        ProjectId = 1,
        Status = status,
        PlannedStart = new DateOnly(2026, 1, 1),
        PlannedEnd = new DateOnly(2026, 12, 31)
    };

    private void SetupProjects(params Project[] projects) =>
        _projectRepo.Setup(x => x.Query()).Returns(projects.AsQueryable().BuildMock());
}
