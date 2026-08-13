using AutoMapper;
using BPG.Application.Features.Incidents.Commands.RejectIncident;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Application.UnitTests.Helpers;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using Moq;

namespace BPG.Application.UnitTests.Incidents
{
    public class RejectIncidentCommandHandlerTests
    {
        private const long CurrentUserId = 10;
        private const long IncidentId = 50;

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly Mock<IMapper> _mockMapper;
        private readonly Mock<IGenericRepository<Incident>> _mockIncidentRepo;
        private readonly Mock<IGenericRepository<User>> _mockUserRepo;
        private readonly Mock<IGenericRepository<InventoryAdjustment>> _mockAdjustmentRepo;
        private readonly RejectIncidentCommandHandler _handler;

        public RejectIncidentCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();
            _mockMapper = new Mock<IMapper>();
            _mockIncidentRepo = new Mock<IGenericRepository<Incident>>();
            _mockUserRepo = new Mock<IGenericRepository<User>>();
            _mockAdjustmentRepo = new Mock<IGenericRepository<InventoryAdjustment>>();

            _mockUow.Setup(u => u.Repository<Incident>()).Returns(_mockIncidentRepo.Object);
            _mockUow.Setup(u => u.Repository<User>()).Returns(_mockUserRepo.Object);
            _mockUow.Setup(u => u.Repository<InventoryAdjustment>()).Returns(_mockAdjustmentRepo.Object);

            _mockCurrentUserService.Setup(c => c.UserId).Returns(CurrentUserId);
            _mockCurrentUserService.Setup(c => c.GetRequiredUserId()).Returns(CurrentUserId);

            _mockIncidentRepo.SetupMockData(new List<Incident>());
            _mockAdjustmentRepo.SetupMockData(new List<InventoryAdjustment>());

            _handler = new RejectIncidentCommandHandler(
                _mockUow.Object,
                _mockMapper.Object,
                _mockCurrentUserService.Object,
                ServiceStubFactory.NotificationService(),
                ServiceStubFactory.RealtimeSender());
        }

        [Fact]
        public async Task Handle_IncidentNotFound_ShouldThrowNotFoundException()
        {
            _mockIncidentRepo.SetupMockData(new List<Incident>());

            var command = new RejectIncidentCommand(IncidentId, "Lý do từ chối");
            var act = async () => await _handler.Handle(command, CancellationToken.None);

            await act.Should().ThrowAsync<NotFoundException>();
        }

        [Fact]
        public async Task Handle_IncidentAlreadyProcessed_ShouldThrowBusinessException()
        {
            var incident = new Incident
            {
                IncidentId = IncidentId,
                Status = "Approved"
            };
            _mockIncidentRepo.SetupMockData(new List<Incident> { incident });

            var command = new RejectIncidentCommand(IncidentId, "Lý do từ chối");
            var act = async () => await _handler.Handle(command, CancellationToken.None);

            var ex = await act.Should().ThrowAsync<BusinessException>();
            ex.Which.ErrorCode.Should().Be("ERR_INCIDENT_ALREADY_PROCESSED");
        }

        [Fact]
        public async Task Handle_ValidRequest_ShouldRejectIncident()
        {
            var incident = new Incident
            {
                IncidentId = IncidentId,
                ProjectId = 100,
                Status = "WaitingReview",
                ReportedBy = 5
            };
            _mockIncidentRepo.SetupMockData(new List<Incident> { incident });

            var command = new RejectIncidentCommand(IncidentId, "Thông tin chưa chính xác");
            var result = await _handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeTrue();
            incident.Status.Should().Be("Rejected");
            incident.HandlingInstruction.Should().Be("Thông tin chưa chính xác");
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }
    }
}
