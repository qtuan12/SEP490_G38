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
        private const long CurrentUserId = 10;
        private const long ProjectId = 5;
        private const long POId = 100;
        private const long ReceiptId = 500;

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
            _mockCurrentUserService.SetupUser(CurrentUserId);

            var project = Project();
            var po = PurchaseOrder(project);
            var receipt = new GoodsReceipt
            {
                ReceiptId = ReceiptId,
                POId = POId,
                DelivererInfo = "Old Deliverer",
                DeliveryDocNo = "Old Doc",
                PurchaseOrder = po
            };
            _mockGrRepo.Setup(r => r.Query()).Returns(new List<GoodsReceipt> { receipt }.AsQueryable().BuildMock());

            // Mock old attachments
            var oldAtt = GoodsReceiptAttachment();
            _mockAttachmentRepo.Setup(r => r.Query()).Returns(new List<Attachment> { oldAtt }.AsQueryable().BuildMock());

            var newImages = new List<string> { "http://file.com/new_photo.jpg" };
            var command = Command("New Deliverer", "New Doc", newImages);

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.Success.Should().BeTrue();
            result.Data.Should().BeTrue();


        }

        [Fact]
        public async Task UTCID02_Handle_ReceiptNotFound_ShouldThrowNotFoundException()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(CurrentUserId);
            _mockGrRepo.Setup(r => r.Query()).Returns(new List<GoodsReceipt>().AsQueryable().BuildMock());

            var command = Command(logId: 999);

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<NotFoundException>();
        }

        [Fact]
        public async Task UTCID03_Handle_ProjectNotFound_ShouldThrowBusinessException()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(CurrentUserId);
            var po = PurchaseOrder(project: null);
            var receipt = new GoodsReceipt { ReceiptId = ReceiptId, PurchaseOrder = po };
            _mockGrRepo.Setup(r => r.Query()).Returns(new List<GoodsReceipt> { receipt }.AsQueryable().BuildMock());

            var command = Command();

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>();
        }

        [Fact]
        public async Task UTCID04_Handle_ProjectNotActive_ShouldThrowBusinessException()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(CurrentUserId);
            var project = Project(ProjectStatus.Completed);
            var po = PurchaseOrder(project);
            var receipt = new GoodsReceipt { ReceiptId = ReceiptId, PurchaseOrder = po };
            _mockGrRepo.Setup(r => r.Query()).Returns(new List<GoodsReceipt> { receipt }.AsQueryable().BuildMock());

            var command = Command();

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>();
        }

        [Fact]
        public async Task UTCID05_Handle_StatusIsCancelled_ShouldStillUpdateMetadataSuccessfully()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(CurrentUserId);
            var project = Project();
            var po = PurchaseOrder(project);
            var receipt = new GoodsReceipt { ReceiptId = ReceiptId, PurchaseOrder = po, Status = GoodsReceiptStatus.Cancelled };
            _mockGrRepo.Setup(r => r.Query()).Returns(new List<GoodsReceipt> { receipt }.AsQueryable().BuildMock());
            _mockAttachmentRepo.Setup(r => r.Query()).Returns(new List<Attachment>().AsQueryable().BuildMock());

            var command = Command();

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
        }

        [Fact]
        public async Task UTCID06_Handle_ImagesIsNull_ShouldReturnSuccess()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(CurrentUserId);
            var project = Project();
            var po = PurchaseOrder(project);
            var receipt = new GoodsReceipt { ReceiptId = ReceiptId, PurchaseOrder = po };
            _mockGrRepo.Setup(r => r.Query()).Returns(new List<GoodsReceipt> { receipt }.AsQueryable().BuildMock());

            var oldAtt = GoodsReceiptAttachment("old.jpg");
            _mockAttachmentRepo.Setup(r => r.Query()).Returns(new List<Attachment> { oldAtt }.AsQueryable().BuildMock());

            var command = Command(images: null);

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
        }

        [Fact]
        public async Task UTCID07_Handle_ImagesCountGreaterThanFive_ShouldStillUpdateMetadataSuccessfully()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(CurrentUserId);
            var project = Project();
            var po = PurchaseOrder(project);
            var receipt = new GoodsReceipt { ReceiptId = ReceiptId, PurchaseOrder = po };
            _mockGrRepo.Setup(r => r.Query()).Returns(new List<GoodsReceipt> { receipt }.AsQueryable().BuildMock());
            _mockAttachmentRepo.Setup(r => r.Query()).Returns(new List<Attachment>().AsQueryable().BuildMock());

            var sixImages = new List<string> { "1", "2", "3", "4", "5", "6" };
            var command = Command(images: sixImages);

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
        }

        [Fact]
        public async Task UTCID08_Handle_DelivererInfoAndDocNoNullOrEmpty_ShouldUpdateSuccessfully()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(CurrentUserId);
            var project = Project();
            var po = PurchaseOrder(project);
            var receipt = new GoodsReceipt { ReceiptId = ReceiptId, PurchaseOrder = po, DelivererInfo = "Old", DeliveryDocNo = "OldDoc" };
            _mockGrRepo.Setup(r => r.Query()).Returns(new List<GoodsReceipt> { receipt }.AsQueryable().BuildMock());
            _mockAttachmentRepo.Setup(r => r.Query()).Returns(new List<Attachment>().AsQueryable().BuildMock());

            var command = Command(delivererInfo: null, deliveryDocNo: "");

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
        }

        [Fact]
        public async Task UTCID09_Handle_ExceptionDuringUpdate_ShouldThrowException()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(CurrentUserId);
            var project = Project();
            var po = PurchaseOrder(project);
            var receipt = new GoodsReceipt { ReceiptId = ReceiptId, PurchaseOrder = po };
            _mockGrRepo.Setup(r => r.Query()).Returns(new List<GoodsReceipt> { receipt }.AsQueryable().BuildMock());
            _mockAttachmentRepo.Setup(r => r.Query()).Returns(new List<Attachment>().AsQueryable().BuildMock());

            _mockUow.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ThrowsAsync(new Exception("DB Error"));

            var command = Command();

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<Exception>();
        }

        [Theory]
        [InlineData(BPG.Domain.Constants.UserRole.Accountant, false, true)] // Accountant -> succeeds
        [InlineData(BPG.Domain.Constants.UserRole.SiteEngineer, true, true)]   // Leader -> succeeds
        [InlineData(BPG.Domain.Constants.UserRole.SiteEngineer, false, false)] // Not leader -> fails
        public async Task UTCID10_Handle_PermissionCheck_ShouldBehaveBasedOnRoleAndLeadership(string role, bool isLeader, bool expectedSuccess)
        {
            // Arrange
            _mockCurrentUserService.SetupUser(CurrentUserId, role, hasRole: role == BPG.Domain.Constants.UserRole.Accountant);

            var project = Project();
            var po = PurchaseOrder(project);
            var receipt = new GoodsReceipt { ReceiptId = ReceiptId, PurchaseOrder = po };
            _mockGrRepo.Setup(r => r.Query()).Returns(new List<GoodsReceipt> { receipt }.AsQueryable().BuildMock());
            _mockAttachmentRepo.Setup(r => r.Query()).Returns(new List<Attachment>().AsQueryable().BuildMock());

            var members = isLeader
                ? new List<ProjectMember> { new ProjectMember { ProjectId = ProjectId, UserId = CurrentUserId, IsLeader = true } }
                : new List<ProjectMember>();
            _mockMemberRepo.Setup(r => r.Query()).Returns(members.AsQueryable().BuildMock());

            var command = Command("Updated", "DOC-999");

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
                await act.Should().ThrowAsync<ForbiddenException>();
            }
        }

        private static Project Project(string status = ProjectStatus.InProgress)
            => new() { ProjectId = ProjectId, Status = status };

        private static PurchaseOrder PurchaseOrder(Project? project)
            => new()
            {
                POId = POId,
                Request = new MaterialRequest { Phase = new Phase { Project = project! } }
            };

        private static Attachment GoodsReceiptAttachment(string fileUrl = "old.jpg")
            => new()
            {
                EntityType = EntityType.GoodsReceipt,
                EntityId = ReceiptId,
                FileUrl = fileUrl
            };

        private static PatchGoodsReceiptMetadataCommand Command(
            string? delivererInfo = "John",
            string? deliveryDocNo = "DOC-123",
            List<string>? images = null,
            long logId = ReceiptId)
            => new(logId, delivererInfo!, deliveryDocNo!, Images: images!);
    }
}

