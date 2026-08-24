using AutoMapper;
using BPG.Application.DTOs.Incidents;
using BPG.Application.Features.Incidents.Commands.CreateAndAssessIncident;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Application.UnitTests.Helpers;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace BPG.Application.UnitTests.Incidents;

public class CreateAndAssessIncidentCommandHandlerTests
{
    private const long CurrentUserId = 10;
    private const long ProjectId = 100;
    private const long PhaseId = 200;
    private const long TaskId = 300;

    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<ICurrentUserService> _currentUser = new();
    private readonly Mock<IMapper> _mapper = new();
    private readonly Mock<IGenericRepository<Project>> _projectRepository = new();
    private readonly Mock<IGenericRepository<ProjectMember>> _memberRepository = new();
    private readonly Mock<IGenericRepository<ProjectTask>> _taskRepository = new();
    private readonly Mock<IGenericRepository<Phase>> _phaseRepository = new();
    private readonly Mock<IGenericRepository<Incident>> _incidentRepository = new();
    private readonly List<Incident> _incidents = [];
    private readonly CreateAndAssessIncidentCommandHandler _handler;

    public CreateAndAssessIncidentCommandHandlerTests()
    {
        _uow.Setup(unit => unit.Repository<Project>()).Returns(_projectRepository.Object);
        _uow.Setup(unit => unit.Repository<ProjectMember>()).Returns(_memberRepository.Object);
        _uow.Setup(unit => unit.Repository<ProjectTask>()).Returns(_taskRepository.Object);
        _uow.Setup(unit => unit.Repository<Phase>()).Returns(_phaseRepository.Object);
        _uow.Setup(unit => unit.Repository<Incident>()).Returns(_incidentRepository.Object);
        _uow.Setup(unit => unit.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        _currentUser.Setup(service => service.UserId).Returns(CurrentUserId);
        _currentUser.Setup(service => service.GetRequiredUserId()).Returns(CurrentUserId);
        _currentUser.Setup(service => service.IsInRole(It.IsAny<string>())).Returns(false);

        _projectRepository.SetupMockData([]);
        _memberRepository.SetupMockData([]);
        _taskRepository.SetupMockData([]);
        _phaseRepository.SetupMockData([]);
        _incidentRepository.SetupMockData(_incidents);
        _incidentRepository
            .Setup(repository => repository.AddAsync(It.IsAny<Incident>(), It.IsAny<CancellationToken>()))
            .Callback<Incident, CancellationToken>((incident, _) =>
            {
                incident.IncidentId = 50;
                _incidents.Add(incident);
            })
            .Returns(Task.CompletedTask);

        _mapper.Setup(mapper => mapper.Map<IncidentDto>(It.IsAny<Incident>()))
            .Returns((Incident incident) => new IncidentDto
            {
                IncidentId = incident.IncidentId,
                ProjectId = incident.ProjectId,
                TaskId = incident.TaskId,
                PhaseId = incident.PhaseId,
                IncidentType = incident.IncidentType,
                Description = incident.Description,
                Status = incident.Status,
                IsEmergency = incident.IsEmergency
            });

        _handler = new CreateAndAssessIncidentCommandHandler(
            _uow.Object,
            _mapper.Object,
            _currentUser.Object,
            ServiceStubFactory.NotificationService(),
            ServiceStubFactory.RealtimeSender());
    }

    [Fact]
    public async Task UTCID01_Handle_ProjectNotFound_ShouldThrowNotFoundException()
    {
        Func<Task> act = () => _handler.Handle(ConstructionCommand(), CancellationToken.None);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Theory]
    [InlineData(ProjectStatus.Draft)]
    [InlineData(ProjectStatus.Paused)]
    [InlineData(ProjectStatus.Completed)]
    [InlineData(ProjectStatus.Closed)]
    public async Task UTCID02_Handle_ProjectNotInProgress_ShouldThrowExpectedErrorCode(string status)
    {
        SetupProject(status);

        Func<Task> act = () => _handler.Handle(ConstructionCommand(), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_PROJECT_NOT_ACTIVE");
    }

    [Fact]
    public async Task UTCID03_Handle_UserOutsideProject_ShouldThrowForbiddenException()
    {
        SetupProject(ProjectStatus.InProgress, includeCurrentUser: false);

        Func<Task> act = () => _handler.Handle(ConstructionCommand(), CancellationToken.None);

        await act.Should().ThrowAsync<ForbiddenException>();
    }

    [Fact]
    public async Task UTCID04_Handle_TaskOutsideSelectedPhase_ShouldThrowExpectedErrorCode()
    {
        SetupProject();
        _taskRepository.SetupMockData([new ProjectTask { TaskId = TaskId, PhaseId = PhaseId }]);

        Func<Task> act = () => _handler.Handle(
            ConstructionCommand(phaseId: PhaseId + 1),
            CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_TASK_PHASE_MISMATCH");
    }

    [Fact]
    public async Task UTCID05_Handle_TaskOutsideProject_ShouldThrowExpectedErrorCode()
    {
        SetupProject();
        _taskRepository.SetupMockData([new ProjectTask { TaskId = TaskId, PhaseId = PhaseId }]);
        _phaseRepository.SetupMockData([new Phase { PhaseId = PhaseId, ProjectId = ProjectId + 1 }]);

        Func<Task> act = () => _handler.Handle(ConstructionCommand(), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_TASK_PROJECT_MISMATCH");
    }

    [Fact]
    public async Task UTCID06_Handle_InventoryPhaseOutsideProject_ShouldThrowExpectedErrorCode()
    {
        SetupProject();
        _phaseRepository.SetupMockData([new Phase { PhaseId = PhaseId, ProjectId = ProjectId + 1 }]);

        var command = new CreateAndAssessIncidentCommand(
            ProjectId, null, PhaseId, "InventoryLoss", "Mất vật tư", "Thiếu 10 bao xi măng",
            null, null, null, null, false);
        Func<Task> act = () => _handler.Handle(command, CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_PHASE_PROJECT_MISMATCH");
    }

    [Fact]
    public async Task UTCID07_Handle_ProjectHasActiveEmergency_ShouldThrowExpectedErrorCode()
    {
        SetupProject();
        _incidents.Add(new Incident
        {
            IncidentId = 49,
            ProjectId = ProjectId,
            IncidentType = "Construction",
            IsEmergency = true,
            Status = "WaitingRecoveryPlan"
        });
        _incidentRepository.SetupMockData(_incidents);

        Func<Task> act = () => _handler.Handle(
            ConstructionCommand(taskId: null, phaseId: null, isEmergency: true),
            CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_ACTIVE_EMERGENCY_EXISTS");
    }

    [Fact]
    public async Task UTCID08_Handle_ValidConstructionIncident_ShouldReturnCreatedIncident()
    {
        SetupProject();
        _taskRepository.SetupMockData([new ProjectTask { TaskId = TaskId, PhaseId = PhaseId }]);
        _phaseRepository.SetupMockData([new Phase { PhaseId = PhaseId, ProjectId = ProjectId }]);

        var result = await _handler.Handle(ConstructionCommand(), CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Data.Should().BeEquivalentTo(new IncidentDto
        {
            IncidentId = 50,
            ProjectId = ProjectId,
            TaskId = TaskId,
            PhaseId = PhaseId,
            IncidentType = "Construction",
            Description = "Máy hỏng động cơ",
            Status = "WaitingReview",
            IsEmergency = false
        });
    }

    [Fact]
    public async Task UTCID09_Handle_ConcurrentEmergencyCreation_ShouldReturnStableBusinessError()
    {
        SetupProject();
        _uow.Setup(unit => unit.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ThrowsAsync(new DbUpdateConcurrencyException());

        Func<Task> act = () => _handler.Handle(
            ConstructionCommand(taskId: null, phaseId: null, isEmergency: true),
            CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_ACTIVE_EMERGENCY_EXISTS");
        _projectRepository.Verify(repository => repository.Update(
            It.Is<Project>(project => project.ProjectId == ProjectId)), Times.Once);
    }

    [Theory]
    [InlineData(IncidentStatus.Reported)]
    [InlineData(IncidentStatus.WaitingAccountant)]
    [InlineData(IncidentStatus.UnderResolution)]
    [InlineData("WaitingDirector")]
    public async Task Handle_PhaseHasActiveInventoryIncident_ShouldRejectNewIncident(string activeStatus)
    {
        SetupProject();
        _phaseRepository.SetupMockData([new Phase { PhaseId = PhaseId, ProjectId = ProjectId }]);
        _incidents.Add(new Incident
        {
            IncidentId = 49,
            ProjectId = ProjectId,
            PhaseId = PhaseId,
            IncidentType = "InventoryDamage",
            Status = activeStatus
        });
        _incidentRepository.SetupMockData(_incidents);

        Func<Task> act = () => _handler.Handle(InventoryCommand(), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_ACTIVE_INVENTORY_INCIDENT_EXISTS");
        _incidentRepository.Verify(repository => repository.AddAsync(
            It.IsAny<Incident>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Theory]
    [InlineData(IncidentStatus.Resolved)]
    [InlineData(IncidentStatus.Closed)]
    [InlineData(IncidentStatus.Rejected)]
    [InlineData(IncidentStatus.Approved)]
    public async Task Handle_PhasePreviousInventoryIncidentIsTerminal_ShouldAllowNewIncident(string terminalStatus)
    {
        SetupProject();
        _phaseRepository.SetupMockData([new Phase { PhaseId = PhaseId, ProjectId = ProjectId }]);
        _incidents.Add(new Incident
        {
            IncidentId = 49,
            ProjectId = ProjectId,
            PhaseId = PhaseId,
            IncidentType = "InventoryLoss",
            Status = terminalStatus
        });
        _incidentRepository.SetupMockData(_incidents);

        var result = await _handler.Handle(InventoryCommand(), CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Data!.Status.Should().Be(IncidentStatus.WaitingAccountant);
    }

    [Fact]
    public async Task Handle_OtherPhaseHasActiveInventoryIncident_ShouldAllowNewIncident()
    {
        SetupProject();
        _phaseRepository.SetupMockData([new Phase { PhaseId = PhaseId, ProjectId = ProjectId }]);
        _incidents.Add(new Incident
        {
            IncidentId = 49,
            ProjectId = ProjectId,
            PhaseId = PhaseId + 1,
            IncidentType = "InventoryLoss",
            Status = IncidentStatus.UnderResolution
        });
        _incidentRepository.SetupMockData(_incidents);

        var result = await _handler.Handle(InventoryCommand(), CancellationToken.None);

        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task Handle_ConcurrentInventoryIncidentCreation_ShouldReturnStableBusinessError()
    {
        SetupProject();
        _phaseRepository.SetupMockData([new Phase { PhaseId = PhaseId, ProjectId = ProjectId }]);
        _uow.Setup(unit => unit.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ThrowsAsync(new DbUpdateException(
                "Trigger rejected duplicate active incident.",
                new FakeSqlException(51000, "ERR_ACTIVE_INVENTORY_INCIDENT_EXISTS")));

        Func<Task> act = () => _handler.Handle(InventoryCommand(), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_ACTIVE_INVENTORY_INCIDENT_EXISTS");
    }

    [Theory]
    [InlineData(IncidentStatus.Reported)]
    [InlineData(IncidentStatus.UnderReview)]
    [InlineData(IncidentStatus.UnderResolution)]
    public async Task Handle_PhaseHasActiveConstructionIncident_ShouldRejectNewIncident(string activeStatus)
    {
        SetupProject();
        _taskRepository.SetupMockData([new ProjectTask { TaskId = TaskId, PhaseId = PhaseId }]);
        _phaseRepository.SetupMockData([new Phase { PhaseId = PhaseId, ProjectId = ProjectId }]);
        _incidents.Add(new Incident
        {
            IncidentId = 49,
            ProjectId = ProjectId,
            PhaseId = PhaseId,
            IncidentType = "Construction",
            Status = activeStatus
        });
        _incidentRepository.SetupMockData(_incidents);

        Func<Task> act = () => _handler.Handle(ConstructionCommand(), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_ACTIVE_CONSTRUCTION_INCIDENT_EXISTS");
        _incidentRepository.Verify(repository => repository.AddAsync(
            It.IsAny<Incident>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Theory]
    [InlineData(IncidentStatus.Resolved)]
    [InlineData(IncidentStatus.Closed)]
    [InlineData(IncidentStatus.Rejected)]
    [InlineData(IncidentStatus.Approved)]
    public async Task Handle_PhasePreviousConstructionIncidentIsTerminal_ShouldAllowNewIncident(string terminalStatus)
    {
        SetupProject();
        _taskRepository.SetupMockData([new ProjectTask { TaskId = TaskId, PhaseId = PhaseId }]);
        _phaseRepository.SetupMockData([new Phase { PhaseId = PhaseId, ProjectId = ProjectId }]);
        _incidents.Add(new Incident
        {
            IncidentId = 49,
            ProjectId = ProjectId,
            PhaseId = PhaseId,
            IncidentType = "Construction",
            Status = terminalStatus
        });
        _incidentRepository.SetupMockData(_incidents);

        var result = await _handler.Handle(ConstructionCommand(), CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Data!.Status.Should().Be(IncidentStatus.UnderReview);
    }

    [Fact]
    public async Task Handle_OtherPhaseHasActiveConstructionIncident_ShouldAllowNewIncident()
    {
        SetupProject();
        _taskRepository.SetupMockData([new ProjectTask { TaskId = TaskId, PhaseId = PhaseId }]);
        _phaseRepository.SetupMockData([new Phase { PhaseId = PhaseId, ProjectId = ProjectId }]);
        _incidents.Add(new Incident
        {
            IncidentId = 49,
            ProjectId = ProjectId,
            PhaseId = PhaseId + 1,
            IncidentType = "Construction",
            Status = IncidentStatus.UnderReview
        });
        _incidentRepository.SetupMockData(_incidents);

        var result = await _handler.Handle(ConstructionCommand(), CancellationToken.None);

        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task Handle_ConcurrentConstructionIncidentCreation_ShouldReturnStableBusinessError()
    {
        SetupProject();
        _taskRepository.SetupMockData([new ProjectTask { TaskId = TaskId, PhaseId = PhaseId }]);
        _phaseRepository.SetupMockData([new Phase { PhaseId = PhaseId, ProjectId = ProjectId }]);
        _uow.Setup(unit => unit.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ThrowsAsync(new DbUpdateException(
                "Trigger rejected duplicate active incident.",
                new FakeSqlException(51000, "ERR_ACTIVE_CONSTRUCTION_INCIDENT_EXISTS")));

        Func<Task> act = () => _handler.Handle(ConstructionCommand(), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_ACTIVE_CONSTRUCTION_INCIDENT_EXISTS");
    }

    private void SetupProject(
        string status = ProjectStatus.InProgress,
        bool includeCurrentUser = true,
        bool isLeader = true)
    {
        _projectRepository.SetupMockData([new Project
        {
            ProjectId = ProjectId,
            Name = "Dự án B",
            Status = status
        }]);
        _memberRepository.SetupMockData(includeCurrentUser
            ? [new ProjectMember { ProjectMemberId = 1, ProjectId = ProjectId, UserId = CurrentUserId, IsLeader = isLeader }]
            : []);
    }

    private static CreateAndAssessIncidentCommand ConstructionCommand(
        long? taskId = TaskId,
        long? phaseId = PhaseId,
        bool isEmergency = false)
        => new(
            ProjectId,
            taskId,
            phaseId,
            "Construction",
            "Máy hỏng động cơ",
            null,
            null,
            null,
            null,
            null,
            isEmergency);

    private static CreateAndAssessIncidentCommand InventoryCommand()
        => new(
            ProjectId,
            null,
            PhaseId,
            "InventoryLoss",
            "Mất vật tư",
            "Thiếu 10 bao xi măng",
            null,
            null,
            null,
            null,
            false);

    private sealed class FakeSqlException : Exception
    {
        public FakeSqlException(int number, string message) : base(message)
        {
            Number = number;
        }

        public int Number { get; }
    }
}
