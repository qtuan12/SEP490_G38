using BPG.Application.Features.Phases.Commands.UpdatePhaseBOQ;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Application.UnitTests.Helpers;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using Microsoft.Extensions.Logging;
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

namespace BPG.Application.UnitTests.Phases
{
    public class UpdatePhaseBOQCommandHandlerTests
    {
        private const long CurrentUserId = 1;
        private const long ProjectId = 1;
        private const long PhaseId = 10;
        private const long MaterialId = 50;
        private const int BaseUnitId = 1; // int as in entity definition

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<ILogger<UpdatePhaseBOQCommandHandler>> _mockLogger;
        private readonly Mock<INotificationService> _mockNotificationService;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;

        private readonly Mock<IGenericRepository<Phase>> _mockPhaseRepo;
        private readonly Mock<IGenericRepository<BOQItem>> _mockBOQRepo;
        private readonly Mock<IGenericRepository<MaterialCatalog>> _mockMaterialRepo;
        private readonly Mock<IGenericRepository<MaterialConversion>> _mockConversionRepo;
        private readonly Mock<IGenericRepository<MaterialRequestItem>> _mockMRItemRepo;
        private readonly Mock<IGenericRepository<DirectPurchaseItem>> _mockDPItemRepo;
        private readonly Mock<IGenericRepository<MaterialIssuanceItem>> _mockIssuanceItemRepo;
        private readonly Mock<IGenericRepository<User>> _mockUserRepo;
        private readonly Mock<IGenericRepository<ProjectMember>> _mockMemberRepo;

        private readonly UpdatePhaseBOQCommandHandler _handler;

        public UpdatePhaseBOQCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockLogger = new Mock<ILogger<UpdatePhaseBOQCommandHandler>>();
            _mockNotificationService = new Mock<INotificationService>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();

            _mockPhaseRepo = new Mock<IGenericRepository<Phase>>();
            _mockBOQRepo = new Mock<IGenericRepository<BOQItem>>();
            _mockMaterialRepo = new Mock<IGenericRepository<MaterialCatalog>>();
            _mockConversionRepo = new Mock<IGenericRepository<MaterialConversion>>();
            _mockMRItemRepo = new Mock<IGenericRepository<MaterialRequestItem>>();
            _mockDPItemRepo = new Mock<IGenericRepository<DirectPurchaseItem>>();
            _mockIssuanceItemRepo = new Mock<IGenericRepository<MaterialIssuanceItem>>();
            _mockUserRepo = new Mock<IGenericRepository<User>>();
            _mockMemberRepo = new Mock<IGenericRepository<ProjectMember>>();

            _mockUow.Setup(u => u.Repository<Phase>()).Returns(_mockPhaseRepo.Object);
            _mockUow.Setup(u => u.Repository<BOQItem>()).Returns(_mockBOQRepo.Object);
            _mockUow.Setup(u => u.Repository<MaterialCatalog>()).Returns(_mockMaterialRepo.Object);
            _mockUow.Setup(u => u.Repository<MaterialConversion>()).Returns(_mockConversionRepo.Object);
            _mockUow.Setup(u => u.Repository<MaterialRequestItem>()).Returns(_mockMRItemRepo.Object);
            _mockUow.Setup(u => u.Repository<DirectPurchaseItem>()).Returns(_mockDPItemRepo.Object);
            _mockUow.Setup(u => u.Repository<MaterialIssuanceItem>()).Returns(_mockIssuanceItemRepo.Object);
            _mockUow.Setup(u => u.Repository<User>()).Returns(_mockUserRepo.Object);
            _mockUow.Setup(u => u.Repository<ProjectMember>()).Returns(_mockMemberRepo.Object);

            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.TechnicalManager);

            _handler = new UpdatePhaseBOQCommandHandler(
                _mockUow.Object,
                _mockLogger.Object,
                _mockNotificationService.Object,
                _mockCurrentUserService.Object
            );
        }

        [Fact]
        public async Task UTCID01_Handle_ValidRequest_ShouldUpdateBOQSuccessfully()
        {
            // Arrange
            var phase = new Phase { PhaseId = PhaseId, ProjectId = ProjectId, Status = PhaseStatus.InProgress };
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase> { phase }.AsQueryable().BuildMock());

            var boqItem = new BOQItem { PhaseId = PhaseId, MaterialId = MaterialId, UnitId = BaseUnitId, Quantity = 100, IsDeleted = false };
            _mockBOQRepo.Setup(r => r.Query()).Returns(new List<BOQItem> { boqItem }.AsQueryable().BuildMock());

            var material = new MaterialCatalog { MaterialId = MaterialId, BaseUnitId = BaseUnitId, Name = "Xi măng" };
            _mockMaterialRepo.Setup(r => r.Query()).Returns(new List<MaterialCatalog> { material }.AsQueryable().BuildMock());

            var inputItem = new BOQItemInput(MaterialId, 100, BaseUnitId); // Positional record
            var command = new UpdatePhaseBOQCommand(ProjectId, PhaseId, new List<BOQItemInput> { inputItem });

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().BeTrue();
            boqItem.Quantity.Should().Be(100);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID02_Handle_PhaseNotFound_ShouldThrowNotFoundException()
        {
            // Arrange
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase>().AsQueryable().BuildMock());
            var command = new UpdatePhaseBOQCommand(ProjectId, 999, new List<BOQItemInput>());

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<NotFoundException>();
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task UTCID03_Handle_PhaseFrozen_ShouldThrowBusinessException()
        {
            // Arrange
            var phase = new Phase { PhaseId = PhaseId, ProjectId = ProjectId, Status = PhaseStatus.Approved };
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase> { phase }.AsQueryable().BuildMock());
            var command = new UpdatePhaseBOQCommand(ProjectId, PhaseId, new List<BOQItemInput>());

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Giai đoạn đã nghiệm thu, không thể cập nhật định mức vật tư.");
        }

        [Fact]
        public async Task UTCID04_Handle_MaterialNotFound_ShouldThrowNotFoundException()
        {
            // Arrange
            var phase = new Phase { PhaseId = PhaseId, ProjectId = ProjectId, Status = PhaseStatus.InProgress };
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase> { phase }.AsQueryable().BuildMock());

            _mockBOQRepo.Setup(r => r.Query()).Returns(new List<BOQItem>().AsQueryable().BuildMock());
            _mockMaterialRepo.Setup(r => r.Query()).Returns(new List<MaterialCatalog>().AsQueryable().BuildMock());

            var inputItem = new BOQItemInput(999, 100, BaseUnitId);
            var command = new UpdatePhaseBOQCommand(ProjectId, PhaseId, new List<BOQItemInput> { inputItem });

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<NotFoundException>();
        }

        [Fact]
        public async Task UTCID05_Handle_InvalidUnit_ShouldThrowBusinessException()
        {
            // Arrange
            var phase = new Phase { PhaseId = PhaseId, ProjectId = ProjectId, Status = PhaseStatus.InProgress };
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase> { phase }.AsQueryable().BuildMock());

            _mockBOQRepo.Setup(r => r.Query()).Returns(new List<BOQItem>().AsQueryable().BuildMock());

            var material = new MaterialCatalog { MaterialId = MaterialId, BaseUnitId = BaseUnitId, Name = "Xi măng" };
            _mockMaterialRepo.Setup(r => r.Query()).Returns(new List<MaterialCatalog> { material }.AsQueryable().BuildMock());

            // Alternative unit with no conversion mapped
            _mockConversionRepo.Setup(r => r.Query()).Returns(new List<MaterialConversion>().AsQueryable().BuildMock());

            var inputItem = new BOQItemInput(MaterialId, 100, 99);
            var command = new UpdatePhaseBOQCommand(ProjectId, PhaseId, new List<BOQItemInput> { inputItem });

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Đơn vị tính không được hỗ trợ cho vật tư 'Xi măng'.");
        }

        [Fact]
        public async Task UTCID06_Handle_DeleteUnusedMaterial_ShouldSoftDeleteSuccessfully()
        {
            // Arrange
            var phase = new Phase { PhaseId = PhaseId, ProjectId = ProjectId, Status = PhaseStatus.InProgress };
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase> { phase }.AsQueryable().BuildMock());

            var boqItem = new BOQItem { BOQItemId = 1, PhaseId = PhaseId, MaterialId = MaterialId, UnitId = BaseUnitId, Quantity = 100, IsDeleted = false };
            _mockBOQRepo.Setup(r => r.Query()).Returns(new List<BOQItem> { boqItem }.AsQueryable().BuildMock());

            var material = new MaterialCatalog { MaterialId = MaterialId, BaseUnitId = BaseUnitId, Name = "Xi măng" };
            _mockMaterialRepo.Setup(r => r.Query()).Returns(new List<MaterialCatalog> { material }.AsQueryable().BuildMock());

            // Material is deleted from request (empty items list)
            var command = new UpdatePhaseBOQCommand(ProjectId, PhaseId, new List<BOQItemInput>());

            // Material is not used anywhere
            _mockMRItemRepo.Setup(r => r.Query()).Returns(new List<MaterialRequestItem>().AsQueryable().BuildMock());
            _mockDPItemRepo.Setup(r => r.Query()).Returns(new List<DirectPurchaseItem>().AsQueryable().BuildMock());
            _mockIssuanceItemRepo.Setup(r => r.Query()).Returns(new List<MaterialIssuanceItem>().AsQueryable().BuildMock());

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().BeTrue();
            boqItem.IsDeleted.Should().BeTrue();
            _mockBOQRepo.Verify(r => r.Update(boqItem), Times.Once);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID07_Handle_DeleteInUseMaterial_ShouldThrowBusinessException()
        {
            // Arrange
            var phase = new Phase { PhaseId = PhaseId, ProjectId = ProjectId, Status = PhaseStatus.InProgress };
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase> { phase }.AsQueryable().BuildMock());

            var boqItem = new BOQItem { BOQItemId = 1, PhaseId = PhaseId, MaterialId = MaterialId, UnitId = BaseUnitId, Quantity = 100, IsDeleted = false };
            _mockBOQRepo.Setup(r => r.Query()).Returns(new List<BOQItem> { boqItem }.AsQueryable().BuildMock());

            var material = new MaterialCatalog { MaterialId = MaterialId, BaseUnitId = BaseUnitId, Name = "Xi măng" };
            _mockMaterialRepo.Setup(r => r.Query()).Returns(new List<MaterialCatalog> { material }.AsQueryable().BuildMock());

            var command = new UpdatePhaseBOQCommand(ProjectId, PhaseId, new List<BOQItemInput>()); // Delete XM

            // Material is in use in MR
            var mrItem = new MaterialRequestItem { MaterialId = MaterialId, Request = new MaterialRequest { PhaseId = PhaseId, IsDeleted = false } };
            _mockMRItemRepo.Setup(r => r.Query()).Returns(new List<MaterialRequestItem> { mrItem }.AsQueryable().BuildMock());
            _mockDPItemRepo.Setup(r => r.Query()).Returns(new List<DirectPurchaseItem>().AsQueryable().BuildMock());
            _mockIssuanceItemRepo.Setup(r => r.Query()).Returns(new List<MaterialIssuanceItem>().AsQueryable().BuildMock());

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Không thể xóa vật tư 'Xi măng' ra khỏi định mức do đã phát sinh yêu cầu cấp phát hoặc mua sắm.");
        }

        [Fact]
        public async Task UTCID08_Handle_ModifyInUseMaterialQuantity_ShouldThrowBusinessException()
        {
            // Arrange
            var phase = new Phase { PhaseId = PhaseId, ProjectId = ProjectId, Status = PhaseStatus.InProgress };
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase> { phase }.AsQueryable().BuildMock());

            var boqItem = new BOQItem { BOQItemId = 1, PhaseId = PhaseId, MaterialId = MaterialId, UnitId = BaseUnitId, Quantity = 100, IsDeleted = false };
            _mockBOQRepo.Setup(r => r.Query()).Returns(new List<BOQItem> { boqItem }.AsQueryable().BuildMock());

            var material = new MaterialCatalog { MaterialId = MaterialId, BaseUnitId = BaseUnitId, Name = "Xi măng" };
            _mockMaterialRepo.Setup(r => r.Query()).Returns(new List<MaterialCatalog> { material }.AsQueryable().BuildMock());

            // Material quantity changes from 100 to 150
            var inputItem = new BOQItemInput(MaterialId, 150, BaseUnitId);
            var command = new UpdatePhaseBOQCommand(ProjectId, PhaseId, new List<BOQItemInput> { inputItem });

            // Material is in use in DP
            var dpItem = new DirectPurchaseItem { MaterialId = MaterialId, DirectPurchaseRequest = new DirectPurchaseRequest { PhaseId = PhaseId, IsDeleted = false, Status = DirectPurchaseStatus.Pending } };
            _mockMRItemRepo.Setup(r => r.Query()).Returns(new List<MaterialRequestItem>().AsQueryable().BuildMock());
            _mockDPItemRepo.Setup(r => r.Query()).Returns(new List<DirectPurchaseItem> { dpItem }.AsQueryable().BuildMock());
            _mockIssuanceItemRepo.Setup(r => r.Query()).Returns(new List<MaterialIssuanceItem>().AsQueryable().BuildMock());

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Không thể thay đổi định mức vật tư 'Xi măng' do đã phát sinh yêu cầu cấp phát hoặc mua sắm.");
        }
    }
}
