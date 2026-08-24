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

public class CreatePhaseCommandHandlerTests
{
    private const long ProjectId = 1;
    private const long GeneratedPhaseId = 10;

    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IGenericRepository<Project>> _projectRepo = new();
    private readonly Mock<IGenericRepository<Phase>> _phaseRepo = new();
    private readonly CreatePhaseCommandHandler _handler;

    public CreatePhaseCommandHandlerTests()
    {
        _uow.Setup(x => x.Repository<Project>()).Returns(_projectRepo.Object);
        _uow.Setup(x => x.Repository<Phase>()).Returns(_phaseRepo.Object);
        _uow.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        _phaseRepo.Setup(x => x.AddAsync(It.IsAny<Phase>(), It.IsAny<CancellationToken>()))
            .Callback<Phase, CancellationToken>((phase, _) => phase.PhaseId = GeneratedPhaseId)
            .Returns(Task.CompletedTask);
        SetupProjects(Project());
        _handler = new CreatePhaseCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task UTCID01_Handle_ValidRequest_ShouldReturnCreatedPhaseId()
    {
        var result = await _handler.Handle(Command(), CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Data.Should().Be(GeneratedPhaseId);
    }

    [Fact]
    public async Task UTCID02_Handle_ProjectNotFound_ShouldThrowNotFoundException()
    {
        SetupProjects();

        Func<Task> act = () => _handler.Handle(Command(projectId: 999), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<NotFoundException>();
        exception.Which.ErrorCode.Should().Be(ErrorCodes.NotFound);
    }

    [Fact]
    public async Task UTCID03_Handle_ProjectInInvalidStatus_ShouldThrowInvalidTransition()
    {
        SetupProjects(Project(ProjectStatus.Completed));

        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be(ErrorCodes.InvalidTransition);
    }

    [Fact]
    public async Task UTCID03B_Handle_ProjectPausedWithApprovedEmergency_ShouldAllowCreation()
    {
        SetupProjects(PausedProjectForEmergency(100));
        var incidentRepo = new Mock<IGenericRepository<Incident>>();
        var incidents = new List<Incident>
        {
            new() { IncidentId = 100, ProjectId = ProjectId, IsEmergency = true, Status = IncidentStatus.Approved }
        };
        incidentRepo.Setup(x => x.Query()).Returns(incidents.AsQueryable().BuildMock());
        _uow.Setup(x => x.Repository<Incident>()).Returns(incidentRepo.Object);

        var result = await _handler.Handle(Command(), CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Data.Should().Be(GeneratedPhaseId);
    }

    [Fact]
    public async Task UTCID03C_Handle_ProjectPausedWithoutApprovedEmergency_ShouldThrowInvalidTransition()
    {
        SetupProjects(PausedProjectForEmergency(101));
        var incidentRepo = new Mock<IGenericRepository<Incident>>();
        var incidents = new List<Incident>
        {
            new() { IncidentId = 101, ProjectId = ProjectId, IsEmergency = true, Status = IncidentStatus.Reported }
        };
        incidentRepo.Setup(x => x.Query()).Returns(incidents.AsQueryable().BuildMock());
        _uow.Setup(x => x.Repository<Incident>()).Returns(incidentRepo.Object);

        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be(ErrorCodes.InvalidTransition);
    }

    [Fact]
    public async Task UTCID04_Handle_StartDateBeforeProject_ShouldThrowDateInvalid()
    {
        Func<Task> act = () => _handler.Handle(
            Command(start: new DateOnly(2025, 12, 31), end: new DateOnly(2026, 6, 30)),
            CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_PHASE_DATE_INVALID");
    }

    [Fact]
    public async Task UTCID05_Handle_EndDateAfterProject_ShouldThrowDateInvalid()
    {
        Func<Task> act = () => _handler.Handle(
            Command(start: new DateOnly(2026, 1, 1), end: new DateOnly(2027, 1, 1)),
            CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_PHASE_DATE_INVALID");
    }

    private static CreatePhaseCommand Command(
        long projectId = ProjectId,
        DateOnly? start = null,
        DateOnly? end = null) =>
        new(
            projectId,
            "Foundation",
            "Foundation works",
            1,
            start ?? new DateOnly(2026, 1, 1),
            end ?? new DateOnly(2026, 12, 31));

    private static Project Project(string status = ProjectStatus.InProgress) => new()
    {
        ProjectId = ProjectId,
        Status = status,
        PlannedStart = new DateOnly(2026, 1, 1),
        PlannedEnd = new DateOnly(2026, 12, 31)
    };

    private static Project PausedProjectForEmergency(long incidentId)
    {
        var project = Project(ProjectStatus.Paused);
        project.PauseReason = $"[{{\"type\":\"pause\",\"emergencyIncidentId\":{incidentId}}}]";
        return project;
    }

    private void SetupProjects(params Project[] projects) =>
        _projectRepo.Setup(x => x.Query()).Returns(projects.AsQueryable().BuildMock());
}
