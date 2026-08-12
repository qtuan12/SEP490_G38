using BPG.Application.Features.PurchaseOrders.Handlers;
using BPG.Application.Features.PurchaseOrders.Queries;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Application.UnitTests.Helpers;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using MockQueryable;
using Moq;

namespace BPG.Application.UnitTests.PurchaseOrders
{
    public class GetPurchaseOrderByIdQueryHandlerTests
    {
        private const long ProjectId = 5;
        private const long OtherProjectId = 6;
        private const long PhaseId = 7;
        private const long RequestId = 20;
        private const long POId = 300;
        private const long CementId = 50;
        private const int UnitId = 1;

        private static readonly DateOnly OrderDate = new(2026, 3, 10);
        // Entity PurchaseOrder.OrderDate vẫn là DateTime, chỉ Command/DTO dùng DateOnly.
        private static readonly DateTime OrderDateTime = OrderDate.ToDateTime(TimeOnly.MinValue);

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IGenericRepository<PurchaseOrder>> _mockPoRepo;
        private readonly Mock<IGenericRepository<GoodsReceiptItem>> _mockReceiptItemRepo;
        private readonly Mock<IGenericRepository<Supplier>> _mockSupplierRepo;
        private readonly Mock<IProjectAccessService> _mockProjectAccessService;
        private readonly GetPurchaseOrderByIdQueryHandler _handler;

        public GetPurchaseOrderByIdQueryHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockPoRepo = new Mock<IGenericRepository<PurchaseOrder>>();
            _mockReceiptItemRepo = new Mock<IGenericRepository<GoodsReceiptItem>>();
            _mockSupplierRepo = new Mock<IGenericRepository<Supplier>>();
            _mockProjectAccessService = new Mock<IProjectAccessService>();

            _mockUow.Setup(u => u.Repository<PurchaseOrder>()).Returns(_mockPoRepo.Object);
            _mockUow.Setup(u => u.Repository<GoodsReceiptItem>()).Returns(_mockReceiptItemRepo.Object);
            _mockUow.Setup(u => u.Repository<Supplier>()).Returns(_mockSupplierRepo.Object);

            SetupAccessibleProjects(ProjectId);
            SetupPurchaseOrders(FullPurchaseOrder());
            SetupApprovedReceiptItems();

            _handler = new GetPurchaseOrderByIdQueryHandler(
                _mockUow.Object,
                ServiceStubFactory.CurrentUserService(),
                _mockProjectAccessService.Object);
        }

        [Fact]
        public async Task UTCID01_Handle_AccessiblePurchaseOrder_ShouldReturnPurchaseOrderDetailDto()
        {
            SetupApprovedReceiptItems(ApprovedReceiptItem(quantity: 4));

            var result = await _handler.Handle(new GetPurchaseOrderByIdQuery(POId), CancellationToken.None);

            result.POId.Should().Be(POId);
            result.PONumber.Should().Be("PO-20260310-0001");
            result.Status.Should().Be(PurchaseOrderStatus.Sent);
            result.OrderDate.Should().Be(OrderDate);
            result.ExpectedDeliveryDate.Should().Be(new DateOnly(2026, 3, 20));
            result.DeliveryAddress.Should().Be("Công trường Long Biên");
            result.TotalAmount.Should().Be(15_000_000m);
            result.ApproverName.Should().Be("Trần Giám Đốc");
            result.ApprovalNote.Should().Be("Đồng ý theo báo giá.");
            result.SupplierId.Should().Be(30);
            result.SupplierName.Should().Be("Công ty Vật liệu Minh Long");
            result.SupplierContactInfo.Should().Be("0901234567");
            result.ProjectId.Should().Be(ProjectId);
            result.ProjectName.Should().Be("Nhà máy Bắc Ninh");

            var item = result.Items.Should().ContainSingle().Subject;
            item.MaterialId.Should().Be(CementId);
            item.MaterialCode.Should().Be("XM-01");
            item.MaterialName.Should().Be("Xi măng PCB40");
            item.Specification.Should().Be("Bao 50kg");
            item.UnitName.Should().Be("Bao");
            item.Quantity.Should().Be(10m);
            item.UnitPrice.Should().Be(1_500_000m);
            item.LineTotal.Should().Be(15_000_000m);
            item.TotalReceived.Should().Be(4m);

            var linkedRequest = result.LinkedRequests.Should().ContainSingle().Subject;
            linkedRequest.RequestId.Should().Be(RequestId);
            linkedRequest.Reason.Should().Be("Đổ bê tông sàn tầng 2");
            linkedRequest.ProjectId.Should().Be(ProjectId);
            linkedRequest.PhaseId.Should().Be(PhaseId);
            linkedRequest.PhaseName.Should().Be("Phần thô");
        }

        [Fact]
        public async Task UTCID02_Handle_PurchaseOrderNotFound_ShouldThrowNotFoundException()
        {
            SetupPurchaseOrders();

            Func<Task> act = () => _handler.Handle(new GetPurchaseOrderByIdQuery(POId), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<NotFoundException>();
            exception.Which.ErrorCode.Should().Be("BIZ_001");
        }

        [Fact]
        public async Task UTCID03_Handle_ProjectNotAccessible_ShouldThrowForbiddenException()
        {
            SetupAccessibleProjects(OtherProjectId);

            Func<Task> act = () => _handler.Handle(new GetPurchaseOrderByIdQuery(POId), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<ForbiddenException>();
            exception.Which.ErrorCode.Should().Be("AUTH_002");
        }

        [Fact]
        public async Task UTCID04_Handle_PurchaseOrderWithoutSupplierAndRequest_ShouldReturnEmptySupplierAndLinkedRequests()
        {
            var po = FullPurchaseOrder();
            po.SupplierId = null;
            po.Supplier = null;
            po.RequestId = null;
            po.Request = null;
            SetupPurchaseOrders(po);

            var result = await _handler.Handle(new GetPurchaseOrderByIdQuery(POId), CancellationToken.None);

            result.SupplierId.Should().BeNull();
            result.SupplierName.Should().BeEmpty();
            result.SupplierContactInfo.Should().BeNull();
            result.LinkedRequests.Should().BeEmpty();
        }

        [Fact]
        public async Task UTCID05_Handle_NoApprovedGoodsReceipt_ShouldReturnZeroTotalReceived()
        {
            var result = await _handler.Handle(new GetPurchaseOrderByIdQuery(POId), CancellationToken.None);

            result.Items.Should().ContainSingle().Which.TotalReceived.Should().Be(0m);
        }

        private static PurchaseOrder FullPurchaseOrder()
            => new()
            {
                POId = POId,
                ProjectId = ProjectId,
                RequestId = RequestId,
                SupplierId = 30,
                PONumber = "PO-20260310-0001",
                Status = PurchaseOrderStatus.Sent,
                OrderDate = OrderDateTime,
                ExpectedDeliveryDate = new DateOnly(2026, 3, 20),
                DeliveryAddress = "Công trường Long Biên",
                Notes = "Giao trong giờ hành chính",
                TotalAmount = 15_000_000m,
                ApprovedBy = 10,
                ApprovedAt = new DateTime(2026, 3, 11),
                ApprovalNote = "Đồng ý theo báo giá.",
                Approver = new User { UserId = 10, FullName = "Trần Giám Đốc" },
                Supplier = new Supplier
                {
                    SupplierId = 30,
                    SupplierName = "Công ty Vật liệu Minh Long",
                    ContactInfo = "0901234567"
                },
                Project = new Project { ProjectId = ProjectId, Name = "Nhà máy Bắc Ninh" },
                Request = new MaterialRequest
                {
                    RequestId = RequestId,
                    PhaseId = PhaseId,
                    Reason = "Đổ bê tông sàn tầng 2",
                    Phase = new Phase { PhaseId = PhaseId, ProjectId = ProjectId, Name = "Phần thô" }
                },
                Items =
                [
                    new PurchaseOrderItem
                    {
                        POItemId = 900,
                        POId = POId,
                        MaterialId = CementId,
                        UnitId = UnitId,
                        Quantity = 10m,
                        UnitPrice = 1_500_000m,
                        LineTotal = 15_000_000m,
                        ConversionRate = 1,
                        Notes = "Giao đợt 1",
                        Material = new MaterialCatalog
                        {
                            MaterialId = CementId,
                            Code = "XM-01",
                            Name = "Xi măng PCB40",
                            Specification = "Bao 50kg"
                        },
                        Unit = new Unit { UnitId = UnitId, UnitName = "Bao" }
                    }
                ]
            };

        private static GoodsReceiptItem ApprovedReceiptItem(decimal quantity)
            => new()
            {
                MaterialId = CementId,
                Quantity = quantity,
                Receipt = new GoodsReceipt { POId = POId, Status = GoodsReceiptStatus.Approved }
            };

        private void SetupPurchaseOrders(params PurchaseOrder[] purchaseOrders)
        {
            _mockPoRepo.Setup(r => r.Query()).Returns(purchaseOrders.AsQueryable().BuildMock());
            var suppliers = purchaseOrders
                .Where(po => po.Supplier != null)
                .Select(po => po.Supplier!)
                .ToList();
            _mockSupplierRepo.Setup(r => r.Query()).Returns(suppliers.AsQueryable().BuildMock());
        }

        private void SetupApprovedReceiptItems(params GoodsReceiptItem[] items)
            => _mockReceiptItemRepo.Setup(r => r.Query()).Returns(items.AsQueryable().BuildMock());

        private void SetupAccessibleProjects(params long[] projectIds)
            => _mockProjectAccessService
                .Setup(s => s.GetAccessibleProjectIdsAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(projectIds.ToHashSet());
    }
}
