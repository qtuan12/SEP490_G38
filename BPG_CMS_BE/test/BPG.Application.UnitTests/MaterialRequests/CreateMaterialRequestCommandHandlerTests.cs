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
        private const int UnitId = 5;

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
        private readonly Mock<IGenericRepository<ProjectMember>> _mockProjectMemberRepo;

        private readonly CreateMaterialRequestCommandHandler _handler;

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
            _mockProjectMemberRepo = new Mock<IGenericRepository<ProjectMember>>();

            _mockUow.Setup(u => u.Repository<Project>()).Returns(_mockProjectRepo.Object);
            _mockUow.Setup(u => u.Repository<Phase>()).Returns(_mockPhaseRepo.Object);
            _mockUow.Setup(u => u.Repository<MaterialCatalog>()).Returns(_mockMaterialRepo.Object);
            _mockUow.Setup(u => u.Repository<Unit>()).Returns(_mockUnitRepo.Object);
            _mockUow.Setup(u => u.Repository<MaterialConversion>()).Returns(_mockConversionRepo.Object);
            _mockUow.Setup(u => u.Repository<BOQItem>()).Returns(_mockBOQRepo.Object);
            _mockUow.Setup(u => u.Repository<MaterialRequest>()).Returns(_mockMRRepo.Object);
            _mockUow.Setup(u => u.Repository<MaterialRequestItem>()).Returns(_mockMRItemRepo.Object);
            _mockUow.Setup(u => u.Repository<User>()).Returns(_mockUserRepo.Object);
            _mockUow.Setup(u => u.Repository<ProjectMember>()).Returns(_mockProjectMemberRepo.Object);

            SetupProjectLeader();

            _mockMRRepo.Setup(r => r.AddAsync(It.IsAny<MaterialRequest>(), It.IsAny<CancellationToken>()))
                .Callback<MaterialRequest, CancellationToken>((mr, ct) => mr.RequestId = 100)
                .Returns(Task.CompletedTask);

            _handler = new CreateMaterialRequestCommandHandler(
                _mockUow.Object,
                _mockCurrentUserService.Object,
                _mockNotificationService.Object
            );
        }

        private void SetupProjectLeader(bool isLeader = true)
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.SiteEngineer);
            var user = new User { UserId = CurrentUserId, FullName = "Trưởng dự án" };
            _mockUserRepo.Setup(r => r.GetByIdAsync(CurrentUserId, It.IsAny<CancellationToken>())).ReturnsAsync(user);

            var member = new ProjectMember { ProjectId = ProjectId, UserId = CurrentUserId, IsLeader = isLeader };
            var membersList = new List<ProjectMember> { member };
            _mockProjectMemberRepo.Setup(r => r.Query()).Returns(membersList.AsQueryable().BuildMock());
        }

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

            _mockMRItemRepo.Setup(r => r.Query()).Returns(new List<MaterialRequestItem>().AsQueryable().BuildMock());

            var command = new CreateMaterialRequestCommand(
                ProjectId: ProjectId,
                PhaseId: PhaseId,
                Reason: "Valid reason",
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
        }

        [Fact]
        public async Task UTCID02_Handle_RequestExceedsBOQ_ShouldCreateWithOverBOQStatus()
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

            _mockMRItemRepo.Setup(r => r.Query()).Returns(new List<MaterialRequestItem>().AsQueryable().BuildMock());

            var command = new CreateMaterialRequestCommand(
                ProjectId: ProjectId,
                PhaseId: PhaseId,
                Reason: "Over BOQ",
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
            _mockMRRepo.Verify(r => r.AddAsync(It.Is<MaterialRequest>(m => m.BOQCheckStatus == BOQCheckStatus.OverBOQ), It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID03_Handle_RequestExceedsBOQAlternative_ShouldCreateWithOverBOQStatus()
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

            _mockMRItemRepo.Setup(r => r.Query()).Returns(new List<MaterialRequestItem>().AsQueryable().BuildMock());

            var command = new CreateMaterialRequestCommand(
                ProjectId: ProjectId,
                PhaseId: PhaseId,
                Reason: "Over BOQ 2",
                Type: "normal",
                InvoiceImage: null,
                Items: new List<MaterialRequestItemInput>
                {
                    new MaterialRequestItemInput("Cát", 500, "Khối")
                }
            );

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            _mockMRRepo.Verify(r => r.AddAsync(It.Is<MaterialRequest>(m => m.BOQCheckStatus == BOQCheckStatus.OverBOQ), It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID04_Handle_RequestWithAlternativeUnit_ShouldCreateSuccessfully()
        {
            // Arrange
            var project = new Project { ProjectId = ProjectId, Status = ProjectStatus.InProgress };
            _mockProjectRepo.Setup(r => r.Query()).Returns(new List<Project> { project }.AsQueryable().BuildMock());

            var phase = new Phase { PhaseId = PhaseId, ProjectId = ProjectId, Status = PhaseStatus.InProgress };
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase> { phase }.AsQueryable().BuildMock());

            var material = new MaterialCatalog { MaterialId = MaterialId, BaseUnitId = UnitId, Name = "Xi măng PCB40" };
            _mockMaterialRepo.Setup(r => r.Query()).Returns(new List<MaterialCatalog> { material }.AsQueryable().BuildMock());

            var baseUnit = new Unit { UnitId = UnitId, UnitName = "Bao", IsDiscrete = true };
            var altUnit = new Unit { UnitId = 20, UnitName = "Tấn", IsDiscrete = false };
            _mockUnitRepo.Setup(r => r.Query()).Returns(new List<Unit> { baseUnit, altUnit }.AsQueryable().BuildMock());

            var conversion = new MaterialConversion { MaterialId = MaterialId, AlternativeUnitId = 20, ConversionRate = 20.0m, IsDeleted = false };
            _mockConversionRepo.Setup(r => r.Query()).Returns(new List<MaterialConversion> { conversion }.AsQueryable().BuildMock());

            var boq = new BOQItem { PhaseId = PhaseId, MaterialId = MaterialId, UnitId = UnitId, Quantity = 200, ConversionRate = 1.0m };
            _mockBOQRepo.Setup(r => r.Query()).Returns(new List<BOQItem> { boq }.AsQueryable().BuildMock());

            _mockMRItemRepo.Setup(r => r.Query()).Returns(new List<MaterialRequestItem>().AsQueryable().BuildMock());

            var command = new CreateMaterialRequestCommand(
                ProjectId: ProjectId,
                PhaseId: PhaseId,
                Reason: "Alt unit",
                Type: "normal",
                InvoiceImage: null,
                Items: new List<MaterialRequestItemInput>
                {
                    new MaterialRequestItemInput("Xi măng PCB40", 5, "Tấn")
                }
            );

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
        }

        [Fact]
        public async Task UTCID05_Handle_UserNotAuthenticated_ShouldThrowUnauthorizedException()
        {
            // Arrange
            _mockCurrentUserService.Setup(s => s.GetRequiredUserId()).Throws(new UnauthorizedAccessException("User is not authenticated."));

            var command = new CreateMaterialRequestCommand(ProjectId, PhaseId, "Reason", "normal", null, new List<MaterialRequestItemInput>());

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<UnauthorizedAccessException>().WithMessage("User is not authenticated.");
        }

        [Fact]
        public async Task UTCID06_Handle_ProjectNotFound_ShouldThrowNotFoundException()
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
        public async Task UTCID07_Handle_NotProjectLeader_ShouldThrowForbiddenException()
        {
            // Arrange
            var project = new Project { ProjectId = ProjectId, Status = ProjectStatus.InProgress };
            _mockProjectRepo.Setup(r => r.Query()).Returns(new List<Project> { project }.AsQueryable().BuildMock());

            SetupProjectLeader(isLeader: false); // Mock User is NOT Project Leader

            var command = new CreateMaterialRequestCommand(ProjectId, PhaseId, "Reason", "normal", null, new List<MaterialRequestItemInput>());

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<ForbiddenException>()
                .WithMessage("Chỉ có trưởng nhóm của dự án mới được phép lập đề xuất yêu cầu vật tư.");
        }

        [Fact]
        public async Task UTCID08_Handle_ProjectNotActive_ShouldThrowBusinessException()
        {
            // Arrange
            var project = new Project { ProjectId = ProjectId, Status = ProjectStatus.Paused };
            _mockProjectRepo.Setup(r => r.Query()).Returns(new List<Project> { project }.AsQueryable().BuildMock());
            var command = new CreateMaterialRequestCommand(ProjectId, PhaseId, "Reason", "normal", null, new List<MaterialRequestItemInput>());

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Dự án hiện không ở trạng thái hoạt động.");
        }

        [Fact]
        public async Task UTCID09_Handle_PhaseNotFound_ShouldThrowNotFoundException()
        {
            // Arrange
            var project = new Project { ProjectId = ProjectId, Status = ProjectStatus.InProgress };
            _mockProjectRepo.Setup(r => r.Query()).Returns(new List<Project> { project }.AsQueryable().BuildMock());

            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase>().AsQueryable().BuildMock());

            var command = new CreateMaterialRequestCommand(ProjectId, 999, "Reason", "normal", null, new List<MaterialRequestItemInput>());

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<NotFoundException>();
        }

        [Fact]
        public async Task UTCID10_Handle_PhaseProjectMismatch_ShouldThrowBusinessException()
        {
            // Arrange
            var project = new Project { ProjectId = ProjectId, Status = ProjectStatus.InProgress };
            _mockProjectRepo.Setup(r => r.Query()).Returns(new List<Project> { project }.AsQueryable().BuildMock());

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
        public async Task UTCID11_Handle_PhaseFrozen_ShouldThrowBusinessException()
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
                .WithMessage("Giai đoạn đã được nghiệm thu, không thể yêu cầu vật tư mới.");
        }

        [Fact]
        public async Task UTCID12_Handle_DiscreteUnitWithDecimalQuantity_ShouldThrowBusinessException()
        {
            // Arrange
            var project = new Project { ProjectId = ProjectId, Status = ProjectStatus.InProgress };
            _mockProjectRepo.Setup(r => r.Query()).Returns(new List<Project> { project }.AsQueryable().BuildMock());

            var phase = new Phase { PhaseId = PhaseId, ProjectId = ProjectId, Status = PhaseStatus.InProgress };
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase> { phase }.AsQueryable().BuildMock());

            var material = new MaterialCatalog { MaterialId = MaterialId, BaseUnitId = UnitId, Name = "Gạch" };
            _mockMaterialRepo.Setup(r => r.Query()).Returns(new List<MaterialCatalog> { material }.AsQueryable().BuildMock());

            var unit = new Unit { UnitId = UnitId, UnitName = "Bao", IsDiscrete = true };
            _mockUnitRepo.Setup(r => r.Query()).Returns(new List<Unit> { unit }.AsQueryable().BuildMock());

            var command = new CreateMaterialRequestCommand(
                ProjectId: ProjectId,
                PhaseId: PhaseId,
                Reason: "Fractional qty",
                Type: "normal",
                InvoiceImage: null,
                Items: new List<MaterialRequestItemInput>
                {
                    new MaterialRequestItemInput("Gạch", 10.5m, "Bao")
                }
            );

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Đơn vị tính 'Bao' yêu cầu số lượng phải là số nguyên.");
        }
    }
}
