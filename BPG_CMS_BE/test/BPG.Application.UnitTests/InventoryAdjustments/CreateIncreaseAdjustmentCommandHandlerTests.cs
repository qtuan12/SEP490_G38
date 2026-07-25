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
using UserRole = BPG.Domain.Constants.UserRole;
using NotificationType = BPG.Domain.Constants.NotificationType;
using ErrorCodes = BPG.Domain.Constants.ErrorCodes;

namespace BPG.Application.UnitTests.InventoryAdjustments
{
    public class CreateIncreaseAdjustmentCommandHandlerTests
    {
        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly Mock<IRealtimeNotificationSender> _mockRealtimeSender;
        private readonly Mock<INotificationService> _mockNotificationService;

        private readonly Mock<IGenericRepository<Project>> _mockProjectRepo;
        private readonly Mock<IGenericRepository<ProjectMember>> _mockMemberRepo;
        private readonly Mock<IGenericRepository<Phase>> _mockPhaseRepo;
        private readonly Mock<IGenericRepository<MaterialCatalog>> _mockMaterialRepo;
        private readonly Mock<IGenericRepository<CurrentInventory>> _mockInventoryRepo;
        private readonly Mock<IGenericRepository<InventoryTransaction>> _mockTransactionRepo;
        private readonly Mock<IGenericRepository<InventoryAdjustment>> _mockAdjustmentRepo;

        private readonly CreateIncreaseAdjustmentCommandHandler _handler;

        public CreateIncreaseAdjustmentCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();
            _mockRealtimeSender = new Mock<IRealtimeNotificationSender>();
            _mockNotificationService = new Mock<INotificationService>();

            _mockProjectRepo = new Mock<IGenericRepository<Project>>();
            _mockMemberRepo = new Mock<IGenericRepository<ProjectMember>>();
            _mockPhaseRepo = new Mock<IGenericRepository<Phase>>();
            _mockMaterialRepo = new Mock<IGenericRepository<MaterialCatalog>>();
            _mockInventoryRepo = new Mock<IGenericRepository<CurrentInventory>>();
            _mockTransactionRepo = new Mock<IGenericRepository<InventoryTransaction>>();
            _mockAdjustmentRepo = new Mock<IGenericRepository<InventoryAdjustment>>();

            _mockUow.Setup(u => u.Repository<Project>()).Returns(_mockProjectRepo.Object);
            _mockUow.Setup(u => u.Repository<ProjectMember>()).Returns(_mockMemberRepo.Object);
            _mockUow.Setup(u => u.Repository<Phase>()).Returns(_mockPhaseRepo.Object);
            _mockUow.Setup(u => u.Repository<MaterialCatalog>()).Returns(_mockMaterialRepo.Object);
            _mockUow.Setup(u => u.Repository<CurrentInventory>()).Returns(_mockInventoryRepo.Object);
            _mockUow.Setup(u => u.Repository<InventoryTransaction>()).Returns(_mockTransactionRepo.Object);
            _mockUow.Setup(u => u.Repository<InventoryAdjustment>()).Returns(_mockAdjustmentRepo.Object);

            _mockMemberRepo.SetupMockData(new List<ProjectMember>());
            _mockMaterialRepo.SetupMockData(new List<MaterialCatalog>());

            _handler = new CreateIncreaseAdjustmentCommandHandler(
                _mockUow.Object,
                _mockCurrentUserService.Object,
                _mockRealtimeSender.Object,
                _mockNotificationService.Object
            );
        }

        [Fact]
        public async Task Handle_ProjectNotFound_ShouldThrowNotFoundException()
        {
            // Arrange
            long projectId = 99;
            _mockProjectRepo.Setup(r => r.GetByIdAsync(projectId, It.IsAny<CancellationToken>())).ReturnsAsync((Project?)null);

            var command = new CreateIncreaseAdjustmentCommand
            {
                ProjectId = projectId,
                PhaseId = 1,
                Reason = "Tăng tồn kho",
                Items = new List<AdjustmentItemRequest> { new() { MaterialId = 10, Quantity = 5 } }
            };

            // Act & Assert
            await FluentActions.Invoking(() => _handler.Handle(command, CancellationToken.None))
                .Should().ThrowAsync<NotFoundException>();
        }

        [Fact]
        public async Task Handle_UserNotLeaderOrManager_ShouldThrowBusinessException()
        {
            // Arrange
            long projectId = 1;
            long userId = 100;
            _mockProjectRepo.Setup(r => r.GetByIdAsync(projectId, It.IsAny<CancellationToken>())).ReturnsAsync(new Project { ProjectId = projectId });
            _mockCurrentUserService.SetupUser(userId, UserRole.Accountant, hasRole: false);
            _mockMemberRepo.SetupMockData(new List<ProjectMember>()); // User is not leader

            var command = new CreateIncreaseAdjustmentCommand
            {
                ProjectId = projectId,
                PhaseId = 1,
                Reason = "Tăng tồn kho",
                Items = new List<AdjustmentItemRequest> { new() { MaterialId = 10, Quantity = 5 } }
            };

            // Act & Assert
            var ex = await FluentActions.Invoking(() => _handler.Handle(command, CancellationToken.None))
                .Should().ThrowAsync<BusinessException>();

            ex.Which.ErrorCode.Should().Be(ErrorCodes.Forbidden);
        }

        [Fact]
        public async Task Handle_PhaseNotFound_ShouldThrowNotFoundException()
        {
            // Arrange
            long projectId = 1;
            long phaseId = 99;
            long userId = 100;
            _mockProjectRepo.Setup(r => r.GetByIdAsync(projectId, It.IsAny<CancellationToken>())).ReturnsAsync(new Project { ProjectId = projectId });
            _mockCurrentUserService.SetupUser(userId, UserRole.Admin, hasRole: true);
            _mockPhaseRepo.Setup(r => r.GetByIdAsync(phaseId, It.IsAny<CancellationToken>())).ReturnsAsync((Phase?)null);

            var command = new CreateIncreaseAdjustmentCommand
            {
                ProjectId = projectId,
                PhaseId = phaseId,
                Reason = "Tăng tồn kho",
                Items = new List<AdjustmentItemRequest> { new() { MaterialId = 10, Quantity = 5 } }
            };

            // Act & Assert
            await FluentActions.Invoking(() => _handler.Handle(command, CancellationToken.None))
                .Should().ThrowAsync<NotFoundException>();
        }

        [Fact]
        public async Task Handle_PhaseNotInProject_ShouldThrowBusinessException()
        {
            // Arrange
            long projectId = 1;
            long phaseId = 2;
            long userId = 100;
            _mockProjectRepo.Setup(r => r.GetByIdAsync(projectId, It.IsAny<CancellationToken>())).ReturnsAsync(new Project { ProjectId = projectId });
            _mockCurrentUserService.SetupUser(userId, UserRole.Admin, hasRole: true);
            _mockPhaseRepo.Setup(r => r.GetByIdAsync(phaseId, It.IsAny<CancellationToken>())).ReturnsAsync(new Phase { PhaseId = phaseId, ProjectId = 999 });

            var command = new CreateIncreaseAdjustmentCommand
            {
                ProjectId = projectId,
                PhaseId = phaseId,
                Reason = "Tăng tồn kho",
                Items = new List<AdjustmentItemRequest> { new() { MaterialId = 10, Quantity = 5 } }
            };

            // Act & Assert
            var ex = await FluentActions.Invoking(() => _handler.Handle(command, CancellationToken.None))
                .Should().ThrowAsync<BusinessException>();

            ex.Which.ErrorCode.Should().Be(ErrorCodes.InvalidTransition);
        }

        [Fact]
        public async Task Handle_DiscreteUnitWithDecimalQuantity_ShouldThrowBusinessException()
        {
            // Arrange
            long projectId = 1;
            long phaseId = 2;
            long userId = 100;
            long materialId = 10;

            _mockProjectRepo.Setup(r => r.GetByIdAsync(projectId, It.IsAny<CancellationToken>())).ReturnsAsync(new Project { ProjectId = projectId });
            _mockCurrentUserService.SetupUser(userId, UserRole.Admin, hasRole: true);
            _mockPhaseRepo.Setup(r => r.GetByIdAsync(phaseId, It.IsAny<CancellationToken>())).ReturnsAsync(new Phase { PhaseId = phaseId, ProjectId = projectId });

            var material = new MaterialCatalog
            {
                MaterialId = materialId,
                Name = "Cột điện",
                BaseUnitId = 1,
                BaseUnit = new Unit { UnitId = 1, UnitName = "Cái", IsDiscrete = true }
            };
            _mockMaterialRepo.SetupMockData(new List<MaterialCatalog> { material });

            var command = new CreateIncreaseAdjustmentCommand
            {
                ProjectId = projectId,
                PhaseId = phaseId,
                Reason = "Tăng tồn lẻ",
                Items = new List<AdjustmentItemRequest> { new() { MaterialId = materialId, Quantity = 1.5m } }
            };

            // Act & Assert
            var ex = await FluentActions.Invoking(() => _handler.Handle(command, CancellationToken.None))
                .Should().ThrowAsync<BusinessException>();

            ex.Which.ErrorCode.Should().Be(ErrorCodes.InvalidUnitQuantity);
        }

        [Fact]
        public async Task Handle_ValidRequest_NewInventory_ShouldCreateInventoryAndTransactions()
        {
            // Arrange
            long projectId = 1;
            long phaseId = 2;
            long userId = 100;
            long materialId = 10;

            _mockProjectRepo.Setup(r => r.GetByIdAsync(projectId, It.IsAny<CancellationToken>())).ReturnsAsync(new Project { ProjectId = projectId });
            _mockCurrentUserService.SetupUser(userId, UserRole.Admin, hasRole: true);
            _mockPhaseRepo.Setup(r => r.GetByIdAsync(phaseId, It.IsAny<CancellationToken>())).ReturnsAsync(new Phase { PhaseId = phaseId, ProjectId = projectId });

            var material = new MaterialCatalog
            {
                MaterialId = materialId,
                Name = "Xi măng",
                BaseUnitId = 1,
                BaseUnit = new Unit { UnitId = 1, UnitName = "Bao", IsDiscrete = true }
            };
            _mockMaterialRepo.SetupMockData(new List<MaterialCatalog> { material });
            _mockInventoryRepo.SetupMockData(new List<CurrentInventory>()); // Kho chưa có vật tư này

            var command = new CreateIncreaseAdjustmentCommand
            {
                ProjectId = projectId,
                PhaseId = phaseId,
                Reason = "Tăng tồn kho dư thừa",
                Description = "Ghi chú thêm",
                Items = new List<AdjustmentItemRequest> { new() { MaterialId = materialId, Quantity = 10m } }
            };

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.Success.Should().BeTrue();

            _mockInventoryRepo.Verify(r => r.AddAsync(It.Is<CurrentInventory>(
                ci => ci.ProjectId == projectId && ci.MaterialId == materialId && ci.Quantity == 10m
            ), It.IsAny<CancellationToken>()), Times.Once);

            _mockAdjustmentRepo.Verify(r => r.AddAsync(It.Is<InventoryAdjustment>(
                a => a.ProjectId == projectId && a.PhaseId == phaseId && a.AdjustmentType == BPG.Domain.Constants.InventoryAdjustmentType.Increase && a.Status == BPG.Domain.Constants.InventoryAdjustmentStatus.Approved
            ), It.IsAny<CancellationToken>()), Times.Once);

            _mockTransactionRepo.Verify(r => r.AddAsync(It.Is<InventoryTransaction>(
                t => t.ProjectId == projectId && t.MaterialId == materialId && t.QuantityChange == 10m && t.BalanceAfter == 10m
            ), It.IsAny<CancellationToken>()), Times.Once);

            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Exactly(2));
            _mockNotificationService.Verify(n => n.SendNotificationToRoleAsync(
                UserRole.Accountant,
                It.IsAny<string>(),
                It.IsAny<string>(),
                NotificationType.Procurement,
                It.IsAny<string?>(),
                It.IsAny<long?>(),
                It.IsAny<CancellationToken>()
            ), Times.Once);
        }

        [Fact]
        public async Task Handle_ValidRequest_ExistingInventory_ShouldUpdateInventoryQuantity()
        {
            // Arrange
            long projectId = 1;
            long phaseId = 2;
            long userId = 100;
            long materialId = 10;

            _mockProjectRepo.Setup(r => r.GetByIdAsync(projectId, It.IsAny<CancellationToken>())).ReturnsAsync(new Project { ProjectId = projectId });
            _mockCurrentUserService.SetupUser(userId, UserRole.Admin, hasRole: true);
            _mockPhaseRepo.Setup(r => r.GetByIdAsync(phaseId, It.IsAny<CancellationToken>())).ReturnsAsync(new Phase { PhaseId = phaseId, ProjectId = projectId });

            var material = new MaterialCatalog
            {
                MaterialId = materialId,
                Name = "Thép",
                BaseUnitId = 2,
                BaseUnit = new Unit { UnitId = 2, UnitName = "Kg", IsDiscrete = false }
            };
            _mockMaterialRepo.SetupMockData(new List<MaterialCatalog> { material });

            var existingInventory = new CurrentInventory
            {
                ProjectId = projectId,
                MaterialId = materialId,
                UnitId = 2,
                Quantity = 50m
            };
            _mockInventoryRepo.SetupMockData(new List<CurrentInventory> { existingInventory });

            var command = new CreateIncreaseAdjustmentCommand
            {
                ProjectId = projectId,
                PhaseId = phaseId,
                Reason = "Kiểm kê kho tăng thêm",
                Items = new List<AdjustmentItemRequest> { new() { MaterialId = materialId, Quantity = 25.5m } }
            };

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.Success.Should().BeTrue();

            existingInventory.Quantity.Should().Be(75.5m);
            _mockInventoryRepo.Verify(r => r.Update(existingInventory), Times.Once);

            _mockTransactionRepo.Verify(r => r.AddAsync(It.Is<InventoryTransaction>(
                t => t.ProjectId == projectId && t.MaterialId == materialId && t.QuantityChange == 25.5m && t.BalanceAfter == 75.5m
            ), It.IsAny<CancellationToken>()), Times.Once);
        }
    }
}
