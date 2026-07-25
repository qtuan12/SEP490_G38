using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using BPG.Application.Common.Models;
using BPG.Application.Features.InventoryAdjustments.Commands;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Application.UnitTests.Helpers;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using Xunit;
using NotificationType = BPG.Domain.Constants.NotificationType;
using InventoryAdjustmentStatus = BPG.Domain.Constants.InventoryAdjustmentStatus;

namespace BPG.Application.UnitTests.InventoryAdjustments
{
    public class ApproveDecreaseAdjustmentCommandHandlerTests
    {
        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly Mock<IRealtimeNotificationSender> _mockRealtimeSender;
        private readonly Mock<INotificationService> _mockNotificationService;

        private readonly Mock<IGenericRepository<InventoryAdjustment>> _mockAdjustmentRepo;
        private readonly Mock<IGenericRepository<CurrentInventory>> _mockInventoryRepo;
        private readonly Mock<IGenericRepository<InventoryTransaction>> _mockTransactionRepo;
        private readonly Mock<IGenericRepository<Incident>> _mockIncidentRepo;

        private readonly ApproveDecreaseAdjustmentCommandHandler _handler;

        public ApproveDecreaseAdjustmentCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();
            _mockRealtimeSender = new Mock<IRealtimeNotificationSender>();
            _mockNotificationService = new Mock<INotificationService>();

            _mockAdjustmentRepo = new Mock<IGenericRepository<InventoryAdjustment>>();
            _mockInventoryRepo = new Mock<IGenericRepository<CurrentInventory>>();
            _mockTransactionRepo = new Mock<IGenericRepository<InventoryTransaction>>();
            _mockIncidentRepo = new Mock<IGenericRepository<Incident>>();

            _mockUow.Setup(u => u.Repository<InventoryAdjustment>()).Returns(_mockAdjustmentRepo.Object);
            _mockUow.Setup(u => u.Repository<CurrentInventory>()).Returns(_mockInventoryRepo.Object);
            _mockUow.Setup(u => u.Repository<InventoryTransaction>()).Returns(_mockTransactionRepo.Object);
            _mockUow.Setup(u => u.Repository<Incident>()).Returns(_mockIncidentRepo.Object);

            _mockIncidentRepo.SetupMockData(new List<Incident>());

            _handler = new ApproveDecreaseAdjustmentCommandHandler(
                _mockUow.Object,
                _mockCurrentUserService.Object,
                _mockRealtimeSender.Object,
                _mockNotificationService.Object
            );
        }

        [Fact]
        public async Task Handle_AdjustmentNotFound_ShouldThrowNotFoundException()
        {
            // Arrange
            long adjustmentId = 999;
            _mockAdjustmentRepo.SetupMockData(new List<InventoryAdjustment>());

            var command = new ApproveDecreaseAdjustmentCommand
            {
                AdjustmentId = adjustmentId,
                IsApproved = true
            };

            // Act & Assert
            await FluentActions.Invoking(() => _handler.Handle(command, CancellationToken.None))
                .Should().ThrowAsync<NotFoundException>();
        }

        [Fact]
        public async Task Handle_AdjustmentNotPending_ShouldThrowBusinessException()
        {
            // Arrange
            long adjustmentId = 1;
            var adjustment = new InventoryAdjustment
            {
                AdjustmentId = adjustmentId,
                Status = InventoryAdjustmentStatus.Approved // Đã duyệt rồi
            };
            _mockAdjustmentRepo.SetupMockData(new List<InventoryAdjustment> { adjustment });

            var command = new ApproveDecreaseAdjustmentCommand
            {
                AdjustmentId = adjustmentId,
                IsApproved = true
            };

            // Act & Assert
            var ex = await FluentActions.Invoking(() => _handler.Handle(command, CancellationToken.None))
                .Should().ThrowAsync<BusinessException>();

            ex.Which.ErrorCode.Should().Be("ERR_INVALID_STATUS");
        }

        [Fact]
        public async Task Handle_RejectRequest_ShouldUpdateStatusToRejectedAndSendNotification()
        {
            // Arrange
            long adjustmentId = 1;
            long directorId = 50;
            long creatorId = 10;
            _mockCurrentUserService.SetupUser(directorId);

            var adjustment = new InventoryAdjustment
            {
                AdjustmentId = adjustmentId,
                ProjectId = 100,
                Status = InventoryAdjustmentStatus.Pending,
                CreatedBy = creatorId
            };
            _mockAdjustmentRepo.SetupMockData(new List<InventoryAdjustment> { adjustment });

            var command = new ApproveDecreaseAdjustmentCommand
            {
                AdjustmentId = adjustmentId,
                IsApproved = false,
                RejectedReason = "Thông tin hao hụt không rõ ràng"
            };

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.Success.Should().BeTrue();

            adjustment.Status.Should().Be(InventoryAdjustmentStatus.Rejected);
            adjustment.RejectedReason.Should().Be("Thông tin hao hụt không rõ ràng");
            adjustment.ApprovedBy.Should().Be(directorId);

            _mockAdjustmentRepo.Verify(r => r.Update(adjustment), Times.Once);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);

            _mockNotificationService.Verify(n => n.SendNotificationAsync(
                creatorId,
                "Phiếu điều chỉnh giảm tồn bị từ chối",
                It.Is<string>(msg => msg.Contains("Thông tin hao hụt không rõ ràng")),
                NotificationType.Procurement,
                It.IsAny<string?>(),
                adjustmentId,
                It.IsAny<CancellationToken>()
            ), Times.Once);
        }

        [Fact]
        public async Task Handle_ApproveRequest_InsufficientStock_ShouldThrowBusinessException()
        {
            // Arrange
            long adjustmentId = 1;
            long directorId = 50;
            long materialId = 20;
            long projectId = 100;
            _mockCurrentUserService.SetupUser(directorId);

            var adjustment = new InventoryAdjustment
            {
                AdjustmentId = adjustmentId,
                ProjectId = projectId,
                Status = InventoryAdjustmentStatus.Pending,
                Items = new List<AdjustmentItem>
                {
                    new() { MaterialId = materialId, Quantity = 50m } // Yêu cầu giảm 50
                }
            };
            _mockAdjustmentRepo.SetupMockData(new List<InventoryAdjustment> { adjustment });

            // Tồn kho hiện tại chỉ có 30
            var currentInventory = new CurrentInventory
            {
                ProjectId = projectId,
                MaterialId = materialId,
                Quantity = 30m
            };
            _mockInventoryRepo.SetupMockData(new List<CurrentInventory> { currentInventory });

            var command = new ApproveDecreaseAdjustmentCommand
            {
                AdjustmentId = adjustmentId,
                IsApproved = true
            };

            // Act & Assert
            var ex = await FluentActions.Invoking(() => _handler.Handle(command, CancellationToken.None))
                .Should().ThrowAsync<BusinessException>();

            ex.Which.ErrorCode.Should().Be("ERR_INSUFFICIENT_STOCK");
        }

        [Fact]
        public async Task Handle_ApproveRequest_SufficientStock_ShouldDeductInventoryAndCreateTransaction()
        {
            // Arrange
            long adjustmentId = 1;
            long directorId = 50;
            long creatorId = 10;
            long materialId = 20;
            long projectId = 100;
            _mockCurrentUserService.SetupUser(directorId);

            var adjustment = new InventoryAdjustment
            {
                AdjustmentId = adjustmentId,
                ProjectId = projectId,
                Status = InventoryAdjustmentStatus.Pending,
                CreatedBy = creatorId,
                Items = new List<AdjustmentItem>
                {
                    new() { MaterialId = materialId, Quantity = 20m }
                }
            };
            _mockAdjustmentRepo.SetupMockData(new List<InventoryAdjustment> { adjustment });

            var currentInventory = new CurrentInventory
            {
                ProjectId = projectId,
                MaterialId = materialId,
                Quantity = 100m
            };
            _mockInventoryRepo.SetupMockData(new List<CurrentInventory> { currentInventory });

            var command = new ApproveDecreaseAdjustmentCommand
            {
                AdjustmentId = adjustmentId,
                IsApproved = true
            };

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.Success.Should().BeTrue();

            adjustment.Status.Should().Be(InventoryAdjustmentStatus.Approved);
            adjustment.ApprovedBy.Should().Be(directorId);
            currentInventory.Quantity.Should().Be(80m); // 100 - 20

            _mockInventoryRepo.Verify(r => r.Update(currentInventory), Times.Once);
            _mockTransactionRepo.Verify(r => r.AddAsync(It.Is<InventoryTransaction>(
                t => t.ProjectId == projectId &&
                     t.MaterialId == materialId &&
                     t.QuantityChange == -20m &&
                     t.BalanceAfter == 80m &&
                     t.ReferenceId == adjustmentId
            ), It.IsAny<CancellationToken>()), Times.Once);

            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);

            _mockNotificationService.Verify(n => n.SendNotificationAsync(
                creatorId,
                "Phiếu điều chỉnh giảm tồn được phê duyệt",
                It.Is<string>(msg => msg.Contains("đã được Giám đốc phê duyệt")),
                NotificationType.Procurement,
                It.IsAny<string?>(),
                adjustmentId,
                It.IsAny<CancellationToken>()
            ), Times.Once);
        }
    }
}
