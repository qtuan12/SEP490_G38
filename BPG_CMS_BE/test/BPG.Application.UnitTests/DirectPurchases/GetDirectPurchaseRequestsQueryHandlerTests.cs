using BPG.Application.Features.DirectPurchases.Handlers;
using BPG.Application.Features.DirectPurchases.Queries;
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

namespace BPG.Application.UnitTests.DirectPurchases
{
    public class GetDirectPurchaseRequestsQueryHandlerTests
    {
        private const long CurrentUserId = 10;
        private const long OtherUserId = 11;
        private const long ProjectId = 100;
        private const long OtherProjectId = 101;
        private const long PhaseId = 10;
        private const long DpId = 700;
        private const long OtherDpId = 701;

        private static readonly DateTime PurchaseDate = new(2026, 3, 10);

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IGenericRepository<DirectPurchaseRequest>> _mockDpRepo;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly Mock<IProjectAccessService> _mockProjectAccessService;
        private readonly GetDirectPurchaseRequestsQueryHandler _handler;

        public GetDirectPurchaseRequestsQueryHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockDpRepo = new Mock<IGenericRepository<DirectPurchaseRequest>>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();
            _mockProjectAccessService = new Mock<IProjectAccessService>();

            _mockUow.Setup(u => u.Repository<DirectPurchaseRequest>()).Returns(_mockDpRepo.Object);

            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.Accountant);
            SetupAccessibleProjects(ProjectId);
            SetupDirectPurchases(Request(DpId));

            _handler = new GetDirectPurchaseRequestsQueryHandler(
                _mockUow.Object, _mockCurrentUserService.Object, _mockProjectAccessService.Object);
        }

        [Fact]
        public async Task UTCID01_Handle_ProjectScopedRequest_ShouldReturnPagedDirectPurchaseRequests()
        {
            var result = await _handler.Handle(Query(), CancellationToken.None);

            result.TotalCount.Should().Be(1);
            result.PageNumber.Should().Be(1);
            result.TotalPages.Should().Be(1);

            var dto = result.Items.Should().ContainSingle().Subject;
            dto.DirectPurchaseId.Should().Be(DpId);
            dto.RequestNumber.Should().Be("DP-000700");
            dto.ProjectId.Should().Be(ProjectId);
            dto.ProjectName.Should().Be("Nhà máy Bắc Ninh");
            dto.PhaseName.Should().Be("Phần thô");
            dto.RequestedBy.Should().Be(CurrentUserId);
            dto.RequesterName.Should().Be("Lê Kỹ Sư");
            dto.Reason.Should().Be("Hết xi măng giữa ca đổ sàn, phải mua gấp ngoài.");
            dto.TotalAmount.Should().Be(15_000_000m);
            dto.PurchaseDate.Should().Be(PurchaseDate);
            dto.Status.Should().Be(DirectPurchaseStatus.WaitingApproval);
            dto.AuditStatus.Should().Be(DirectPurchaseAuditStatus.Audited);
            dto.BOQCheckStatus.Should().Be(BOQCheckStatus.WithinBOQ);
            dto.AuditorName.Should().Be("Phạm Kế Toán");
            dto.ItemCount.Should().Be(1);
        }

        [Fact]
        public async Task UTCID02_Handle_ProjectNotAccessible_ShouldThrowForbiddenException()
        {
            Func<Task> act = () => _handler.Handle(Query(projectId: OtherProjectId), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<ForbiddenException>();
            exception.Which.ErrorCode.Should().Be("AUTH_002");
        }

        [Fact]
        public async Task UTCID03_Handle_NoProjectId_ShouldReturnOnlyAccessibleProjectRequests()
        {
            SetupDirectPurchases(
                Request(DpId),
                Request(OtherDpId, projectId: OtherProjectId));

            var result = await _handler.Handle(Query(projectId: null), CancellationToken.None);

            result.TotalCount.Should().Be(1);
            result.Items.Should().ContainSingle().Which.DirectPurchaseId.Should().Be(DpId);
        }

        [Fact]
        public async Task UTCID04_Handle_DraftOfAnotherUser_ShouldBeExcluded()
        {
            SetupDirectPurchases(
                Request(DpId),
                Request(OtherDpId, status: DirectPurchaseStatus.Draft, requestedBy: OtherUserId));

            var result = await _handler.Handle(Query(), CancellationToken.None);

            result.Items.Should().ContainSingle().Which.DirectPurchaseId.Should().Be(DpId);
        }

        [Fact]
        public async Task UTCID05_Handle_OwnDraft_ShouldBeIncluded()
        {
            SetupDirectPurchases(Request(DpId, status: DirectPurchaseStatus.Draft));

            var result = await _handler.Handle(Query(), CancellationToken.None);

            result.Items.Should().ContainSingle().Which.Status.Should().Be(DirectPurchaseStatus.Draft);
        }

        [Fact]
        public async Task UTCID06_Handle_StatusFilter_ShouldReturnOnlyMatchingStatus()
        {
            SetupDirectPurchases(
                Request(DpId),
                Request(OtherDpId, status: DirectPurchaseStatus.Approved));

            var query = Query();
            query.Status = DirectPurchaseStatus.Approved;

            var result = await _handler.Handle(query, CancellationToken.None);

            result.Items.Should().ContainSingle().Which.DirectPurchaseId.Should().Be(OtherDpId);
        }

        [Fact]
        public async Task UTCID07_Handle_AuditStatusFilter_ShouldReturnOnlyMatchingAuditStatus()
        {
            SetupDirectPurchases(
                Request(DpId),
                Request(OtherDpId, auditStatus: DirectPurchaseAuditStatus.PendingAudit));

            var query = Query();
            query.AuditStatus = DirectPurchaseAuditStatus.PendingAudit;

            var result = await _handler.Handle(query, CancellationToken.None);

            result.Items.Should().ContainSingle().Which.DirectPurchaseId.Should().Be(OtherDpId);
        }

        [Fact]
        public async Task UTCID08_Handle_BoqCheckStatusFilter_ShouldReturnOnlyOverBoqRequests()
        {
            SetupDirectPurchases(
                Request(DpId),
                Request(OtherDpId, boqCheckStatus: BOQCheckStatus.OverBOQ));

            var query = Query();
            query.BOQCheckStatus = BOQCheckStatus.OverBOQ;

            var result = await _handler.Handle(query, CancellationToken.None);

            result.Items.Should().ContainSingle().Which.DirectPurchaseId.Should().Be(OtherDpId);
        }

        [Fact]
        public async Task UTCID09_Handle_RequestedByFilter_ShouldReturnOnlyRequestsOfThatUser()
        {
            SetupDirectPurchases(
                Request(DpId),
                Request(OtherDpId, requestedBy: OtherUserId));

            var query = Query();
            query.RequestedBy = OtherUserId;

            var result = await _handler.Handle(query, CancellationToken.None);

            result.Items.Should().ContainSingle().Which.DirectPurchaseId.Should().Be(OtherDpId);
        }

        [Fact]
        public async Task UTCID10_Handle_SearchTermMatchesReason_ShouldReturnOnlyMatchingRequests()
        {
            SetupDirectPurchases(
                Request(DpId),
                Request(OtherDpId, reason: "Mua gấp thép đai cho tổ cốt thép."));

            var query = Query();
            query.SearchTerm = "thép đai";

            var result = await _handler.Handle(query, CancellationToken.None);

            result.Items.Should().ContainSingle().Which.DirectPurchaseId.Should().Be(OtherDpId);
        }

        [Fact]
        public async Task UTCID11_Handle_SecondPage_ShouldReturnOlderRequestWithPagingMetadata()
        {
            SetupDirectPurchases(
                Request(DpId, createdAt: new DateTime(2026, 3, 1)),
                Request(OtherDpId, createdAt: new DateTime(2026, 3, 5)));

            var query = Query();
            query.PageNumber = 2;
            query.PageSize = 1;

            var result = await _handler.Handle(query, CancellationToken.None);

            result.TotalCount.Should().Be(2);
            result.TotalPages.Should().Be(2);
            result.HasPreviousPage.Should().BeTrue();
            result.HasNextPage.Should().BeFalse();
            // Sắp xếp CreatedAt giảm dần nên phiếu cũ hơn nằm ở trang 2.
            result.Items.Should().ContainSingle().Which.DirectPurchaseId.Should().Be(DpId);
        }

        private static GetDirectPurchaseRequestsQuery Query(long? projectId = ProjectId)
            => new() { ProjectId = projectId };

        private static DirectPurchaseRequest Request(
            long directPurchaseId,
            long projectId = ProjectId,
            string status = DirectPurchaseStatus.WaitingApproval,
            string auditStatus = DirectPurchaseAuditStatus.Audited,
            string boqCheckStatus = BOQCheckStatus.WithinBOQ,
            long requestedBy = CurrentUserId,
            string reason = "Hết xi măng giữa ca đổ sàn, phải mua gấp ngoài.",
            DateTime? createdAt = null)
            => new()
            {
                DirectPurchaseId = directPurchaseId,
                ProjectId = projectId,
                PhaseId = PhaseId,
                RequestedBy = requestedBy,
                Reason = reason,
                Status = status,
                AuditStatus = auditStatus,
                BOQCheckStatus = boqCheckStatus,
                TotalAmount = 15_000_000m,
                PurchaseDate = PurchaseDate,
                CreatedAt = createdAt ?? new DateTime(2026, 3, 10),
                AuditNote = "Hóa đơn hợp lệ.",
                Project = new Project { ProjectId = projectId, Name = "Nhà máy Bắc Ninh" },
                Phase = new Phase { PhaseId = PhaseId, ProjectId = projectId, Name = "Phần thô" },
                Requester = new User { UserId = requestedBy, FullName = "Lê Kỹ Sư" },
                Auditor = new User { UserId = 12, FullName = "Phạm Kế Toán" },
                Items = [new DirectPurchaseItem { DirectPurchaseId = directPurchaseId, MaterialId = 50, Quantity = 10m }]
            };

        private void SetupDirectPurchases(params DirectPurchaseRequest[] requests)
            => _mockDpRepo.Setup(r => r.Query()).Returns(requests.AsQueryable().BuildMock());

        private void SetupAccessibleProjects(params long[] projectIds)
            => _mockProjectAccessService
                .Setup(s => s.GetAccessibleProjectIdsAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(projectIds.ToHashSet());
    }
}
