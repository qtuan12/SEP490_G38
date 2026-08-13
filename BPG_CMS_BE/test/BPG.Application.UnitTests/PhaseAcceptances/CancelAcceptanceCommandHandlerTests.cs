using BPG.Application.Features.PhaseAcceptances.Commands.CancelAcceptance;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Application.UnitTests.Helpers;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using MockQueryable;
using MockQueryable.Moq;
using Moq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using RoleConstants = BPG.Domain.Constants.UserRole;
using Xunit;

namespace BPG.Application.UnitTests.PhaseAcceptances
{
    public class CancelAcceptanceCommandHandlerTests
    {
        private const long CurrentUserId = 1;
        private const long AcceptanceId = 50;
        private const long PhaseId = 10;
        private const long ProjectId = 100;

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly Mock<INotificationService> _mockNotificationService;

        private readonly Mock<IGenericRepository<PhaseAcceptance>> _mockAcceptanceRepo;
        private readonly Mock<IGenericRepository<Phase>> _mockPhaseRepo;
        private readonly Mock<IGenericRepository<ProjectMember>> _mockProjectMemberRepo;

        private readonly CancelAcceptanceCommandHandler _handler;

        public CancelAcceptanceCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();
            _mockNotificationService = new Mock<INotificationService>();

            _mockAcceptanceRepo = new Mock<IGenericRepository<PhaseAcceptance>>();
            _mockPhaseRepo = new Mock<IGenericRepository<Phase>>();
            _mockProjectMemberRepo = new Mock<IGenericRepository<ProjectMember>>();

            _mockUow.Setup(u => u.Repository<PhaseAcceptance>()).Returns(_mockAcceptanceRepo.Object);
            _mockUow.Setup(u => u.Repository<Phase>()).Returns(_mockPhaseRepo.Object);
            _mockUow.Setup(u => u.Repository<ProjectMember>()).Returns(_mockProjectMemberRepo.Object);

            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.TechnicalManager);

            _handler = new CancelAcceptanceCommandHandler(
                _mockUow.Object,
                _mockCurrentUserService.Object,
                _mockNotificationService.Object
            );
        }

        [Fact]
        public async Task UTCID01_Handle_ValidRequest_ShouldCancelAcceptanceSuccessfully()
        {
            // Arrange
            var phase = new Phase { PhaseId = PhaseId, Status = PhaseStatus.Approved, Project = new Project { Status = ProjectStatus.InProgress } };
            var acceptance = new PhaseAcceptance
            {
                AcceptanceId = AcceptanceId,
                PhaseId = PhaseId,
                AcceptanceDate = DateTime.Now.AddDays(-2), // 2 days ago (<= 7 days)
                IsCancelled = false,
                Phase = phase
            };

            _mockAcceptanceRepo.Setup(r => r.Query()).Returns(new List<PhaseAcceptance> { acceptance }.AsQueryable().BuildMock());

            var command = new CancelAcceptanceCommand(AcceptanceId, "Phát hiện lỗi kỹ thuật sau nghiệm thu");

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().BeTrue();
            acceptance.IsCancelled.Should().BeTrue();
            acceptance.CancelledBy.Should().Be(CurrentUserId);
            phase.Status.Should().Be(PhaseStatus.InProgress);

            _mockAcceptanceRepo.Verify(r => r.Update(acceptance), Times.Once);
            _mockPhaseRepo.Verify(r => r.Update(phase), Times.Once);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID02_Handle_Director_ShouldThrowForbiddenException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.Director);

            Func<Task> act = () => _handler.Handle(
                new CancelAcceptanceCommand(AcceptanceId, "Hủy biên bản nghiệm thu"),
                CancellationToken.None);

            var exception = await act.Should().ThrowAsync<ForbiddenException>();
            exception.Which.ErrorCode.Should().Be(ErrorCodes.Forbidden);
        }

        [Fact]
        public async Task UTCID03_Handle_AcceptanceNotFound_ShouldThrowNotFoundException()
        {
            // Arrange
            _mockAcceptanceRepo.Setup(r => r.Query()).Returns(new List<PhaseAcceptance>().AsQueryable().BuildMock());
            var command = new CancelAcceptanceCommand(999, "Lý do hủy");

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<NotFoundException>();
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task UTCID04_Handle_AcceptanceAlreadyCancelled_ShouldThrowBusinessException()
        {
            // Arrange
            var acceptance = new PhaseAcceptance
            {
                AcceptanceId = AcceptanceId,
                IsCancelled = true,
                Phase = new Phase { Project = new Project { Status = ProjectStatus.InProgress } }
            };
            _mockAcceptanceRepo.Setup(r => r.Query()).Returns(new List<PhaseAcceptance> { acceptance }.AsQueryable().BuildMock());
            var command = new CancelAcceptanceCommand(AcceptanceId, "Lý do hủy");

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Biên bản nghiệm thu này đã bị hủy trước đó.");
        }

        [Fact]
        public async Task UTCID05_Handle_AcceptanceOverSevenDaysLimit_ShouldThrowBusinessException()
        {
            // Arrange
            var acceptance = new PhaseAcceptance
            {
                AcceptanceId = AcceptanceId,
                AcceptanceDate = DateTime.Now.AddDays(-8), // 8 days ago (> 7 days)
                IsCancelled = false,
                Phase = new Phase { Project = new Project { Status = ProjectStatus.InProgress } }
            };
            _mockAcceptanceRepo.Setup(r => r.Query()).Returns(new List<PhaseAcceptance> { acceptance }.AsQueryable().BuildMock());
            var command = new CancelAcceptanceCommand(AcceptanceId, "Hủy quá hạn");

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Chỉ được phép hủy nghiệm thu trong vòng 7 ngày kể từ lúc lập biên bản.");
        }

        [Fact]
        public async Task UTCID06_Handle_ProjectNotActive_ShouldThrowBusinessException()
        {
            // Arrange
            var acceptance = new PhaseAcceptance
            {
                AcceptanceId = AcceptanceId,
                AcceptanceDate = DateTime.Now.AddDays(-2),
                IsCancelled = false,
                Phase = new Phase { Project = new Project { Status = ProjectStatus.Paused } } // project is paused
            };
            _mockAcceptanceRepo.Setup(r => r.Query()).Returns(new List<PhaseAcceptance> { acceptance }.AsQueryable().BuildMock());
            var command = new CancelAcceptanceCommand(AcceptanceId, "Hủy");

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_PROJECT_NOT_ACTIVE");
        }
    }
}
