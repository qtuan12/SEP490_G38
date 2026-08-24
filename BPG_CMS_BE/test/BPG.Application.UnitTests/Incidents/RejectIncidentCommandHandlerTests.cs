using AutoMapper;
using BPG.Application.DTOs.Incidents;
using BPG.Application.Features.Incidents.Commands.RejectIncident;
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

public class RejectIncidentCommandHandlerTests
{
    private const long CurrentUserId = 10;
    private const long IncidentId = 50;
    private const long ProjectId = 100;

    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<ICurrentUserService> _currentUser = new();
    private readonly Mock<IMapper> _mapper = new();
    private readonly Mock<IGenericRepository<Incident>> _incidentRepository = new();
    private readonly Mock<IGenericRepository<User>> _userRepository = new();
    private readonly Mock<IGenericRepository<InventoryAdjustment>> _adjustmentRepository = new();
    private readonly RejectIncidentCommandHandler _handler;

    public RejectIncidentCommandHandlerTests()
    {
        _uow.Setup(unit => unit.Repository<Incident>()).Returns(_incidentRepository.Object);
        _uow.Setup(unit => unit.Repository<User>()).Returns(_userRepository.Object);
        _uow.Setup(unit => unit.Repository<InventoryAdjustment>()).Returns(_adjustmentRepository.Object);
        _uow.Setup(unit => unit.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        _currentUser.Setup(service => service.UserId).Returns(CurrentUserId);
        _currentUser.Setup(service => service.GetRequiredUserId()).Returns(CurrentUserId);
        SetRoles(UserRoleConstants.TechnicalManager);

        _incidentRepository.SetupMockData([]);
        _userRepository.SetupMockData([]);
        _adjustmentRepository.SetupMockData([]);

        _mapper.Setup(mapper => mapper.Map<IncidentDto>(It.IsAny<Incident>()))
            .Returns((Incident incident) => new IncidentDto
            {
                IncidentId = incident.IncidentId,
                ProjectId = incident.ProjectId,
                IncidentType = incident.IncidentType,
                Status = incident.Status,
                ReviewedBy = incident.ReviewedBy,
                HandlingInstruction = incident.HandlingInstruction,
                IsEmergency = incident.IsEmergency
            });

        _handler = new RejectIncidentCommandHandler(
            _uow.Object,
            _mapper.Object,
            _currentUser.Object,
            ServiceStubFactory.NotificationService(),
            ServiceStubFactory.RealtimeSender());
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
        exception.Which.ErrorCode.Should().Be("ERR_INCIDENT_ALREADY_PROCESSED");
    }

    [Fact]
    public async Task UTCID03_Handle_ConstructionByUnauthorizedRole_ShouldThrowForbidden()
    {
        SetupIncident(ConstructionIncident());
        SetRoles(UserRoleConstants.Accountant);

        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_FORBIDDEN");
    }

    [Fact]
    public async Task UTCID04_Handle_EmergencyDirectorStepByTechnicalManager_ShouldThrowForbidden()
    {
        var incident = ConstructionIncident("WaitingDirectorApproval");
        incident.IsEmergency = true;
        SetupIncident(incident);
        SetRoles(UserRoleConstants.TechnicalManager);

        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_FORBIDDEN");
    }

    [Fact]
    public async Task UTCID05_Handle_InventoryUnderResolution_ShouldRequireAdjustmentApproval()
    {
        SetupIncident(InventoryIncident(IncidentStatus.UnderResolution));
        SetRoles(UserRoleConstants.Director);

        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_USE_ADJUSTMENT_APPROVAL");
    }

    [Fact]
    public async Task UTCID06_Handle_ValidConstructionRequest_ShouldReturnRejectedIncident()
    {
        SetupIncident(ConstructionIncident());

        var result = await _handler.Handle(Command(), CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Data.Should().BeEquivalentTo(new IncidentDto
        {
            IncidentId = IncidentId,
            ProjectId = ProjectId,
            IncidentType = "Construction",
            Status = "Rejected",
            ReviewedBy = CurrentUserId,
            HandlingInstruction = "Thông tin chưa chính xác",
            IsEmergency = false
        });
    }

    [Fact]
    public async Task UTCID07_Handle_InventoryAccountantStep_ShouldReturnRejectedIncident()
    {
        SetupIncident(InventoryIncident("WaitingAccountant"));
        SetRoles(UserRoleConstants.Accountant);

        var result = await _handler.Handle(Command(), CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Data!.Status.Should().Be("Rejected");
    }

    [Fact]
    public async Task UTCID08_Handle_ConcurrentReject_ShouldReturnStableBusinessError()
    {
        SetupIncident(ConstructionIncident());
        _uow.Setup(unit => unit.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ThrowsAsync(new DbUpdateConcurrencyException());

        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_INCIDENT_ALREADY_PROCESSED");
    }

    private void SetupIncident(Incident incident)
        => _incidentRepository.SetupMockData([incident]);

    private void SetRoles(params string[] roles)
    {
        _currentUser.Setup(service => service.IsInRole(It.IsAny<string>()))
            .Returns((string role) => roles.Contains(role));
        _currentUser.Setup(service => service.IsInAnyRole(It.IsAny<string[]>()))
            .Returns((string[] requestedRoles) => requestedRoles.Any(roles.Contains));
    }

    private static Incident ConstructionIncident(string status = "WaitingReview")
        => new()
        {
            IncidentId = IncidentId,
            ProjectId = ProjectId,
            IncidentType = "Construction",
            Description = "Nứt móng",
            Status = status,
            ReportedBy = 5
        };

    private static Incident InventoryIncident(string status)
        => new()
        {
            IncidentId = IncidentId,
            ProjectId = ProjectId,
            IncidentType = "InventoryLoss",
            Description = "Mất vật tư",
            Status = status,
            ReportedBy = 5
        };

    private static RejectIncidentCommand Command()
        => new(IncidentId, "Thông tin chưa chính xác");
}
