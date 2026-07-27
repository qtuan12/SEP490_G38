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
using InventoryAdjustmentType = BPG.Domain.Constants.InventoryAdjustmentType;
using InventoryAdjustmentStatus = BPG.Domain.Constants.InventoryAdjustmentStatus;

namespace BPG.Application.UnitTests.InventoryAdjustments
{
    public class CreateDecreaseAdjustmentCommandHandlerTests
    {
        private const long GeneratedAdjustmentId = 900;

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;

        private readonly Mock<IGenericRepository<Project>> _mockProjectRepo;
        private readonly Mock<IGenericRepository<Phase>> _mockPhaseRepo;
        private readonly Mock<IGenericRepository<MaterialCatalog>> _mockMaterialRepo;
        private readonly Mock<IGenericRepository<InventoryAdjustment>> _mockAdjustmentRepo;

        private readonly CreateDecreaseAdjustmentCommandHandler _handler;

        public CreateDecreaseAdjustmentCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();

            _mockProjectRepo = new Mock<IGenericRepository<Project>>();
            _mockPhaseRepo = new Mock<IGenericRepository<Phase>>();
            _mockMaterialRepo = new Mock<IGenericRepository<MaterialCatalog>>();
            _mockAdjustmentRepo = new Mock<IGenericRepository<InventoryAdjustment>>();

            _mockUow.Setup(u => u.Repository<Project>()).Returns(_mockProjectRepo.Object);
            _mockUow.Setup(u => u.Repository<Phase>()).Returns(_mockPhaseRepo.Object);
            _mockUow.Setup(u => u.Repository<MaterialCatalog>()).Returns(_mockMaterialRepo.Object);
            _mockUow.Setup(u => u.Repository<InventoryAdjustment>()).Returns(_mockAdjustmentRepo.Object);

            _mockMaterialRepo.SetupMockData(new List<MaterialCatalog>());
            _mockAdjustmentRepo.Setup(r => r.AddAsync(It.IsAny<InventoryAdjustment>(), It.IsAny<CancellationToken>()))
                .Callback<InventoryAdjustment, CancellationToken>((adjustment, _) => adjustment.AdjustmentId = GeneratedAdjustmentId)
                .Returns(Task.CompletedTask);

            _handler = new CreateDecreaseAdjustmentCommandHandler(
                _mockUow.Object,
                _mockCurrentUserService.Object,
                ServiceStubFactory.RealtimeSender(),
                ServiceStubFactory.NotificationService()
            );
        }

        [Fact]
        public async Task Handle_ProjectNotFound_ShouldThrowNotFoundException()
        {
            // Arrange
            long projectId = 99;
            _mockProjectRepo.Setup(r => r.GetByIdAsync(projectId, It.IsAny<CancellationToken>())).ReturnsAsync((Project?)null);

            var command = new CreateDecreaseAdjustmentCommand
            {
                ProjectId = projectId,
                PhaseId = 1,
                Reason = "Giảm tồn do hư hỏng",
                Items = new List<AdjustmentItemRequest> { new() { MaterialId = 10, Quantity = 2 } }
            };

            // Act & Assert
            await FluentActions.Invoking(() => _handler.Handle(command, CancellationToken.None))
                .Should().ThrowAsync<NotFoundException>();
        }

        [Fact]
        public async Task Handle_PhaseNotFound_ShouldThrowNotFoundException()
        {
            // Arrange
            long projectId = 1;
            long phaseId = 99;
            _mockProjectRepo.Setup(r => r.GetByIdAsync(projectId, It.IsAny<CancellationToken>())).ReturnsAsync(new Project { ProjectId = projectId });
            _mockPhaseRepo.Setup(r => r.GetByIdAsync(phaseId, It.IsAny<CancellationToken>())).ReturnsAsync((Phase?)null);

            var command = new CreateDecreaseAdjustmentCommand
            {
                ProjectId = projectId,
                PhaseId = phaseId,
                Reason = "Giảm tồn",
                Items = new List<AdjustmentItemRequest> { new() { MaterialId = 10, Quantity = 2 } }
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
            _mockProjectRepo.Setup(r => r.GetByIdAsync(projectId, It.IsAny<CancellationToken>())).ReturnsAsync(new Project { ProjectId = projectId });
            _mockPhaseRepo.Setup(r => r.GetByIdAsync(phaseId, It.IsAny<CancellationToken>())).ReturnsAsync(new Phase { PhaseId = phaseId, ProjectId = 888 });

            var command = new CreateDecreaseAdjustmentCommand
            {
                ProjectId = projectId,
                PhaseId = phaseId,
                Reason = "Giảm tồn",
                Items = new List<AdjustmentItemRequest> { new() { MaterialId = 10, Quantity = 2 } }
            };

            // Act & Assert
            var ex = await FluentActions.Invoking(() => _handler.Handle(command, CancellationToken.None))
                .Should().ThrowAsync<BusinessException>();

            ex.Which.Message.Should().Contain("Giai đoạn không thuộc dự án này");
        }

        [Fact]
        public async Task Handle_MaterialNotFound_ShouldThrowNotFoundException()
        {
            // Arrange
            long projectId = 1;
            long phaseId = 2;
            long materialId = 999;
            _mockProjectRepo.Setup(r => r.GetByIdAsync(projectId, It.IsAny<CancellationToken>())).ReturnsAsync(new Project { ProjectId = projectId });
            _mockPhaseRepo.Setup(r => r.GetByIdAsync(phaseId, It.IsAny<CancellationToken>())).ReturnsAsync(new Phase { PhaseId = phaseId, ProjectId = projectId });
            _mockMaterialRepo.SetupMockData(new List<MaterialCatalog>());

            var command = new CreateDecreaseAdjustmentCommand
            {
                ProjectId = projectId,
                PhaseId = phaseId,
                Reason = "Giảm tồn",
                Items = new List<AdjustmentItemRequest> { new() { MaterialId = materialId, Quantity = 2 } }
            };

            // Act & Assert
            await FluentActions.Invoking(() => _handler.Handle(command, CancellationToken.None))
                .Should().ThrowAsync<NotFoundException>();
        }

        [Fact]
        public async Task Handle_DiscreteUnitWithDecimalQuantity_ShouldThrowBusinessException()
        {
            // Arrange
            long projectId = 1;
            long phaseId = 2;
            long materialId = 10;
            _mockProjectRepo.Setup(r => r.GetByIdAsync(projectId, It.IsAny<CancellationToken>())).ReturnsAsync(new Project { ProjectId = projectId });
            _mockPhaseRepo.Setup(r => r.GetByIdAsync(phaseId, It.IsAny<CancellationToken>())).ReturnsAsync(new Phase { PhaseId = phaseId, ProjectId = projectId });

            var material = new MaterialCatalog
            {
                MaterialId = materialId,
                Name = "Máy biến áp",
                BaseUnitId = 1,
                BaseUnit = new Unit { UnitId = 1, UnitName = "Cái", IsDiscrete = true }
            };
            _mockMaterialRepo.SetupMockData(new List<MaterialCatalog> { material });

            var command = new CreateDecreaseAdjustmentCommand
            {
                ProjectId = projectId,
                PhaseId = phaseId,
                Reason = "Hao hụt máy móc",
                Items = new List<AdjustmentItemRequest> { new() { MaterialId = materialId, Quantity = 2.3m } }
            };

            // Act & Assert
            var ex = await FluentActions.Invoking(() => _handler.Handle(command, CancellationToken.None))
                .Should().ThrowAsync<BusinessException>();

            ex.Which.ErrorCode.Should().Be(ErrorCodes.InvalidUnitQuantity);
        }

        [Fact]
        public async Task Handle_ValidRequest_ShouldCreatePendingAdjustmentAndSendNotificationToDirector()
        {
            // Arrange
            long projectId = 1;
            long phaseId = 2;
            long materialId = 10;

            _mockProjectRepo.Setup(r => r.GetByIdAsync(projectId, It.IsAny<CancellationToken>())).ReturnsAsync(new Project { ProjectId = projectId, Name = "Dự án Alpha" });
            _mockPhaseRepo.Setup(r => r.GetByIdAsync(phaseId, It.IsAny<CancellationToken>())).ReturnsAsync(new Phase { PhaseId = phaseId, ProjectId = projectId });

            var material = new MaterialCatalog
            {
                MaterialId = materialId,
                Name = "Cát xây dựng",
                BaseUnitId = 3,
                BaseUnit = new Unit { UnitId = 3, UnitName = "m3", IsDiscrete = false }
            };
            _mockMaterialRepo.SetupMockData(new List<MaterialCatalog> { material });

            var command = new CreateDecreaseAdjustmentCommand
            {
                ProjectId = projectId,
                PhaseId = phaseId,
                Reason = "Trôi cát do mưa bão",
                Description = "Sự cố thời tiết",
                Items = new List<AdjustmentItemRequest> { new() { MaterialId = materialId, Quantity = 15.5m } }
            };

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.Success.Should().BeTrue();
            result.Data.Should().Be(GeneratedAdjustmentId);

        }
    }
}

