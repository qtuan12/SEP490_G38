using BPG.Application.Common.Models;
using BPG.Application.Features.GoodsReceipts.Commands;
using BPG.Application.Features.GoodsReceipts.Handlers;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
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
using Xunit;
using BPG.Application.UnitTests.Helpers;

namespace BPG.Application.UnitTests.GoodsReceipts
{
    public class PatchGoodsReceiptMetadataCommandHandlerTests
    {
        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IGenericRepository<GoodsReceipt>> _mockGrRepo;
        private readonly Mock<IGenericRepository<Attachment>> _mockAttachmentRepo;
        private readonly Mock<IGenericRepository<ProjectMember>> _mockMemberRepo;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly PatchGoodsReceiptMetadataCommandHandler _handler;

        public PatchGoodsReceiptMetadataCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockGrRepo = new Mock<IGenericRepository<GoodsReceipt>>();
            _mockAttachmentRepo = new Mock<IGenericRepository<Attachment>>();
            _mockMemberRepo = new Mock<IGenericRepository<ProjectMember>>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();

            _mockUow.Setup(u => u.Repository<GoodsReceipt>()).Returns(_mockGrRepo.Object);
            _mockUow.Setup(u => u.Repository<Attachment>()).Returns(_mockAttachmentRepo.Object);
            _mockUow.Setup(u => u.Repository<ProjectMember>()).Returns(_mockMemberRepo.Object);

            // Default mock query
            _mockMemberRepo.Setup(r => r.Query()).Returns(new List<ProjectMember>().AsQueryable().BuildMock());

            // By default, mock current user as office role to let other tests pass seamlessly
            _mockCurrentUserService.Setup(s => s.IsInAnyRole(It.IsAny<string[]>())).Returns(true);

            _handler = new PatchGoodsReceiptMetadataCommandHandler(
                _mockUow.Object,
                _mockCurrentUserService.Object
            );
        }



        [Fact]
        public async Task UTCID01_Handle_ValidRequest_ShouldUpdateMetadataSuccessfully()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(10);

            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var po = new PurchaseOrder { POId = 100, Request = new MaterialRequest { Phase = new Phase { Project = project } } };
            var receipt = new GoodsReceipt
            {
                ReceiptId = 500,
                POId = 100,
                DelivererInfo = "Old Deliverer",
                DeliveryDocNo = "Old Doc",
                PurchaseOrder = po
            };
            _mockGrRepo.Setup(r => r.Query()).Returns(new List<GoodsReceipt> { receipt }.AsQueryable().BuildMock());

            // Mock old attachments
            var oldAtt = new Attachment { EntityType = EntityType.GoodsReceipt, EntityId = 500 };
            _mockAttachmentRepo.Setup(r => r.Query()).Returns(new List<Attachment> { oldAtt }.AsQueryable().BuildMock());

            var newImages = new List<string> { "http://file.com/new_photo.jpg" };
            var command = new PatchGoodsReceiptMetadataCommand(
                ReceiptId: 500,
                DelivererInfo: "New Deliverer",
                DeliveryDocNo: "New Doc",
                Images: newImages
            );

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.Success.Should().BeTrue();
            result.Data.Should().BeTrue();

            receipt.DelivererInfo.Should().Be("New Deliverer");
            receipt.DeliveryDocNo.Should().Be("New Doc");

            _mockUow.Verify(u => u.BeginTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
            _mockGrRepo.Verify(r => r.Update(receipt), Times.Once);
            _mockAttachmentRepo.Verify(r => r.Remove(oldAtt), Times.Once);
            _mockAttachmentRepo.Verify(r => r.AddRangeAsync(It.Is<IEnumerable<Attachment>>(l => l.First().FileUrl == "http://file.com/new_photo.jpg"), It.IsAny<CancellationToken>()), Times.Once);
            _mockUow.Verify(u => u.CommitTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID02_Handle_ReceiptNotFound_ShouldThrowNotFoundException()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(10);
            _mockGrRepo.Setup(r => r.Query()).Returns(new List<GoodsReceipt>().AsQueryable().BuildMock());

            var command = new PatchGoodsReceiptMetadataCommand(999, "John", "DOC-123");

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<NotFoundException>()
                .WithMessage("GoodsReceipt với ID [999] không tồn tại.");
        }

        [Fact]
        public async Task UTCID03_Handle_ProjectNotFound_ShouldThrowBusinessException()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(10);
            var po = new PurchaseOrder { POId = 100, Request = new MaterialRequest { Phase = new Phase { Project = null } } };
            var receipt = new GoodsReceipt { ReceiptId = 500, PurchaseOrder = po };
            _mockGrRepo.Setup(r => r.Query()).Returns(new List<GoodsReceipt> { receipt }.AsQueryable().BuildMock());

            var command = new PatchGoodsReceiptMetadataCommand(500, "John", "DOC-123");

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Không tìm thấy dự án liên kết với phiếu nhập kho này.");
        }

        [Fact]
        public async Task UTCID04_Handle_ProjectNotActive_ShouldThrowBusinessException()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(10);
            var project = new Project { ProjectId = 5, Status = ProjectStatus.Completed }; // Inactive
            var po = new PurchaseOrder { POId = 100, Request = new MaterialRequest { Phase = new Phase { Project = project } } };
            var receipt = new GoodsReceipt { ReceiptId = 500, PurchaseOrder = po };
            _mockGrRepo.Setup(r => r.Query()).Returns(new List<GoodsReceipt> { receipt }.AsQueryable().BuildMock());

            var command = new PatchGoodsReceiptMetadataCommand(500, "John", "DOC-123");

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Dự án liên kết không còn hoạt động, không thể chỉnh sửa thông tin.");
        }

        [Fact]
        public async Task UTCID05_Handle_StatusIsCancelled_ShouldStillUpdateMetadataSuccessfully()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(10);
            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var po = new PurchaseOrder { POId = 100, Request = new MaterialRequest { Phase = new Phase { Project = project } } };
            var receipt = new GoodsReceipt { ReceiptId = 500, PurchaseOrder = po, Status = GoodsReceiptStatus.Cancelled };
            _mockGrRepo.Setup(r => r.Query()).Returns(new List<GoodsReceipt> { receipt }.AsQueryable().BuildMock());
            _mockAttachmentRepo.Setup(r => r.Query()).Returns(new List<Attachment>().AsQueryable().BuildMock());

            var command = new PatchGoodsReceiptMetadataCommand(500, "John", "DOC-123");

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            receipt.DelivererInfo.Should().Be("John");
        }

        [Fact]
        public async Task UTCID06_Handle_ImagesIsNull_ShouldRemoveAllOldAttachmentsAndNotAddNew()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(10);
            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var po = new PurchaseOrder { POId = 100, Request = new MaterialRequest { Phase = new Phase { Project = project } } };
            var receipt = new GoodsReceipt { ReceiptId = 500, PurchaseOrder = po };
            _mockGrRepo.Setup(r => r.Query()).Returns(new List<GoodsReceipt> { receipt }.AsQueryable().BuildMock());

            var oldAtt = new Attachment { EntityType = EntityType.GoodsReceipt, EntityId = 500, FileUrl = "old.jpg" };
            _mockAttachmentRepo.Setup(r => r.Query()).Returns(new List<Attachment> { oldAtt }.AsQueryable().BuildMock());

            var command = new PatchGoodsReceiptMetadataCommand(500, "John", "DOC-123", Images: null);

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            _mockAttachmentRepo.Verify(r => r.Remove(oldAtt), Times.Once);
            _mockAttachmentRepo.Verify(r => r.AddRangeAsync(It.IsAny<IEnumerable<Attachment>>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task UTCID07_Handle_ImagesCountGreaterThanFive_ShouldStillUpdateMetadataSuccessfully()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(10);
            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var po = new PurchaseOrder { POId = 100, Request = new MaterialRequest { Phase = new Phase { Project = project } } };
            var receipt = new GoodsReceipt { ReceiptId = 500, PurchaseOrder = po };
            _mockGrRepo.Setup(r => r.Query()).Returns(new List<GoodsReceipt> { receipt }.AsQueryable().BuildMock());
            _mockAttachmentRepo.Setup(r => r.Query()).Returns(new List<Attachment>().AsQueryable().BuildMock());

            var sixImages = new List<string> { "1", "2", "3", "4", "5", "6" };
            var command = new PatchGoodsReceiptMetadataCommand(500, "John", "DOC-123", Images: sixImages);

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            _mockAttachmentRepo.Verify(r => r.AddRangeAsync(It.Is<IEnumerable<Attachment>>(l => l.Count() == 6), It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID08_Handle_DelivererInfoAndDocNoNullOrEmpty_ShouldUpdateSuccessfully()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(10);
            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var po = new PurchaseOrder { POId = 100, Request = new MaterialRequest { Phase = new Phase { Project = project } } };
            var receipt = new GoodsReceipt { ReceiptId = 500, PurchaseOrder = po, DelivererInfo = "Old", DeliveryDocNo = "OldDoc" };
            _mockGrRepo.Setup(r => r.Query()).Returns(new List<GoodsReceipt> { receipt }.AsQueryable().BuildMock());
            _mockAttachmentRepo.Setup(r => r.Query()).Returns(new List<Attachment>().AsQueryable().BuildMock());

            var command = new PatchGoodsReceiptMetadataCommand(500, null, "");

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            receipt.DelivererInfo.Should().BeNull();
            receipt.DeliveryDocNo.Should().Be("");
        }

        [Fact]
        public async Task UTCID09_Handle_ExceptionDuringUpdate_ShouldRollbackAndThrow()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(10);
            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var po = new PurchaseOrder { POId = 100, Request = new MaterialRequest { Phase = new Phase { Project = project } } };
            var receipt = new GoodsReceipt { ReceiptId = 500, PurchaseOrder = po };
            _mockGrRepo.Setup(r => r.Query()).Returns(new List<GoodsReceipt> { receipt }.AsQueryable().BuildMock());
            _mockAttachmentRepo.Setup(r => r.Query()).Returns(new List<Attachment>().AsQueryable().BuildMock());

            _mockUow.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ThrowsAsync(new Exception("DB Error"));

            var command = new PatchGoodsReceiptMetadataCommand(500, "John", "DOC-123");

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<Exception>().WithMessage("DB Error");
            _mockUow.Verify(u => u.RollbackTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Theory]
        [InlineData(BPG.Domain.Constants.UserRole.Accountant, false, true)] // Accountant -> succeeds
        [InlineData(BPG.Domain.Constants.UserRole.SiteEngineer, true, true)]   // Leader -> succeeds
        [InlineData(BPG.Domain.Constants.UserRole.SiteEngineer, false, false)] // Not leader -> fails
        public async Task UTCID10_Handle_PermissionCheck_ShouldBehaveBasedOnRoleAndLeadership(string role, bool isLeader, bool expectedSuccess)
        {
            // Arrange
            _mockCurrentUserService.SetupUser(10, role, hasRole: role == BPG.Domain.Constants.UserRole.Accountant);

            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var po = new PurchaseOrder { POId = 100, Request = new MaterialRequest { Phase = new Phase { Project = project } } };
            var receipt = new GoodsReceipt { ReceiptId = 500, PurchaseOrder = po };
            _mockGrRepo.Setup(r => r.Query()).Returns(new List<GoodsReceipt> { receipt }.AsQueryable().BuildMock());
            _mockAttachmentRepo.Setup(r => r.Query()).Returns(new List<Attachment>().AsQueryable().BuildMock());

            var members = isLeader
                ? new List<ProjectMember> { new ProjectMember { ProjectId = 5, UserId = 10, IsLeader = true } }
                : new List<ProjectMember>();
            _mockMemberRepo.Setup(r => r.Query()).Returns(members.AsQueryable().BuildMock());

            var command = new PatchGoodsReceiptMetadataCommand(500, "Updated", "DOC-999");

            // Act
            Func<Task<ApiResponse<bool>>> act = () => _handler.Handle(command, CancellationToken.None);

            // Assert
            if (expectedSuccess)
            {
                var result = await act();
                result.Success.Should().BeTrue();
            }
            else
            {
                await act.Should().ThrowAsync<ForbiddenException>()
                    .WithMessage("Chỉ Kế toán, Quản lý Kỹ thuật, Giám đốc hoặc Trưởng dự án mới có quyền chỉnh sửa thông tin chứng từ.");
            }
        }
    }
}
