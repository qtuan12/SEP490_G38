using AutoMapper;
using BPG.Application.DTOs.Incidents;
using BPG.Application.Features.Incidents.Commands.ConfirmIncident;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Application.UnitTests.Helpers;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;
using UserRoleConstants = BPG.Domain.Constants.UserRole;

namespace BPG.Application.UnitTests.Incidents;

public class ConfirmIncidentCommandHandlerTests
{
    private const long CurrentUserId = 10;
    private const long IncidentId = 50;
    private const long ProjectId = 100;
    private const long PhaseId = 200;
    private const long TaskId = 300;

    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<ICurrentUserService> _currentUser = new();
    private readonly Mock<IMapper> _mapper = new();
    private readonly Mock<IGenericRepository<Incident>> _incidentRepository = new();
    private readonly Mock<IGenericRepository<Phase>> _phaseRepository = new();
    private readonly Mock<IGenericRepository<ProjectMember>> _memberRepository = new();
    private readonly Mock<IGenericRepository<ProjectTask>> _taskRepository = new();
    private readonly Mock<IGenericRepository<TaskProgressLog>> _progressLogRepository = new();
    private readonly Mock<IGenericRepository<DailyLog>> _dailyLogRepository = new();
    private readonly Mock<IProgressRollupService> _rollupService = new();
    private readonly ConfirmIncidentCommandHandler _handler;

    public ConfirmIncidentCommandHandlerTests()
    {
        _uow.Setup(unit => unit.Repository<Incident>()).Returns(_incidentRepository.Object);
        _uow.Setup(unit => unit.Repository<Phase>()).Returns(_phaseRepository.Object);
        _uow.Setup(unit => unit.Repository<ProjectMember>()).Returns(_memberRepository.Object);
        _uow.Setup(unit => unit.Repository<ProjectTask>()).Returns(_taskRepository.Object);
        _uow.Setup(unit => unit.Repository<TaskProgressLog>()).Returns(_progressLogRepository.Object);
        _uow.Setup(unit => unit.Repository<DailyLog>()).Returns(_dailyLogRepository.Object);
        _uow.Setup(unit => unit.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        _currentUser.Setup(service => service.UserId).Returns(CurrentUserId);
        _currentUser.Setup(service => service.GetRequiredUserId()).Returns(CurrentUserId);
        SetRoles();

        _incidentRepository.SetupMockData([]);
        _phaseRepository.SetupMockData([]);
        _memberRepository.SetupMockData([]);
        _taskRepository.SetupMockData([]);
        _progressLogRepository.SetupMockData([]);
        _dailyLogRepository.SetupMockData([]);
        _progressLogRepository
            .Setup(repository => repository.AddAsync(It.IsAny<TaskProgressLog>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        _dailyLogRepository
            .Setup(repository => repository.AddAsync(It.IsAny<DailyLog>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        _mapper.Setup(mapper => mapper.Map<IncidentDto>(It.IsAny<Incident>()))
            .Returns((Incident incident) => new IncidentDto
            {
                IncidentId = incident.IncidentId,
                ProjectId = incident.ProjectId,
                TaskId = incident.TaskId,
                PhaseId = incident.PhaseId,
                IncidentType = incident.IncidentType,
                Status = incident.Status,
                ReviewedBy = incident.ReviewedBy,
                IsEmergency = incident.IsEmergency
            });

        _handler = new ConfirmIncidentCommandHandler(
            _uow.Object,
            _mapper.Object,
            _currentUser.Object,
            ServiceStubFactory.NotificationService(),
            ServiceStubFactory.RealtimeSender(),
            _rollupService.Object);
    }

    [Fact]
    public async Task UTCID01_Handle_IncidentNotFound_ShouldThrowNotFoundException()
    {
        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Theory]
    [InlineData("Approved")]
    [InlineData("Rejected")]
    public async Task UTCID02_Handle_TerminalIncident_ShouldThrowExpectedErrorCode(string status)
    {
        SetupIncident(ConstructionIncident(status));

        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_INCIDENT_ALREADY_CONFIRMED");
    }

    [Fact]
    public async Task UTCID03_Handle_ConstructionByUnauthorizedRole_ShouldThrowForbiddenBeforeActionValidation()
    {
        SetupIncident(ConstructionIncident());
        SetRoles(UserRoleConstants.Accountant);

        Func<Task> act = () => _handler.Handle(
            Command(createReworkTask: true),
            CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_FORBIDDEN");
    }

    [Fact]
    public async Task UTCID04_Handle_EmergencyDirectorApprovalWithoutDecision_ShouldThrowExpectedErrorCode()
    {
        SetupIncident(EmergencyIncident("WaitingDirectorApproval"));
        SetRoles(UserRoleConstants.Director);

        Func<Task> act = () => _handler.Handle(Command(decision: null), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_INVALID_DECISION");
    }

    [Fact]
    public async Task UTCID05_Handle_EmergencyDirectorApprovalByTechnicalManager_ShouldThrowForbidden()
    {
        SetupIncident(EmergencyIncident("WaitingDirectorApproval"));
        SetRoles(UserRoleConstants.TechnicalManager);

        Func<Task> act = () => _handler.Handle(Command(decision: "Approve"), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_FORBIDDEN");
    }

    [Fact]
    public async Task UTCID06_Handle_IncidentTaskOutsideProject_ShouldThrowExpectedErrorCode()
    {
        SetupIncident(ConstructionIncident());
        SetRoles(UserRoleConstants.TechnicalManager);
        _phaseRepository.SetupMockData([new Phase { PhaseId = PhaseId, ProjectId = ProjectId + 1 }]);

        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_INCIDENT_TASK_PROJECT_MISMATCH");
    }

    [Fact]
    public async Task UTCID07_Handle_ReworkAssigneeOutsideProject_ShouldThrowExpectedErrorCode()
    {
        SetupIncident(ConstructionIncident());
        SetRoles(UserRoleConstants.TechnicalManager);
        SetupTaskProject();

        Func<Task> act = () => _handler.Handle(
            Command(
                createReworkTask: true,
                reworkTaskName: "Làm lại móng",
                reworkStartDate: DateTime.UtcNow.Date,
                reworkEndDate: DateTime.UtcNow.Date.AddDays(2),
                reworkAssigneeId: 999),
            CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_TASK_ASSIGNEE_NOT_PROJECT_MEMBER");
    }

    [Fact]
    public async Task UTCID08_Handle_ValidProgressDecrease_ShouldReturnApprovedIncident()
    {
        SetupIncident(ConstructionIncident());
        SetRoles(UserRoleConstants.TechnicalManager);
        SetupTaskProject();

        var result = await _handler.Handle(
            Command(decreaseProgressTo: 80, decreaseProgressReason: "Khắc phục lại"),
            CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Data.Should().BeEquivalentTo(new IncidentDto
        {
            IncidentId = IncidentId,
            ProjectId = ProjectId,
            TaskId = TaskId,
            PhaseId = PhaseId,
            IncidentType = "Construction",
            Status = "Approved",
            ReviewedBy = CurrentUserId,
            IsEmergency = false
        });
        _progressLogRepository.Verify(repository => repository.AddAsync(
            It.Is<TaskProgressLog>(log => log.OldProgress == 100
                && log.NewProgress == 80
                && log.UpdateReason!.Contains("Phạt giảm tiến độ")),
            It.IsAny<CancellationToken>()), Times.Once);
        _dailyLogRepository.Verify(repository => repository.AddAsync(
            It.IsAny<DailyLog>(),
            It.IsAny<CancellationToken>()), Times.Never);
        _rollupService.Verify(service => service.RecalculateParentTaskProgressAsync(
            It.IsAny<long>(),
            It.IsAny<long?>(),
            It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task UTCID08A_Handle_ProgressDecreaseWithParent_ShouldRecalculateAncestors()
    {
        var incident = ConstructionIncident();
        incident.Task!.ParentTaskId = 301;
        SetupIncident(incident);
        SetRoles(UserRoleConstants.TechnicalManager);
        SetupTaskProject();

        await _handler.Handle(Command(decreaseProgressTo: 80), CancellationToken.None);

        _rollupService.Verify(service => service.RecalculateParentTaskProgressAsync(
            301,
            TaskId,
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task UTCID09_Handle_InventoryWaitingAccountant_ShouldRequireAdjustmentCreation()
    {
        var incident = ConstructionIncident("WaitingAccountant");
        incident.IncidentType = "InventoryLoss";
        incident.TaskId = null;
        incident.Task = null;
        SetupIncident(incident);
        SetRoles(UserRoleConstants.Accountant);

        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_USE_ADJUSTMENT_CREATION");
    }

    [Fact]
    public async Task UTCID10_Handle_InventoryUnderResolution_ShouldRequireAdjustmentApproval()
    {
        var incident = ConstructionIncident(IncidentStatus.UnderResolution);
        incident.IncidentType = "InventoryLoss";
        incident.TaskId = null;
        incident.Task = null;
        SetupIncident(incident);
        SetRoles(UserRoleConstants.Director);

        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_USE_ADJUSTMENT_APPROVAL");
    }

    [Fact]
    public async Task UTCID11_Handle_EmergencyStopWhenProjectWasPausedElsewhere_ShouldRejectWithoutTakingPauseOwnership()
    {
        var incident = EmergencyIncident("WaitingStopApproval");
        incident.Project.Status = ProjectStatus.Paused;
        incident.Project.PauseReason = "Tạm dừng thủ công";
        SetupIncident(incident);
        SetRoles(UserRoleConstants.TechnicalManager);
        SetupTaskProject();

        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_PROJECT_STATE_CHANGED");
        incident.Project.PauseReason.Should().Be("Tạm dừng thủ công");
    }

    [Fact]
    public async Task UTCID12_Handle_ConcurrentIncidentDecision_ShouldReturnStableBusinessError()
    {
        SetupIncident(ConstructionIncident());
        SetRoles(UserRoleConstants.TechnicalManager);
        SetupTaskProject();
        _uow.Setup(unit => unit.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ThrowsAsync(new DbUpdateConcurrencyException());

        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_INCIDENT_ALREADY_PROCESSED");
    }

    private void SetupIncident(Incident incident)
        => _incidentRepository.SetupMockData([incident]);

    private void SetupTaskProject()
        => _phaseRepository.SetupMockData([new Phase { PhaseId = PhaseId, ProjectId = ProjectId }]);

    private void SetRoles(params string[] roles)
    {
        _currentUser.Setup(service => service.IsInRole(It.IsAny<string>()))
            .Returns((string role) => roles.Contains(role));
        _currentUser.Setup(service => service.IsInAnyRole(It.IsAny<string[]>()))
            .Returns((string[] requestedRoles) => requestedRoles.Any(roles.Contains));
    }

    private static Incident ConstructionIncident(string status = "WaitingReview")
    {
        var project = new Project { ProjectId = ProjectId, Name = "Dự án A", Status = ProjectStatus.InProgress };
        var task = new ProjectTask
        {
            TaskId = TaskId,
            PhaseId = PhaseId,
            Name = "Thi công móng",
            Status = BPG.Domain.Constants.TaskStatus.Completed,
            ProgressPercent = 100
        };

        return new Incident
        {
            IncidentId = IncidentId,
            ProjectId = ProjectId,
            Project = project,
            TaskId = TaskId,
            Task = task,
            PhaseId = PhaseId,
            IncidentType = "Construction",
            Description = "Nứt móng",
            Status = status,
            ReportedBy = 5
        };
    }

    private static Incident EmergencyIncident(string status)
    {
        var incident = ConstructionIncident(status);
        incident.IsEmergency = true;
        return incident;
    }

    private static ConfirmIncidentCommand Command(
        bool createReworkTask = false,
        string? reworkTaskName = null,
        DateTime? reworkStartDate = null,
        DateTime? reworkEndDate = null,
        long? reworkAssigneeId = null,
        int? decreaseProgressTo = null,
        string? decreaseProgressReason = null,
        string? decision = null)
        => new(
            IncidentId,
            createReworkTask,
            reworkTaskName,
            reworkStartDate,
            reworkEndDate,
            reworkAssigneeId,
            decreaseProgressTo,
            decreaseProgressReason,
            "Xử lý sự cố",
            null,
            null,
            decision);
}
