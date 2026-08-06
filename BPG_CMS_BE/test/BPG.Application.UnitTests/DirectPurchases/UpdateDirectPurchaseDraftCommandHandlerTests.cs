using BPG.Application.DTOs.DirectPurchases;
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
    public class UpdateDirectPurchaseDraftCommandHandlerTests
    {
        private const long CurrentUserId = 10;
        private const long OtherUserId = 11;
        private const long ProjectId = 100;
        private const long PhaseId = 10;
        private const long DpId = 700;
        private const long CementId = 50;
        private const int UnitId = 1;

        private static readonly DateTime PurchaseDate = new(2026, 3, 10);

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IGenericRepository<DirectPurchaseRequest>> _mockDpRepo;
        private readonly Mock<IGenericRepository<DirectPurchaseItem>> _mockDpItemRepo;
        private readonly Mock<IGenericRepository<Phase>> _mockPhaseRepo;
        private readonly Mock<IGenericRepository<Project>> _mockProjectRepo;
        private readonly Mock<IGenericRepository<ProjectMember>> _mockMemberRepo;
        private readonly Mock<IGenericRepository<Attachment>> _mockAttachmentRepo;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly UpdateDirectPurchaseDraftCommandHandler _handler;

        public UpdateDirectPurchaseDraftCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockDpRepo = new Mock<IGenericRepository<DirectPurchaseRequest>>();
            _mockDpItemRepo = new Mock<IGenericRepository<DirectPurchaseItem>>();
            _mockPhaseRepo = new Mock<IGenericRepository<Phase>>();
            _mockProjectRepo = new Mock<IGenericRepository<Project>>();
            _mockMemberRepo = new Mock<IGenericRepository<ProjectMember>>();
            _mockAttachmentRepo = new Mock<IGenericRepository<Attachment>>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();

            _mockUow.Setup(u => u.Repository<DirectPurchaseRequest>()).Returns(_mockDpRepo.Object);
            _mockUow.Setup(u => u.Repository<DirectPurchaseItem>()).Returns(_mockDpItemRepo.Object);
            _mockUow.Setup(u => u.Repository<Phase>()).Returns(_mockPhaseRepo.Object);
            _mockUow.Setup(u => u.Repository<Project>()).Returns(_mockProjectRepo.Object);
            _mockUow.Setup(u => u.Repository<ProjectMember>()).Returns(_mockMemberRepo.Object);
            _mockUow.Setup(u => u.Repository<Attachment>()).Returns(_mockAttachmentRepo.Object);
            _mockUow.Setup(u => u.BeginTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
            _mockUow.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
            _mockUow.Setup(u => u.CommitTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
            _mockUow.Setup(u => u.RollbackTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

            _mockDpItemRepo.Setup(r => r.Query()).Returns(Array.Empty<DirectPurchaseItem>().AsQueryable().BuildMock());
            _mockDpItemRepo.Setup(r => r.AddRangeAsync(It.IsAny<IEnumerable<DirectPurchaseItem>>(), It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);
            _mockAttachmentRepo.Setup(r => r.Query()).Returns(Array.Empty<Attachment>().AsQueryable().BuildMock());
            _mockAttachmentRepo.Setup(r => r.AddAsync(It.IsAny<Attachment>(), It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);

            var mockFulfillment = new Mock<IDirectPurchaseFulfillmentService>();
            mockFulfillment
                .Setup(f => f.ResolveItemsAsync(It.IsAny<long>(), It.IsAny<IReadOnlyList<DirectPurchaseItemInput>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync((long _, IReadOnlyList<DirectPurchaseItemInput> items, CancellationToken __) =>
                    items.Select(i => new ResolvedDirectPurchaseItem
                    {
                        MaterialId = i.MaterialId,
                        UnitId = UnitId,
                        Quantity = i.Quantity,
                        UnitPrice = i.UnitPrice
                    }).ToList());
            mockFulfillment
                .Setup(f => f.EvaluateBoqAsync(It.IsAny<long>(), It.IsAny<long?>(), It.IsAny<List<ResolvedDirectPurchaseItem>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(false);

            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.TechnicalManager);
            SetupDirectPurchases(DraftRequest());
            SetupPhases(PhaseEntity());
            SetupProjects(ProjectEntity());
            SetupProjectMembers();

            _handler = new UpdateDirectPurchaseDraftCommandHandler(
                _mockUow.Object, _mockCurrentUserService.Object, mockFulfillment.Object);
        }

        [Fact]
        public async Task UTCID01_Handle_OwnDraftWithValidData_ShouldReturnTrue()
        {
            var result = await _handler.Handle(Command(), CancellationToken.None);

            result.Should().BeTrue();
        }

        [Fact]
        public async Task UTCID02_Handle_DirectPurchaseNotFound_ShouldThrowNotFoundException()
        {
            SetupDirectPurchases();

            Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<NotFoundException>();
            exception.Which.ErrorCode.Should().Be("BIZ_001");
        }

        [Fact]
        public async Task UTCID03_Handle_SoftDeletedDraft_ShouldThrowNotFoundException()
        {
            var dp = DraftRequest();
            dp.IsDeleted = true;
            SetupDirectPurchases(dp);

            Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<NotFoundException>();
            exception.Which.ErrorCode.Should().Be("BIZ_001");
        }

        [Theory]
        [InlineData(DirectPurchaseStatus.Pending)]
        [InlineData(DirectPurchaseStatus.WaitingApproval)]
        [InlineData(DirectPurchaseStatus.Approved)]
        [InlineData(DirectPurchaseStatus.Rejected)]
        public async Task UTCID04_Handle_RequestAlreadySubmitted_ShouldThrowBusinessException(string status)
        {
            SetupDirectPurchases(DraftRequest(status: status));

            Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be(ErrorCodes.DpNotDraft);
        }

        [Fact]
        public async Task UTCID05_Handle_CurrentUserIsNotTheDraftOwner_ShouldThrowForbiddenException()
        {
            SetupDirectPurchases(DraftRequest(requestedBy: OtherUserId));

            Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<ForbiddenException>();
            exception.Which.ErrorCode.Should().Be("AUTH_002");
        }

        [Fact]
        public async Task UTCID06_Handle_PhaseNotFound_ShouldThrowNotFoundException()
        {
            SetupPhases();

            Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<NotFoundException>();
            exception.Which.ErrorCode.Should().Be("BIZ_001");
        }

        [Fact]
        public async Task UTCID07_Handle_PhaseBelongsToAnotherProject_ShouldThrowBusinessException()
        {
            SetupPhases(new Phase { PhaseId = PhaseId, ProjectId = 999, Name = "Giai đoạn dự án khác" });

            Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be(ErrorCodes.DpPhaseProjectMismatch);
        }

        [Fact]
        public async Task UTCID08_Handle_OwnerIsNeitherTechnicalManagerNorProjectLeader_ShouldThrowForbiddenException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.SiteEngineer);
            SetupProjectMembers(new ProjectMember { ProjectId = ProjectId, UserId = CurrentUserId, IsLeader = false });

            Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<ForbiddenException>();
            exception.Which.ErrorCode.Should().Be("AUTH_002");
        }

        [Fact]
        public async Task UTCID09_Handle_ProjectNotInProgress_ShouldThrowBusinessException()
        {
            SetupProjects(ProjectEntity(ProjectStatus.Paused));

            Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be(ErrorCodes.DpProjectNotActive);
        }

        [Fact]
        public async Task UTCID10_Handle_PhaseAlreadyAccepted_ShouldThrowBusinessException()
        {
            SetupPhases(PhaseEntity(PhaseStatus.Approved));

            Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be(ErrorCodes.DpPhaseFrozen);
        }

        [Fact]
        public async Task UTCID11_Handle_DuplicateMaterialInItems_ShouldThrowBusinessException()
        {
            var command = Command(items: [Item(CementId, 5), Item(CementId, 2)]);

            Func<Task> act = () => _handler.Handle(command, CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be(ErrorCodes.DpDuplicateMaterial);
        }

        private static UpdateDirectPurchaseDraftCommand Command(
            long directPurchaseId = DpId,
            long phaseId = PhaseId,
            IEnumerable<DirectPurchaseItemInput>? items = null)
            => new()
            {
                DirectPurchaseId = directPurchaseId,
                PhaseId = phaseId,
                Reason = "Bổ sung thêm xi măng cho ca đổ sàn buổi tối.",
                PurchaseDate = PurchaseDate,
                Items = items?.ToList() ?? [Item(CementId, 10)],
                InvoicePhotoUrls = ["https://cdn.bpg.vn/invoices/hd-01.jpg"]
            };

        private static DirectPurchaseItemInput Item(long materialId, decimal quantity)
            => new() { MaterialId = materialId, UnitId = UnitId, Quantity = quantity, UnitPrice = 1_500_000m };

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
                Reason = "Hết xi măng giữa ca đổ sàn.",
                PurchaseDate = PurchaseDate
            };

        private static Phase PhaseEntity(string status = PhaseStatus.InProgress)
            => new() { PhaseId = PhaseId, ProjectId = ProjectId, Name = "Phần thô", Status = status };

        private static Project ProjectEntity(string status = ProjectStatus.InProgress)
            => new() { ProjectId = ProjectId, Name = "Nhà máy Bắc Ninh", Status = status };

        private void SetupDirectPurchases(params DirectPurchaseRequest[] requests)
            => _mockDpRepo.Setup(r => r.Query()).Returns(requests.AsQueryable().BuildMock());

        private void SetupPhases(params Phase[] phases)
            => _mockPhaseRepo.Setup(r => r.Query()).Returns(phases.AsQueryable().BuildMock());

        private void SetupProjects(params Project[] projects)
            => _mockProjectRepo.Setup(r => r.Query()).Returns(projects.AsQueryable().BuildMock());

        private void SetupProjectMembers(params ProjectMember[] members)
            => _mockMemberRepo
                .Setup(r => r.AnyAsync(It.IsAny<Expression<Func<ProjectMember, bool>>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync((Expression<Func<ProjectMember, bool>> predicate, CancellationToken _) =>
                    members.AsQueryable().Any(predicate));
    }
}
