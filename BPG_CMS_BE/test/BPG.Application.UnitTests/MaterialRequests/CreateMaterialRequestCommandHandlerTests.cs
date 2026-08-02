using BPG.Application.Common.Models;
using BPG.Application.Features.MaterialRequests.Commands;
using BPG.Application.Features.MaterialRequests.Handlers;
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
    public class CreateMaterialRequestCommandHandlerTests
    {
        private const long CurrentUserId = 10;
        private const long ProjectId = 1;
        private const long PhaseId = 10;
        private const long MaterialId = 50;
        private const int UnitId = 5; // int as in entity definition

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly Mock<INotificationService> _mockNotificationService;

        private readonly Mock<IGenericRepository<Project>> _mockProjectRepo;
        private readonly Mock<IGenericRepository<Phase>> _mockPhaseRepo;
        private readonly Mock<IGenericRepository<MaterialCatalog>> _mockMaterialRepo;
        private readonly Mock<IGenericRepository<Unit>> _mockUnitRepo;
        private readonly Mock<IGenericRepository<MaterialConversion>> _mockConversionRepo;
        private readonly Mock<IGenericRepository<BOQItem>> _mockBOQRepo;
        private readonly Mock<IGenericRepository<MaterialRequest>> _mockMRRepo;
        private readonly Mock<IGenericRepository<MaterialRequestItem>> _mockMRItemRepo;
        private readonly Mock<IGenericRepository<User>> _mockUserRepo;

        public CreateMaterialRequestCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();
            _mockNotificationService = new Mock<INotificationService>();

            _mockProjectRepo = new Mock<IGenericRepository<Project>>();
            _mockPhaseRepo = new Mock<IGenericRepository<Phase>>();
            _mockMaterialRepo = new Mock<IGenericRepository<MaterialCatalog>>();
            _mockUnitRepo = new Mock<IGenericRepository<Unit>>();
            _mockConversionRepo = new Mock<IGenericRepository<MaterialConversion>>();
            _mockBOQRepo = new Mock<IGenericRepository<BOQItem>>();
            _mockMRRepo = new Mock<IGenericRepository<MaterialRequest>>();
            _mockMRItemRepo = new Mock<IGenericRepository<MaterialRequestItem>>();
            _mockUserRepo = new Mock<IGenericRepository<User>>();

            _mockUow.Setup(u => u.Repository<Project>()).Returns(_mockProjectRepo.Object);
            _mockUow.Setup(u => u.Repository<Phase>()).Returns(_mockPhaseRepo.Object);
            _mockUow.Setup(u => u.Repository<MaterialCatalog>()).Returns(_mockMaterialRepo.Object);
            _mockUow.Setup(u => u.Repository<Unit>()).Returns(_mockUnitRepo.Object);
            _mockUow.Setup(u => u.Repository<MaterialConversion>()).Returns(_mockConversionRepo.Object);
            _mockUow.Setup(u => u.Repository<BOQItem>()).Returns(_mockBOQRepo.Object);
            _mockUow.Setup(u => u.Repository<MaterialRequest>()).Returns(_mockMRRepo.Object);
            _mockUow.Setup(u => u.Repository<MaterialRequestItem>()).Returns(_mockMRItemRepo.Object);
            _mockUow.Setup(u => u.Repository<User>()).Returns(_mockUserRepo.Object);

            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.SiteEngineer);

            _mockMRRepo.Setup(r => r.AddAsync(It.IsAny<MaterialRequest>(), It.IsAny<CancellationToken>()))
                .Callback<MaterialRequest, CancellationToken>((mr, ct) => mr.RequestId = 100)
                .Returns(Task.CompletedTask);

            _handler = new CreateMaterialRequestCommandHandler(
                _mockUow.Object,
                _mockCurrentUserService.Object,
                _mockNotificationService.Object
            );
        }

        private readonly CreateMaterialRequestCommandHandler _handler;

        [Fact]
        public async Task UTCID01_Handle_ValidRequestWithinBOQ_ShouldCreateSuccessfully()
        {
            // Arrange
            var project = new Project { ProjectId = ProjectId, Status = ProjectStatus.InProgress };
            _mockProjectRepo.Setup(r => r.Query()).Returns(new List<Project> { project }.AsQueryable().BuildMock());

            var phase = new Phase { PhaseId = PhaseId, ProjectId = ProjectId, Status = PhaseStatus.InProgress };
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase> { phase }.AsQueryable().BuildMock());

            var material = new MaterialCatalog { MaterialId = MaterialId, BaseUnitId = UnitId, Name = "Cát" };
            _mockMaterialRepo.Setup(r => r.Query()).Returns(new List<MaterialCatalog> { material }.AsQueryable().BuildMock());

            var unit = new Unit { UnitId = UnitId, UnitName = "Khối", IsDiscrete = false };
            _mockUnitRepo.Setup(r => r.Query()).Returns(new List<Unit> { unit }.AsQueryable().BuildMock());

            var boq = new BOQItem { PhaseId = PhaseId, MaterialId = MaterialId, UnitId = UnitId, Quantity = 100, ConversionRate = 1.0m };
            _mockBOQRepo.Setup(r => r.Query()).Returns(new List<BOQItem> { boq }.AsQueryable().BuildMock());

            // Cumulative requested = 0
            _mockMRItemRepo.Setup(r => r.Query()).Returns(new List<MaterialRequestItem>().AsQueryable().BuildMock());

            var command = new CreateMaterialRequestCommand(
                ProjectId: ProjectId,
                PhaseId: PhaseId,
                Reason: "Xây tường",
                Type: "normal",
                InvoiceImage: null,
                Items: new List<MaterialRequestItemInput>
                {
                    new MaterialRequestItemInput("Cát", 10, "Khối")
                }
            );

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            result.Data.Should().Be(100);
            _mockMRRepo.Verify(r => r.AddAsync(It.Is<MaterialRequest>(m => m.BOQCheckStatus == BOQCheckStatus.WithinBOQ), It.IsAny<CancellationToken>()), Times.Once);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Exactly(2));
        }

        [Fact]
        public async Task UTCID02_Handle_ProjectNotFound_ShouldThrowNotFoundException()
        {
            // Arrange
            _mockProjectRepo.Setup(r => r.Query()).Returns(new List<Project>().AsQueryable().BuildMock());
            var command = new CreateMaterialRequestCommand(999, PhaseId, "Reason", "normal", null, new List<MaterialRequestItemInput>());

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<NotFoundException>();
        }

        [Fact]
        public async Task UTCID03_Handle_ProjectNotActive_ShouldThrowBusinessException()
        {
            // Arrange
            var project = new Project { ProjectId = ProjectId, Status = ProjectStatus.Paused };
            _mockProjectRepo.Setup(r => r.Query()).Returns(new List<Project> { project }.AsQueryable().BuildMock());
            var command = new CreateMaterialRequestCommand(ProjectId, PhaseId, "Reason", "normal", null, new List<MaterialRequestItemInput>());

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Dự án hiện không ở trạng thái hoạt động (InProgress).");
        }

        [Fact]
        public async Task UTCID04_Handle_RequestExceedsBOQ_ShouldCreateWithOverBOQStatus()
        {
            // Arrange
            var project = new Project { ProjectId = ProjectId, Status = ProjectStatus.InProgress };
            _mockProjectRepo.Setup(r => r.Query()).Returns(new List<Project> { project }.AsQueryable().BuildMock());

            var phase = new Phase { PhaseId = PhaseId, ProjectId = ProjectId, Status = PhaseStatus.InProgress };
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase> { phase }.AsQueryable().BuildMock());

            var material = new MaterialCatalog { MaterialId = MaterialId, BaseUnitId = UnitId, Name = "Cát" };
            _mockMaterialRepo.Setup(r => r.Query()).Returns(new List<MaterialCatalog> { material }.AsQueryable().BuildMock());

            var unit = new Unit { UnitId = UnitId, UnitName = "Khối", IsDiscrete = false };
            _mockUnitRepo.Setup(r => r.Query()).Returns(new List<Unit> { unit }.AsQueryable().BuildMock());

            var boq = new BOQItem { PhaseId = PhaseId, MaterialId = MaterialId, UnitId = UnitId, Quantity = 100, ConversionRate = 1.0m };
            _mockBOQRepo.Setup(r => r.Query()).Returns(new List<BOQItem> { boq }.AsQueryable().BuildMock());

            // Cumulative requested = 0, but new request quantity is 1000 (> 100)
            _mockMRItemRepo.Setup(r => r.Query()).Returns(new List<MaterialRequestItem>().AsQueryable().BuildMock());

            var command = new CreateMaterialRequestCommand(
                ProjectId: ProjectId,
                PhaseId: PhaseId,
                Reason: "Vượt định mức",
                Type: "normal",
                InvoiceImage: null,
                Items: new List<MaterialRequestItemInput>
                {
                    new MaterialRequestItemInput("Cát", 1000, "Khối")
                }
            );

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            result.Data.Should().Be(100);
            _mockMRRepo.Verify(r => r.AddAsync(It.Is<MaterialRequest>(m => m.BOQCheckStatus == BOQCheckStatus.OverBOQ), It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID05_Handle_EmergencyRequest_ShouldThrowBusinessException()
        {
            // Arrange
            var command = new CreateMaterialRequestCommand(ProjectId, PhaseId, "Reason", "emergency", null, new List<MaterialRequestItemInput>());

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Hệ thống không hỗ trợ lập phiếu mua ngoài khẩn cấp qua luồng yêu cầu này.*");
        }

        [Fact]
        public async Task UTCID06_Handle_PhaseProjectMismatch_ShouldThrowBusinessException()
        {
            // Arrange
            var project = new Project { ProjectId = ProjectId, Status = ProjectStatus.InProgress };
            _mockProjectRepo.Setup(r => r.Query()).Returns(new List<Project> { project }.AsQueryable().BuildMock());

            // Phase belongs to a different project
            var phase = new Phase { PhaseId = PhaseId, ProjectId = 999, Status = PhaseStatus.InProgress };
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase> { phase }.AsQueryable().BuildMock());

            var command = new CreateMaterialRequestCommand(ProjectId, PhaseId, "Reason", "normal", null, new List<MaterialRequestItemInput>());

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Giai đoạn không thuộc dự án đã chọn.");
        }

        [Fact]
        public async Task UTCID07_Handle_PhaseFrozen_ShouldThrowBusinessException()
        {
            // Arrange
            var project = new Project { ProjectId = ProjectId, Status = ProjectStatus.InProgress };
            _mockProjectRepo.Setup(r => r.Query()).Returns(new List<Project> { project }.AsQueryable().BuildMock());

            var phase = new Phase { PhaseId = PhaseId, ProjectId = ProjectId, Status = PhaseStatus.Approved };
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase> { phase }.AsQueryable().BuildMock());

            var command = new CreateMaterialRequestCommand(ProjectId, PhaseId, "Reason", "normal", null, new List<MaterialRequestItemInput>());

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Giai đoạn đã được nghiệm thu và đóng băng (Approved), không thể yêu cầu vật tư mới.");
        }

        [Fact]
        public async Task UTCID08_Handle_DiscreteUnitWithDecimalQuantity_ShouldThrowBusinessException()
        {
            // Arrange
            var project = new Project { ProjectId = ProjectId, Status = ProjectStatus.InProgress };
            _mockProjectRepo.Setup(r => r.Query()).Returns(new List<Project> { project }.AsQueryable().BuildMock());

            var phase = new Phase { PhaseId = PhaseId, ProjectId = ProjectId, Status = PhaseStatus.InProgress };
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase> { phase }.AsQueryable().BuildMock());

            var material = new MaterialCatalog { MaterialId = MaterialId, BaseUnitId = UnitId, Name = "Gạch" };
            _mockMaterialRepo.Setup(r => r.Query()).Returns(new List<MaterialCatalog> { material }.AsQueryable().BuildMock());

            var unit = new Unit { UnitId = UnitId, UnitName = "Viên", IsDiscrete = true }; // Discrete unit
            _mockUnitRepo.Setup(r => r.Query()).Returns(new List<Unit> { unit }.AsQueryable().BuildMock());

            var command = new CreateMaterialRequestCommand(
                ProjectId: ProjectId,
                PhaseId: PhaseId,
                Reason: "Lập số lẻ",
                Type: "normal",
                InvoiceImage: null,
                Items: new List<MaterialRequestItemInput>
                {
                    new MaterialRequestItemInput("Gạch", 10.5m, "Viên") // Fractional quantity
                }
            );

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Đơn vị tính 'Viên' yêu cầu số lượng phải là số nguyên.");
        }
    }
}
