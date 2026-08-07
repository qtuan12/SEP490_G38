using BPG.Application.Features.DirectPurchases.Commands;
using BPG.Application.Features.DirectPurchases.Handlers;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Application.UnitTests.Helpers;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using MockQueryable;
using Moq;
using System.Linq.Expressions;
using RoleConstants = BPG.Domain.Constants.UserRole;

namespace BPG.Application.UnitTests.DirectPurchases
{
    public class DeleteDirectPurchaseDraftCommandHandlerTests
    {
        private const long CurrentUserId = 10;
        private const long OtherUserId = 11;
        private const long ProjectId = 100;
        private const long PhaseId = 10;
        private const long DpId = 700;

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IGenericRepository<DirectPurchaseRequest>> _mockDpRepo;
        private readonly Mock<IGenericRepository<Attachment>> _mockAttachmentRepo;
        private readonly Mock<IGenericRepository<ProjectMember>> _mockMemberRepo;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly Mock<IFileStorageService> _mockFileStorage;
        private readonly DeleteDirectPurchaseDraftCommandHandler _handler;

        public DeleteDirectPurchaseDraftCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockDpRepo = new Mock<IGenericRepository<DirectPurchaseRequest>>();
            _mockAttachmentRepo = new Mock<IGenericRepository<Attachment>>();
            _mockMemberRepo = new Mock<IGenericRepository<ProjectMember>>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();
            _mockFileStorage = new Mock<IFileStorageService>();

            _mockUow.Setup(u => u.Repository<DirectPurchaseRequest>()).Returns(_mockDpRepo.Object);
            _mockUow.Setup(u => u.Repository<Attachment>()).Returns(_mockAttachmentRepo.Object);
            _mockUow.Setup(u => u.Repository<ProjectMember>()).Returns(_mockMemberRepo.Object);
            _mockUow.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

            _mockFileStorage.Setup(s => s.DeleteFileAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);

            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.TechnicalManager);
            SetupDirectPurchases(DraftRequest());
            SetupInvoicePhotos(InvoicePhoto("https://cdn.bpg.vn/invoices/hd-01.jpg"));
            SetupProjectMembers();

            _handler = new DeleteDirectPurchaseDraftCommandHandler(
                _mockUow.Object, _mockCurrentUserService.Object, _mockFileStorage.Object);
        }

        [Fact]
        public async Task UTCID01_Handle_OwnDraft_ShouldReturnTrue()
        {
            var result = await _handler.Handle(new DeleteDirectPurchaseDraftCommand(DpId), CancellationToken.None);

            result.Should().BeTrue();
        }

        [Fact]
        public async Task UTCID02_Handle_DirectPurchaseNotFound_ShouldThrowNotFoundException()
        {
            SetupDirectPurchases();

            Func<Task> act = () => _handler.Handle(new DeleteDirectPurchaseDraftCommand(DpId), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<NotFoundException>();
            exception.Which.ErrorCode.Should().Be("BIZ_001");
        }

        [Theory]
        [InlineData(DirectPurchaseStatus.Pending)]
        [InlineData(DirectPurchaseStatus.WaitingApproval)]
        [InlineData(DirectPurchaseStatus.Approved)]
        public async Task UTCID03_Handle_RequestAlreadySubmitted_ShouldThrowBusinessException(string status)
        {
            SetupDirectPurchases(DraftRequest(status: status));

            Func<Task> act = () => _handler.Handle(new DeleteDirectPurchaseDraftCommand(DpId), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be(ErrorCodes.DpNotDraft);
        }

        [Fact]
        public async Task UTCID04_Handle_CurrentUserIsNotTheDraftOwner_ShouldThrowForbiddenException()
        {
            SetupDirectPurchases(DraftRequest(requestedBy: OtherUserId));

            Func<Task> act = () => _handler.Handle(new DeleteDirectPurchaseDraftCommand(DpId), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<ForbiddenException>();
            exception.Which.ErrorCode.Should().Be("AUTH_002");
        }

        [Fact]
        public async Task UTCID05_Handle_OwnerIsNeitherTechnicalManagerNorProjectLeader_ShouldThrowForbiddenException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.SiteEngineer);
            SetupProjectMembers(new ProjectMember { ProjectId = ProjectId, UserId = CurrentUserId, IsLeader = false });

            Func<Task> act = () => _handler.Handle(new DeleteDirectPurchaseDraftCommand(DpId), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<ForbiddenException>();
            exception.Which.ErrorCode.Should().Be("AUTH_002");
        }

        [Fact]
        public async Task UTCID06_Handle_ProjectLeaderOwnDraft_ShouldReturnTrue()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.SiteEngineer);
            SetupProjectMembers(new ProjectMember { ProjectId = ProjectId, UserId = CurrentUserId, IsLeader = true });

            var result = await _handler.Handle(new DeleteDirectPurchaseDraftCommand(DpId), CancellationToken.None);

            result.Should().BeTrue();
        }

        [Fact]
        public async Task UTCID07_Handle_StorageDeleteFails_ShouldStillReturnTrue()
        {
            // Xóa file trên storage nằm ngoài transaction và được nuốt lỗi có chủ đích:
            // bản ghi đã đánh dấu xóa, cùng lắm là còn file mồ côi.
            _mockFileStorage.Setup(s => s.DeleteFileAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(new InvalidOperationException("Cloudinary timeout"));

            var result = await _handler.Handle(new DeleteDirectPurchaseDraftCommand(DpId), CancellationToken.None);

            result.Should().BeTrue();
        }

        [Fact]
        public async Task UTCID08_Handle_DraftWithoutInvoicePhoto_ShouldReturnTrue()
        {
            SetupInvoicePhotos();

            var result = await _handler.Handle(new DeleteDirectPurchaseDraftCommand(DpId), CancellationToken.None);

            result.Should().BeTrue();
        }

        private static DirectPurchaseRequest DraftRequest(
            string status = DirectPurchaseStatus.Draft,
            long requestedBy = CurrentUserId)
            => new()
            {
                DirectPurchaseId = DpId,
                ProjectId = ProjectId,
                PhaseId = PhaseId,
                RequestedBy = requestedBy,
                Status = status,
                AuditStatus = DirectPurchaseAuditStatus.PendingAudit,
                BOQCheckStatus = BOQCheckStatus.WithinBOQ,
                Reason = "Hết xi măng giữa ca đổ sàn."
            };

        private static Attachment InvoicePhoto(string url)
            => new()
            {
                AttachmentId = 900,
                EntityType = EntityType.DirectPurchaseRequest,
                EntityId = DpId,
                AttachmentType = AttachmentType.InvoicePhoto,
                FileName = "hd-01.jpg",
                FileUrl = url,
                IsDeleted = false
            };

        private void SetupDirectPurchases(params DirectPurchaseRequest[] requests)
            => _mockDpRepo.Setup(r => r.Query()).Returns(requests.AsQueryable().BuildMock());

        private void SetupInvoicePhotos(params Attachment[] attachments)
            => _mockAttachmentRepo.Setup(r => r.Query()).Returns(attachments.AsQueryable().BuildMock());

        private void SetupProjectMembers(params ProjectMember[] members)
            => _mockMemberRepo
                .Setup(r => r.AnyAsync(It.IsAny<Expression<Func<ProjectMember, bool>>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync((Expression<Func<ProjectMember, bool>> predicate, CancellationToken _) =>
                    members.AsQueryable().Any(predicate));
    }
}
