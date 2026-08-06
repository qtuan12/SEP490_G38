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
    public class GetDirectPurchaseByIdQueryHandlerTests
    {
        private const long CurrentUserId = 10;
        private const long OtherUserId = 11;
        private const long ProjectId = 100;
        private const long OtherProjectId = 101;
        private const long PhaseId = 10;
        private const long DpId = 700;
        private const long AutoPOId = 300;
        private const long AutoReceiptId = 400;
        private const long CementId = 50;
        private const int UnitId = 1;

        private static readonly DateTime PurchaseDate = new(2026, 3, 10);

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IGenericRepository<DirectPurchaseRequest>> _mockDpRepo;
        private readonly Mock<IGenericRepository<Attachment>> _mockAttachmentRepo;
        private readonly Mock<IGenericRepository<PurchaseOrder>> _mockPoRepo;
        private readonly Mock<IGenericRepository<GoodsReceipt>> _mockReceiptRepo;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly Mock<IProjectAccessService> _mockProjectAccessService;
        private readonly GetDirectPurchaseByIdQueryHandler _handler;

        public GetDirectPurchaseByIdQueryHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockDpRepo = new Mock<IGenericRepository<DirectPurchaseRequest>>();
            _mockAttachmentRepo = new Mock<IGenericRepository<Attachment>>();
            _mockPoRepo = new Mock<IGenericRepository<PurchaseOrder>>();
            _mockReceiptRepo = new Mock<IGenericRepository<GoodsReceipt>>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();
            _mockProjectAccessService = new Mock<IProjectAccessService>();

            _mockUow.Setup(u => u.Repository<DirectPurchaseRequest>()).Returns(_mockDpRepo.Object);
            _mockUow.Setup(u => u.Repository<Attachment>()).Returns(_mockAttachmentRepo.Object);
            _mockUow.Setup(u => u.Repository<PurchaseOrder>()).Returns(_mockPoRepo.Object);
            _mockUow.Setup(u => u.Repository<GoodsReceipt>()).Returns(_mockReceiptRepo.Object);

            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.Accountant);
            SetupAccessibleProjects(ProjectId);
            SetupDirectPurchases(SubmittedRequest());
            SetupInvoicePhotos(InvoicePhoto("https://cdn.bpg.vn/invoices/hd-01.jpg"));
            SetupPurchaseOrders(new PurchaseOrder { POId = AutoPOId, PONumber = "PO-20260310-0001" });
            SetupGoodsReceipts(new GoodsReceipt { ReceiptId = AutoReceiptId, ReceiptNo = "GR-20260310-0001" });

            _handler = new GetDirectPurchaseByIdQueryHandler(
                _mockUow.Object, _mockCurrentUserService.Object, _mockProjectAccessService.Object);
        }

        [Fact]
        public async Task UTCID01_Handle_AccessibleSubmittedRequest_ShouldReturnDirectPurchaseDetailDto()
        {
            var result = await _handler.Handle(new GetDirectPurchaseByIdQuery(DpId), CancellationToken.None);

            result.DirectPurchaseId.Should().Be(DpId);
            result.RequestNumber.Should().Be("DP-000700");
            result.ProjectId.Should().Be(ProjectId);
            result.ProjectName.Should().Be("Nhà máy Bắc Ninh");
            result.PhaseId.Should().Be(PhaseId);
            result.PhaseName.Should().Be("Phần thô");
            result.RequestedBy.Should().Be(CurrentUserId);
            result.RequesterName.Should().Be("Lê Kỹ Sư");
            result.Reason.Should().Be("Hết xi măng giữa ca đổ sàn, phải mua gấp ngoài.");
            result.TotalAmount.Should().Be(15_000_000m);
            result.PurchaseDate.Should().Be(PurchaseDate);
            result.Status.Should().Be(DirectPurchaseStatus.WaitingApproval);
            result.AuditStatus.Should().Be(DirectPurchaseAuditStatus.Audited);
            result.BOQCheckStatus.Should().Be(BOQCheckStatus.WithinBOQ);
            result.AuditorName.Should().Be("Phạm Kế Toán");
            result.AuditNote.Should().Be("Hóa đơn hợp lệ.");
            result.AutoPONumber.Should().Be("PO-20260310-0001");
            result.AutoReceiptNo.Should().Be("GR-20260310-0001");
            result.InvoicePhotoUrls.Should().BeEquivalentTo(["https://cdn.bpg.vn/invoices/hd-01.jpg"]);

            var item = result.Items.Should().ContainSingle().Subject;
            item.MaterialId.Should().Be(CementId);
            item.MaterialCode.Should().Be("XM-01");
            item.MaterialName.Should().Be("Xi măng PCB40");
            item.UnitName.Should().Be("Bao");
            item.Quantity.Should().Be(10m);
            item.UnitPrice.Should().Be(1_500_000m);
            item.LineTotal.Should().Be(15_000_000m);
            item.IsOverBOQ.Should().BeFalse();
        }

        [Fact]
        public async Task UTCID02_Handle_DirectPurchaseNotFound_ShouldThrowNotFoundException()
        {
            SetupDirectPurchases();

            Func<Task> act = () => _handler.Handle(new GetDirectPurchaseByIdQuery(DpId), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<NotFoundException>();
            exception.Which.ErrorCode.Should().Be("BIZ_001");
        }

        [Fact]
        public async Task UTCID03_Handle_ProjectNotAccessible_ShouldThrowForbiddenException()
        {
            SetupAccessibleProjects(OtherProjectId);

            Func<Task> act = () => _handler.Handle(new GetDirectPurchaseByIdQuery(DpId), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<ForbiddenException>();
            exception.Which.ErrorCode.Should().Be("AUTH_002");
        }

        [Fact]
        public async Task UTCID04_Handle_DraftOfAnotherUser_ShouldThrowNotFoundException()
        {
            SetupDirectPurchases(SubmittedRequest(status: DirectPurchaseStatus.Draft, requestedBy: OtherUserId));

            Func<Task> act = () => _handler.Handle(new GetDirectPurchaseByIdQuery(DpId), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<NotFoundException>();
            exception.Which.ErrorCode.Should().Be("BIZ_001");
        }

        [Fact]
        public async Task UTCID05_Handle_OwnDraft_ShouldReturnDirectPurchaseDetailDto()
        {
            SetupDirectPurchases(SubmittedRequest(status: DirectPurchaseStatus.Draft));

            var result = await _handler.Handle(new GetDirectPurchaseByIdQuery(DpId), CancellationToken.None);

            result.DirectPurchaseId.Should().Be(DpId);
            result.Status.Should().Be(DirectPurchaseStatus.Draft);
        }

        [Fact]
        public async Task UTCID06_Handle_RequestWithoutGeneratedPOAndReceipt_ShouldReturnNullDocumentNumbers()
        {
            var dp = SubmittedRequest();
            dp.AutoPOId = null;
            dp.AutoReceiptId = null;
            SetupDirectPurchases(dp);
            SetupInvoicePhotos();

            var result = await _handler.Handle(new GetDirectPurchaseByIdQuery(DpId), CancellationToken.None);

            result.AutoPONumber.Should().BeNull();
            result.AutoReceiptNo.Should().BeNull();
            result.InvoicePhotoUrls.Should().BeEmpty();
        }

        private static DirectPurchaseRequest SubmittedRequest(
            string status = DirectPurchaseStatus.WaitingApproval,
            long requestedBy = CurrentUserId)
            => new()
            {
                DirectPurchaseId = DpId,
                ProjectId = ProjectId,
                PhaseId = PhaseId,
                RequestedBy = requestedBy,
                AutoPOId = AutoPOId,
                AutoReceiptId = AutoReceiptId,
                Reason = "Hết xi măng giữa ca đổ sàn, phải mua gấp ngoài.",
                Status = status,
                AuditStatus = DirectPurchaseAuditStatus.Audited,
                BOQCheckStatus = BOQCheckStatus.WithinBOQ,
                TotalAmount = 15_000_000m,
                PurchaseDate = PurchaseDate,
                AuditNote = "Hóa đơn hợp lệ.",
                AuditedBy = 12,
                AuditedAt = new DateTime(2026, 3, 11),
                Project = new Project { ProjectId = ProjectId, Name = "Nhà máy Bắc Ninh" },
                Phase = new Phase { PhaseId = PhaseId, ProjectId = ProjectId, Name = "Phần thô" },
                Requester = new User { UserId = requestedBy, FullName = "Lê Kỹ Sư" },
                Auditor = new User { UserId = 12, FullName = "Phạm Kế Toán" },
                Items =
                [
                    new DirectPurchaseItem
                    {
                        DirectPurchaseItemId = 1,
                        DirectPurchaseId = DpId,
                        MaterialId = CementId,
                        UnitId = UnitId,
                        Quantity = 10m,
                        UnitPrice = 1_500_000m,
                        LineTotal = 15_000_000m,
                        IsOverBOQ = false,
                        Material = new MaterialCatalog { MaterialId = CementId, Code = "XM-01", Name = "Xi măng PCB40" },
                        Unit = new Unit { UnitId = UnitId, UnitName = "Bao" }
                    }
                ]
            };

        private static Attachment InvoicePhoto(string url)
            => new()
            {
                EntityType = EntityType.DirectPurchaseRequest,
                EntityId = DpId,
                AttachmentType = AttachmentType.InvoicePhoto,
                FileUrl = url,
                IsDeleted = false
            };

        private void SetupDirectPurchases(params DirectPurchaseRequest[] requests)
            => _mockDpRepo.Setup(r => r.Query()).Returns(requests.AsQueryable().BuildMock());

        private void SetupInvoicePhotos(params Attachment[] attachments)
            => _mockAttachmentRepo.Setup(r => r.Query()).Returns(attachments.AsQueryable().BuildMock());

        private void SetupPurchaseOrders(params PurchaseOrder[] purchaseOrders)
            => _mockPoRepo.Setup(r => r.Query()).Returns(purchaseOrders.AsQueryable().BuildMock());

        private void SetupGoodsReceipts(params GoodsReceipt[] receipts)
            => _mockReceiptRepo.Setup(r => r.Query()).Returns(receipts.AsQueryable().BuildMock());

        private void SetupAccessibleProjects(params long[] projectIds)
            => _mockProjectAccessService
                .Setup(s => s.GetAccessibleProjectIdsAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(projectIds.ToHashSet());
    }
}
