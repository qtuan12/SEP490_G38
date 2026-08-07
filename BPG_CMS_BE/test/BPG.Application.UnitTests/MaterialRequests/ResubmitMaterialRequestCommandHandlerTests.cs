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
using System.Linq.Expressions;
using System.Threading;
using System.Threading.Tasks;
using RoleConstants = BPG.Domain.Constants.UserRole;
using Xunit;

namespace BPG.Application.UnitTests.MaterialRequests
{
    public class ResubmitMaterialRequestCommandHandlerTests
    {
        private const long CurrentUserId = 10;
        private const long RequestId = 100;
        private const long PhaseId = 10;
        private const long MaterialId = 50;
        private const int UnitId = 5;

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly Mock<INotificationService> _mockNotificationService;

        private readonly Mock<IGenericRepository<MaterialRequest>> _mockMRRepo;
        private readonly Mock<IGenericRepository<MaterialRequestItem>> _mockMRItemRepo;
        private readonly Mock<IGenericRepository<MaterialCatalog>> _mockMaterialRepo;
        private readonly Mock<IGenericRepository<Unit>> _mockUnitRepo;
        private readonly Mock<IGenericRepository<MaterialConversion>> _mockConversionRepo;
        private readonly Mock<IGenericRepository<BOQItem>> _mockBOQRepo;
        private readonly Mock<IGenericRepository<ProjectMember>> _mockMemberRepo;

        private readonly ResubmitMaterialRequestCommandHandler _handler;

        public ResubmitMaterialRequestCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();
            _mockNotificationService = new Mock<INotificationService>();

            _mockMRRepo = new Mock<IGenericRepository<MaterialRequest>>();
            _mockMRItemRepo = new Mock<IGenericRepository<MaterialRequestItem>>();
            _mockMaterialRepo = new Mock<IGenericRepository<MaterialCatalog>>();
            _mockUnitRepo = new Mock<IGenericRepository<Unit>>();
            _mockConversionRepo = new Mock<IGenericRepository<MaterialConversion>>();
            _mockBOQRepo = new Mock<IGenericRepository<BOQItem>>();
            _mockMemberRepo = new Mock<IGenericRepository<ProjectMember>>();

            _mockUow.Setup(u => u.Repository<MaterialRequest>()).Returns(_mockMRRepo.Object);
            _mockUow.Setup(u => u.Repository<MaterialRequestItem>()).Returns(_mockMRItemRepo.Object);
            _mockUow.Setup(u => u.Repository<MaterialCatalog>()).Returns(_mockMaterialRepo.Object);
            _mockUow.Setup(u => u.Repository<Unit>()).Returns(_mockUnitRepo.Object);
            _mockUow.Setup(u => u.Repository<MaterialConversion>()).Returns(_mockConversionRepo.Object);
            _mockUow.Setup(u => u.Repository<BOQItem>()).Returns(_mockBOQRepo.Object);
            _mockUow.Setup(u => u.Repository<ProjectMember>()).Returns(_mockMemberRepo.Object);

            SetupProjectLeader(true);

            _handler = new ResubmitMaterialRequestCommandHandler(
                _mockUow.Object,
                _mockCurrentUserService.Object,
                _mockNotificationService.Object
            );
        }

        private void SetupProjectLeader(bool isLeader)
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.SiteEngineer);
            _mockMemberRepo.Setup(r => r.AnyAsync(It.IsAny<Expression<Func<ProjectMember, bool>>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(isLeader);
        }

        [Fact]
        public async Task UTCID01_Handle_ValidRequest_ShouldResubmitSuccessfully()
        {
            // Arrange
            SetupProjectLeader(true);
            var phase = new Phase 
            { 
                PhaseId = PhaseId, 
                Status = PhaseStatus.InProgress,
                Project = new Project { Status = ProjectStatus.InProgress }
            };
            var mr = new MaterialRequest
            {
                RequestId = RequestId,
                CreatedBy = CurrentUserId,
                Status = MaterialRequestStatus.Rejected,
                Phase = phase,
                Items = new List<MaterialRequestItem>()
            };

            _mockMRRepo.Setup(r => r.Query()).Returns(new List<MaterialRequest> { mr }.AsQueryable().BuildMock());

            var material = new MaterialCatalog { MaterialId = MaterialId, BaseUnitId = UnitId, Name = "Cát" };
            _mockMaterialRepo.Setup(r => r.Query()).Returns(new List<MaterialCatalog> { material }.AsQueryable().BuildMock());

            var unit = new Unit { UnitId = UnitId, UnitName = "Khối" };
            _mockUnitRepo.Setup(r => r.Query()).Returns(new List<Unit> { unit }.AsQueryable().BuildMock());

            var boq = new BOQItem { PhaseId = PhaseId, MaterialId = MaterialId, UnitId = UnitId, Quantity = 100, ConversionRate = 1.0m };
            _mockBOQRepo.Setup(r => r.Query()).Returns(new List<BOQItem> { boq }.AsQueryable().BuildMock());

            _mockMRItemRepo.Setup(r => r.Query()).Returns(new List<MaterialRequestItem>().AsQueryable().BuildMock());

            var command = new ResubmitMaterialRequestCommand(
                RequestId: RequestId,
                Reason: "Gửi lại sau khi điều chỉnh",
                Items: new List<MaterialRequestItemInput>
                {
                    new MaterialRequestItemInput("Cát", 15, "Khối")
                }
            );

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            mr.Status.Should().Be(MaterialRequestStatus.Pending);
            mr.BOQCheckStatus.Should().Be(BOQCheckStatus.WithinBOQ);
            mr.Reason.Should().Be("Gửi lại sau khi điều chỉnh");

            _mockMRRepo.Verify(r => r.Update(mr), Times.Once);
            _mockMRItemRepo.Verify(r => r.RemoveRange(It.IsAny<IEnumerable<MaterialRequestItem>>()), Times.Once);
            _mockMRItemRepo.Verify(r => r.AddRangeAsync(It.IsAny<IEnumerable<MaterialRequestItem>>(), It.IsAny<CancellationToken>()), Times.Once);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Exactly(3));
        }

        [Fact]
        public async Task UTCID02_Handle_EmptyItems_ShouldThrowBusinessException()
        {
            // Arrange
            var command = new ResubmitMaterialRequestCommand(RequestId, "Reason", new List<MaterialRequestItemInput>());

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Phải có ít nhất 1 vật tư trong đề xuất.");
        }

        [Fact]
        public async Task UTCID03_Handle_NotOwnerUser_ShouldThrowForbiddenException()
        {
            // Arrange
            SetupProjectLeader(true);
            var mr = new MaterialRequest
            {
                RequestId = RequestId,
                CreatedBy = 999, // Different from CurrentUserId (10)
                Status = MaterialRequestStatus.Rejected,
                Phase = new Phase 
                { 
                    PhaseId = PhaseId, 
                    Status = PhaseStatus.InProgress,
                    Project = new Project { Status = ProjectStatus.InProgress }
                },
                Items = new List<MaterialRequestItem>()
            };

            _mockMRRepo.Setup(r => r.Query()).Returns(new List<MaterialRequest> { mr }.AsQueryable().BuildMock());

            var command = new ResubmitMaterialRequestCommand(
                RequestId: RequestId,
                Reason: "Sửa",
                Items: new List<MaterialRequestItemInput> { new MaterialRequestItemInput("Cát", 15, "Khối") }
            );

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<ForbiddenException>()
                .WithMessage("Bạn không có quyền gửi lại yêu cầu vật tư này.");
        }

        [Fact]
        public async Task UTCID04_Handle_RequestNotRejected_ShouldThrowBusinessException()
        {
            // Arrange
            SetupProjectLeader(true);
            var mr = new MaterialRequest
            {
                RequestId = RequestId,
                CreatedBy = CurrentUserId,
                Status = MaterialRequestStatus.Pending,
                Phase = new Phase 
                { 
                    PhaseId = PhaseId, 
                    Status = PhaseStatus.InProgress,
                    Project = new Project { Status = ProjectStatus.InProgress }
                },
                Items = new List<MaterialRequestItem>()
            };

            _mockMRRepo.Setup(r => r.Query()).Returns(new List<MaterialRequest> { mr }.AsQueryable().BuildMock());

            var command = new ResubmitMaterialRequestCommand(
                RequestId: RequestId,
                Reason: "Sửa",
                Items: new List<MaterialRequestItemInput> { new MaterialRequestItemInput("Cát", 15, "Khối") }
            );

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Chỉ có thể gửi lại yêu cầu đang ở trạng thái Từ chối (Rejected).*");
        }

        [Fact]
        public async Task UTCID05_Handle_PhaseFrozen_ShouldThrowBusinessException()
        {
            // Arrange
            SetupProjectLeader(true);
            var phase = new Phase 
            { 
                PhaseId = PhaseId, 
                Status = PhaseStatus.Approved,
                Project = new Project { Status = ProjectStatus.InProgress }
            };
            var mr = new MaterialRequest
            {
                RequestId = RequestId,
                CreatedBy = CurrentUserId,
                Status = MaterialRequestStatus.Rejected,
                Phase = phase,
                Items = new List<MaterialRequestItem>()
            };

            _mockMRRepo.Setup(r => r.Query()).Returns(new List<MaterialRequest> { mr }.AsQueryable().BuildMock());

            var command = new ResubmitMaterialRequestCommand(
                RequestId: RequestId,
                Reason: "Sửa",
                Items: new List<MaterialRequestItemInput> { new MaterialRequestItemInput("Cát", 15, "Khối") }
            );

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Giai đoạn đã được nghiệm thu và đóng băng, không thể gửi lại yêu cầu vật tư.");
        }

        [Fact]
        public async Task UTCID06_Handle_ResubmitExceedsBOQ_ShouldChangeStatusToOverBOQ()
        {
            // Arrange
            SetupProjectLeader(true);
            var phase = new Phase 
            { 
                PhaseId = PhaseId, 
                Status = PhaseStatus.InProgress,
                Project = new Project { Status = ProjectStatus.InProgress }
            };
            var mr = new MaterialRequest
            {
                RequestId = RequestId,
                CreatedBy = CurrentUserId,
                Status = MaterialRequestStatus.Rejected,
                Phase = phase,
                Items = new List<MaterialRequestItem>()
            };

            _mockMRRepo.Setup(r => r.Query()).Returns(new List<MaterialRequest> { mr }.AsQueryable().BuildMock());

            var material = new MaterialCatalog { MaterialId = MaterialId, BaseUnitId = UnitId, Name = "Cát" };
            _mockMaterialRepo.Setup(r => r.Query()).Returns(new List<MaterialCatalog> { material }.AsQueryable().BuildMock());

            var unit = new Unit { UnitId = UnitId, UnitName = "Khối" };
            _mockUnitRepo.Setup(r => r.Query()).Returns(new List<Unit> { unit }.AsQueryable().BuildMock());

            var boq = new BOQItem { PhaseId = PhaseId, MaterialId = MaterialId, UnitId = UnitId, Quantity = 100, ConversionRate = 1.0m };
            _mockBOQRepo.Setup(r => r.Query()).Returns(new List<BOQItem> { boq }.AsQueryable().BuildMock());

            _mockMRItemRepo.Setup(r => r.Query()).Returns(new List<MaterialRequestItem>().AsQueryable().BuildMock());

            var command = new ResubmitMaterialRequestCommand(
                RequestId: RequestId,
                Reason: "Gửi lại vượt hạn mức",
                Items: new List<MaterialRequestItemInput>
                {
                    new MaterialRequestItemInput("Cát", 1000, "Khối")
                }
            );

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            mr.BOQCheckStatus.Should().Be(BOQCheckStatus.OverBOQ);
        }

        [Fact]
        public async Task UTCID07_Handle_ProjectNotActive_ShouldThrowBusinessException()
        {
            // Arrange
            SetupProjectLeader(true);
            var phase = new Phase 
            { 
                PhaseId = PhaseId, 
                Status = PhaseStatus.InProgress,
                Project = new Project { Status = ProjectStatus.Paused } // project is paused
            };
            var mr = new MaterialRequest
            {
                RequestId = RequestId,
                CreatedBy = CurrentUserId,
                Status = MaterialRequestStatus.Rejected,
                Phase = phase,
                Items = new List<MaterialRequestItem>()
            };

            _mockMRRepo.Setup(r => r.Query()).Returns(new List<MaterialRequest> { mr }.AsQueryable().BuildMock());

            var command = new ResubmitMaterialRequestCommand(
                RequestId: RequestId,
                Reason: "Sửa",
                Items: new List<MaterialRequestItemInput> { new MaterialRequestItemInput("Cát", 15, "Khối") }
            );

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_PROJECT_NOT_ACTIVE");
        }
    }
}
