using BPG.Application.Common.Models;
using BPG.Application.Features.MaterialRequests.Commands;
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

namespace BPG.Application.UnitTests.MaterialRequests
{
    public class ProcessMaterialRequestByAccountantCommandHandlerTests
    {
        private const long CurrentUserId = 20; // Accountant user ID
        private const long RequestId = 100;

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly Mock<INotificationService> _mockNotificationService;

        private readonly Mock<IGenericRepository<MaterialRequest>> _mockMRRepo;
        private readonly Mock<IGenericRepository<User>> _mockUserRepo;

        private readonly ProcessMaterialRequestByAccountantCommandHandler _handler;

        public ProcessMaterialRequestByAccountantCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();
            _mockNotificationService = new Mock<INotificationService>();

            _mockMRRepo = new Mock<IGenericRepository<MaterialRequest>>();
            _mockUserRepo = new Mock<IGenericRepository<User>>();

            _mockUow.Setup(u => u.Repository<MaterialRequest>()).Returns(_mockMRRepo.Object);
            _mockUow.Setup(u => u.Repository<User>()).Returns(_mockUserRepo.Object);

            var mockMRItemRepo = new Mock<IGenericRepository<MaterialRequestItem>>();
            var mockBOQRepo = new Mock<IGenericRepository<BOQItem>>();
            mockMRItemRepo.Setup(r => r.Query()).Returns(new List<MaterialRequestItem>().AsQueryable().BuildMock());
            mockBOQRepo.Setup(r => r.Query()).Returns(new List<BOQItem>().AsQueryable().BuildMock());
            _mockUow.Setup(u => u.Repository<MaterialRequestItem>()).Returns(mockMRItemRepo.Object);
            _mockUow.Setup(u => u.Repository<BOQItem>()).Returns(mockBOQRepo.Object);

            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.Accountant);

            _mockUow.Setup(u => u.BeginTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
            _mockUow.Setup(u => u.CommitTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
            _mockUow.Setup(u => u.RollbackTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

            _handler = new ProcessMaterialRequestByAccountantCommandHandler(
                _mockUow.Object,
                _mockCurrentUserService.Object,
                _mockNotificationService.Object
            );
        }

        [Fact]
        public async Task UTCID01_Handle_WithinBOQ_ShouldApproveDirectly()
        {
            // Arrange
            var mr = new MaterialRequest
            {
                RequestId = RequestId,
                Status = MaterialRequestStatus.Pending,
                BOQCheckStatus = BOQCheckStatus.WithinBOQ,
                Items = new List<MaterialRequestItem>(),
                Phase = new Phase
                {
                    Project = new Project { Status = ProjectStatus.InProgress }
                }
            };
            _mockMRRepo.Setup(r => r.Query()).Returns(new List<MaterialRequest> { mr }.AsQueryable().BuildMock());

            var command = new ProcessMaterialRequestByAccountantCommand(
                RequestId,
                MaterialRequestProcurementDecision.ExternalPurchase,
                "Duyệt yêu cầu");

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            result.Message.Should().Be("Đã phê duyệt yêu cầu trong định mức.");
        }

        [Fact]
        public async Task UTCID02_Handle_RequestNotFound_ShouldThrowNotFoundException()
        {
            // Arrange
            _mockMRRepo.Setup(r => r.Query()).Returns(new List<MaterialRequest>().AsQueryable().BuildMock());
            var command = new ProcessMaterialRequestByAccountantCommand(
                999,
                MaterialRequestProcurementDecision.ExternalPurchase,
                "Ghi chú");

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<NotFoundException>();
        }

        [Fact]
        public async Task UTCID03_Handle_OverBOQ_ShouldPromoteToWaitingApproval()
        {
            // Arrange
            var mr = new MaterialRequest
            {
                RequestId = RequestId,
                Status = MaterialRequestStatus.Pending,
                BOQCheckStatus = BOQCheckStatus.OverBOQ,
                Items = new List<MaterialRequestItem>(),
                Phase = new Phase
                {
                    Project = new Project { Status = ProjectStatus.InProgress }
                }
            };
            _mockMRRepo.Setup(r => r.Query()).Returns(new List<MaterialRequest> { mr }.AsQueryable().BuildMock());

            var command = new ProcessMaterialRequestByAccountantCommand(
                RequestId,
                MaterialRequestProcurementDecision.ExternalPurchase,
                "Trình Giám đốc");

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            result.Message.Should().Be("Đã trình Giám đốc xem xét yêu cầu vượt định mức.");
        }

        [Fact]
        public async Task UTCID04_Handle_InvalidStatus_ShouldThrowBusinessException()
        {
            // Arrange
            var mr = new MaterialRequest
            {
                RequestId = RequestId,
                Status = MaterialRequestStatus.Approved, // Already approved
                BOQCheckStatus = BOQCheckStatus.WithinBOQ,
                Items = new List<MaterialRequestItem>(),
                Phase = new Phase
                {
                    Project = new Project { Status = ProjectStatus.InProgress }
                }
            };
            _mockMRRepo.Setup(r => r.Query()).Returns(new List<MaterialRequest> { mr }.AsQueryable().BuildMock());

            var command = new ProcessMaterialRequestByAccountantCommand(
                RequestId,
                MaterialRequestProcurementDecision.ExternalPurchase,
                "Duyệt lại");

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Phiếu yêu cầu vật tư đang ở trạng thái: Approved. Chỉ hỗ trợ xử lý phiếu ở trạng thái Chờ duyệt (Pending).");
        }

        [Fact]
        public async Task UTCID05_Handle_ProjectNotActive_ShouldThrowBusinessException()
        {
            // Arrange
            var mr = new MaterialRequest
            {
                RequestId = RequestId,
                Status = MaterialRequestStatus.Pending,
                BOQCheckStatus = BOQCheckStatus.WithinBOQ,
                Items = new List<MaterialRequestItem>(),
                Phase = new Phase
                {
                    Project = new Project { Status = ProjectStatus.Paused } // project is paused
                }
            };
            _mockMRRepo.Setup(r => r.Query()).Returns(new List<MaterialRequest> { mr }.AsQueryable().BuildMock());

            var command = new ProcessMaterialRequestByAccountantCommand(
                RequestId,
                MaterialRequestProcurementDecision.ExternalPurchase,
                "Duyệt yêu cầu");

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_PROJECT_NOT_ACTIVE");
        }

        [Theory]
        [InlineData(MaterialRequestProcurementDecision.InternalTransfer, "Đã ghi nhận đề nghị điều chuyển nội bộ.")]
        [InlineData(MaterialRequestProcurementDecision.WaitSupply, "Đã ghi nhận chờ cung ứng.")]
        [InlineData(MaterialRequestProcurementDecision.NeedMoreInfo, "Đã yêu cầu bổ sung thông tin. Phiếu có thể được chỉnh sửa và gửi lại.")]
        [InlineData(MaterialRequestProcurementDecision.NotApproved, "Đã ghi nhận từ chối yêu cầu vật tư.")]
        public async Task UTCID06_Handle_NonPurchaseDecision_ShouldReturnExpectedOutcome(
            string decision,
            string expectedMessage)
        {
            var mr = new MaterialRequest
            {
                RequestId = RequestId,
                Status = MaterialRequestStatus.Pending,
                BOQCheckStatus = BOQCheckStatus.WithinBOQ,
                Items = new List<MaterialRequestItem>(),
                Phase = new Phase
                {
                    Project = new Project { Status = ProjectStatus.InProgress }
                }
            };
            _mockMRRepo.Setup(r => r.Query())
                .Returns(new List<MaterialRequest> { mr }.AsQueryable().BuildMock());

            var result = await _handler.Handle(
                new ProcessMaterialRequestByAccountantCommand(RequestId, decision, "Cơ sở thẩm định hợp lệ"),
                CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Message.Should().Be(expectedMessage);
        }

        [Fact]
        public async Task UTCID07_Handle_NonAccountantRole_ShouldThrowForbiddenException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.TechnicalManager);

            Func<Task> act = () => _handler.Handle(
                new ProcessMaterialRequestByAccountantCommand(
                    RequestId,
                    MaterialRequestProcurementDecision.ExternalPurchase,
                    "Cơ sở thẩm định hợp lệ"),
                CancellationToken.None);

            await act.Should().ThrowAsync<ForbiddenException>()
                .WithMessage("Chỉ Kế toán được phép thẩm định phương án cung ứng vật tư.");
        }
    }
}
