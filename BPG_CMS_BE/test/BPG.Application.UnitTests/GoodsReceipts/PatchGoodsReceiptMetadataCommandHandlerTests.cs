using BPG.Application.Features.GoodsReceipts.Commands;
using BPG.Application.Features.GoodsReceipts.Handlers;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Application.UnitTests.Helpers;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using MockQueryable;
using Moq;
using RoleConstants = BPG.Domain.Constants.UserRole;

namespace BPG.Application.UnitTests.GoodsReceipts
{
    public class PatchGoodsReceiptMetadataCommandHandlerTests
    {
        private const long CurrentUserId = 10;
        private const long ProjectId = 5;
        private const long POId = 100;
        private const long ReceiptId = 500;

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly Mock<IGenericRepository<GoodsReceipt>> _mockReceiptRepo;
        private readonly Mock<IGenericRepository<Attachment>> _mockAttachmentRepo;
        private readonly Mock<IGenericRepository<ProjectMember>> _mockMemberRepo;
        private readonly PatchGoodsReceiptMetadataCommandHandler _handler;

        public PatchGoodsReceiptMetadataCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();
            _mockReceiptRepo = new Mock<IGenericRepository<GoodsReceipt>>();
            _mockAttachmentRepo = new Mock<IGenericRepository<Attachment>>();
            _mockMemberRepo = new Mock<IGenericRepository<ProjectMember>>();

            _mockUow.Setup(uow => uow.Repository<GoodsReceipt>()).Returns(_mockReceiptRepo.Object);
            _mockUow.Setup(uow => uow.Repository<Attachment>()).Returns(_mockAttachmentRepo.Object);
            _mockUow.Setup(uow => uow.Repository<ProjectMember>()).Returns(_mockMemberRepo.Object);
            _mockUow.Setup(uow => uow.BeginTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
            _mockUow.Setup(uow => uow.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
            _mockUow.Setup(uow => uow.CommitTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
            _mockUow.Setup(uow => uow.RollbackTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
            _mockAttachmentRepo.Setup(repository => repository.AddRangeAsync(It.IsAny<IEnumerable<Attachment>>(), It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);

            SetupReceipts();
            SetupAttachments();
            SetupProjectMembers();

            _handler = new PatchGoodsReceiptMetadataCommandHandler(
                _mockUow.Object,
                _mockCurrentUserService.Object);
        }

        [Fact]
        public async Task UTCID01_Handle_ValidRequest_ShouldReturnTrue()
        {
            SetupUser(RoleConstants.SiteEngineer, hasRole: false);
            SetupReceipts(Receipt());
            SetupAttachments(Attachment());
            SetupProjectMembers(new ProjectMember { ProjectId = ProjectId, UserId = CurrentUserId, IsLeader = true });

            var result = await _handler.Handle(Command(), CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Data.Should().BeTrue();
            result.Message.Should().Be("Cập nhật thông tin phiếu nhập kho thành công.");
        }

        [Fact]
        public async Task UTCID02_Handle_ReceiptNotFound_ShouldThrowNotFoundException()
        {
            SetupUser(RoleConstants.SiteEngineer, hasRole: false);
            SetupReceipts();

            var act = async () => await _handler.Handle(Command(receiptId: 999), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<NotFoundException>();
            exception.Which.ErrorCode.Should().Be("BIZ_001");
            exception.Which.Message.Should().Be("GoodsReceipt với ID [999] không tồn tại.");
        }

        [Fact]
        public async Task UTCID03_Handle_ReceiptWithoutProject_ShouldThrowBusinessException()
        {
            SetupUser(RoleConstants.SiteEngineer, hasRole: false);
            SetupReceipts(Receipt(hasProject: false));

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_PROJECT_NOT_FOUND");
            exception.Which.Message.Should().Be("Không tìm thấy dự án liên kết với phiếu nhập kho này.");
        }

        [Fact]
        public async Task UTCID04_Handle_UserIsNotProjectLeader_ShouldThrowForbiddenException()
        {
            SetupUser(RoleConstants.SiteEngineer, hasRole: false);
            SetupReceipts(Receipt());
            SetupProjectMembers(new ProjectMember { ProjectId = ProjectId, UserId = CurrentUserId, IsLeader = false });

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<ForbiddenException>();
            exception.Which.ErrorCode.Should().Be("AUTH_002");
            exception.Which.Message.Should().Be("Chỉ Trưởng dự án mới được sửa thông tin phiếu nhập kho.");
        }

        [Fact]
        public async Task UTCID06_Handle_ProjectNotInProgress_ShouldThrowBusinessException()
        {
            SetupUser(RoleConstants.Accountant);
            SetupReceipts(Receipt(projectStatus: ProjectStatus.Completed));

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_PROJECT_NOT_ACTIVE");
            exception.Which.Message.Should().Be("Dự án liên kết không còn hoạt động, không thể chỉnh sửa thông tin.");
        }

        private static PatchGoodsReceiptMetadataCommand Command(
            long receiptId = ReceiptId,
            string? delivererInfo = "New Deliverer",
            string? deliveryDocNo = "DOC-999",
            List<string>? images = null)
            => new(receiptId, delivererInfo!, deliveryDocNo!, images ?? new List<string> { "http://file.com/new_photo.jpg" });

        private static GoodsReceipt Receipt(string projectStatus = ProjectStatus.InProgress, bool hasProject = true)
            => new()
            {
                ReceiptId = ReceiptId,
                POId = POId,
                DelivererInfo = "Old Deliverer",
                DeliveryDocNo = "Old Doc",
                PurchaseOrder = new PurchaseOrder
                {
                    POId = POId,
                    Request = new MaterialRequest
                    {
                        Phase = new Phase
                        {
                            Project = hasProject
                                ? new Project { ProjectId = ProjectId, Status = projectStatus }
                                : null!
                        }
                    }
                }
            };

        private static Attachment Attachment()
            => new()
            {
                EntityType = EntityType.GoodsReceipt,
                EntityId = ReceiptId,
                FileUrl = "http://file.com/old_photo.jpg"
            };

        private void SetupUser(string role, bool hasRole = true)
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, role, hasRole);
        }

        private void SetupReceipts(params GoodsReceipt[] receipts)
        {
            _mockReceiptRepo.Setup(repository => repository.Query()).Returns(receipts.AsQueryable().BuildMock());
        }

        private void SetupAttachments(params Attachment[] attachments)
        {
            _mockAttachmentRepo.Setup(repository => repository.Query()).Returns(attachments.AsQueryable().BuildMock());
        }

        private void SetupProjectMembers(params ProjectMember[] members)
        {
            _mockMemberRepo.Setup(repository => repository.Query()).Returns(members.AsQueryable().BuildMock());
            _mockMemberRepo.Setup(repository => repository.AnyAsync(It.IsAny<System.Linq.Expressions.Expression<System.Func<ProjectMember, bool>>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync((System.Linq.Expressions.Expression<System.Func<ProjectMember, bool>> predicate, CancellationToken ct) =>
                {
                    return members.AsQueryable().Any(predicate);
                });
        }
    }
}
