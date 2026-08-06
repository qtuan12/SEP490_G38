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
using RoleConstants = BPG.Domain.Constants.UserRole;

namespace BPG.Application.UnitTests.PurchaseOrders
{
    public class GetPurchaseOrdersQueryHandlerTests
    {
        private const long CurrentUserId = 10;
        private const long ProjectId = 5;
        private const long OtherProjectId = 6;
        private const long POId = 300;
        private const long OtherPOId = 301;
        private const long CementId = 50;
        private const int UnitId = 1;

        private static readonly DateTime OrderDate = new(2026, 3, 10);

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IGenericRepository<PurchaseOrder>> _mockPoRepo;
        private readonly Mock<IGenericRepository<GoodsReceiptItem>> _mockReceiptItemRepo;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly Mock<IProjectAccessService> _mockProjectAccessService;
        private readonly GetPurchaseOrdersQueryHandler _handler;

        public GetPurchaseOrdersQueryHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockPoRepo = new Mock<IGenericRepository<PurchaseOrder>>();
            _mockReceiptItemRepo = new Mock<IGenericRepository<GoodsReceiptItem>>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();
            _mockProjectAccessService = new Mock<IProjectAccessService>();

            _mockUow.Setup(u => u.Repository<PurchaseOrder>()).Returns(_mockPoRepo.Object);
            _mockUow.Setup(u => u.Repository<GoodsReceiptItem>()).Returns(_mockReceiptItemRepo.Object);

            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.Accountant);
            SetupAccessibleProjects(ProjectId);
            SetupPurchaseOrders(PurchaseOrder(POId, "PO-20260310-0001", PurchaseOrderStatus.Sent));
            SetupApprovedReceiptItems();

            _handler = new GetPurchaseOrdersQueryHandler(
                _mockUow.Object,
                _mockCurrentUserService.Object,
                _mockProjectAccessService.Object);
        }

        [Fact]
        public async Task UTCID01_Handle_ProjectScopedRequest_ShouldReturnPagedPurchaseOrders()
        {
            SetupApprovedReceiptItems(ApprovedReceiptItem(POId, quantity: 4));

            var result = await _handler.Handle(Query(projectId: ProjectId), CancellationToken.None);

            result.TotalCount.Should().Be(1);
            result.PageNumber.Should().Be(1);
            result.TotalPages.Should().Be(1);

            var po = result.Items.Should().ContainSingle().Subject;
            po.POId.Should().Be(POId);
            po.PONumber.Should().Be("PO-20260310-0001");
            po.Status.Should().Be(PurchaseOrderStatus.Sent);
            po.OrderDate.Should().Be(OrderDate);
            po.TotalAmount.Should().Be(15_000_000m);
            po.SupplierName.Should().Be("Công ty Vật liệu Minh Long");

            var item = po.Items.Should().ContainSingle().Subject;
            item.MaterialId.Should().Be(CementId);
            item.MaterialCode.Should().Be("XM-01");
            item.MaterialName.Should().Be("Xi măng PCB40");
            item.UnitName.Should().Be("Bao");
            item.Quantity.Should().Be(10m);
            item.UnitPrice.Should().Be(1_500_000m);
            item.LineTotal.Should().Be(15_000_000m);
            item.TotalReceived.Should().Be(4m);
        }

        [Fact]
        public async Task UTCID02_Handle_NoProjectIdByProjectScopedRole_ShouldThrowForbiddenException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.SiteEngineer);

            Func<Task> act = () => _handler.Handle(Query(projectId: null), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<ForbiddenException>();
            exception.Which.ErrorCode.Should().Be("AUTH_002");
        }

        [Fact]
        public async Task UTCID03_Handle_NoProjectIdByAccountant_ShouldReturnOnlyAccessibleProjectPurchaseOrders()
        {
            SetupPurchaseOrders(
                PurchaseOrder(POId, "PO-20260310-0001", PurchaseOrderStatus.Sent),
                PurchaseOrder(OtherPOId, "PO-20260310-0002", PurchaseOrderStatus.Sent, projectId: OtherProjectId));

            var result = await _handler.Handle(Query(projectId: null), CancellationToken.None);

            result.TotalCount.Should().Be(1);
            result.Items.Should().ContainSingle().Which.POId.Should().Be(POId);
        }

        [Fact]
        public async Task UTCID04_Handle_ProjectNotAccessible_ShouldThrowForbiddenException()
        {
            Func<Task> act = () => _handler.Handle(Query(projectId: OtherProjectId), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<ForbiddenException>();
            exception.Which.ErrorCode.Should().Be("AUTH_002");
        }

        [Fact]
        public async Task UTCID05_Handle_StatusFilter_ShouldReturnOnlyMatchingStatus()
        {
            SetupPurchaseOrders(
                PurchaseOrder(POId, "PO-20260310-0001", PurchaseOrderStatus.Sent),
                PurchaseOrder(OtherPOId, "PO-20260310-0002", PurchaseOrderStatus.Cancelled));

            var query = Query(projectId: ProjectId);
            query.Status = PurchaseOrderStatus.Cancelled;

            var result = await _handler.Handle(query, CancellationToken.None);

            result.Items.Should().ContainSingle().Which.POId.Should().Be(OtherPOId);
        }

        [Fact]
        public async Task UTCID06_Handle_SearchBySupplierName_ShouldReturnOnlyMatchingPurchaseOrders()
        {
            SetupPurchaseOrders(
                PurchaseOrder(POId, "PO-20260310-0001", PurchaseOrderStatus.Sent),
                PurchaseOrder(OtherPOId, "PO-20260310-0002", PurchaseOrderStatus.Sent, supplierName: "Thép Hòa Phát"));

            var query = Query(projectId: ProjectId);
            query.Search = "Hòa Phát";

            var result = await _handler.Handle(query, CancellationToken.None);

            result.Items.Should().ContainSingle().Which.POId.Should().Be(OtherPOId);
        }

        [Fact]
        public async Task UTCID07_Handle_SearchByPONumber_ShouldReturnOnlyMatchingPurchaseOrders()
        {
            SetupPurchaseOrders(
                PurchaseOrder(POId, "PO-20260310-0001", PurchaseOrderStatus.Sent),
                PurchaseOrder(OtherPOId, "PO-20260310-0002", PurchaseOrderStatus.Sent));

            var query = Query(projectId: ProjectId);
            query.Search = "0002";

            var result = await _handler.Handle(query, CancellationToken.None);

            result.Items.Should().ContainSingle().Which.POId.Should().Be(OtherPOId);
        }

        [Fact]
        public async Task UTCID08_Handle_OrderDateRangeFilter_ShouldReturnOnlyPurchaseOrdersInRange()
        {
            SetupPurchaseOrders(
                PurchaseOrder(POId, "PO-20260310-0001", PurchaseOrderStatus.Sent),
                PurchaseOrder(OtherPOId, "PO-20260401-0001", PurchaseOrderStatus.Sent, orderDate: new DateTime(2026, 4, 1)));

            var query = Query(projectId: ProjectId);
            query.OrderDateFrom = new DateOnly(2026, 3, 1);
            query.OrderDateTo = new DateOnly(2026, 3, 31);

            var result = await _handler.Handle(query, CancellationToken.None);

            result.Items.Should().ContainSingle().Which.POId.Should().Be(POId);
        }

        [Fact]
        public async Task UTCID09_Handle_SecondPage_ShouldReturnRemainingItemWithPagingMetadata()
        {
            SetupPurchaseOrders(
                PurchaseOrder(POId, "PO-20260310-0001", PurchaseOrderStatus.Sent),
                PurchaseOrder(OtherPOId, "PO-20260401-0001", PurchaseOrderStatus.Sent, orderDate: new DateTime(2026, 4, 1)));

            var query = Query(projectId: ProjectId);
            query.PageNumber = 2;
            query.PageSize = 1;

            var result = await _handler.Handle(query, CancellationToken.None);

            result.TotalCount.Should().Be(2);
            result.TotalPages.Should().Be(2);
            result.HasPreviousPage.Should().BeTrue();
            result.HasNextPage.Should().BeFalse();
            // Sắp xếp ngày đặt giảm dần nên đơn cũ hơn nằm ở trang 2.
            result.Items.Should().ContainSingle().Which.POId.Should().Be(POId);
        }

        [Fact]
        public async Task UTCID10_Handle_PurchaseOrderWithoutSupplier_ShouldReturnPlaceholderSupplierName()
        {
            SetupPurchaseOrders(PurchaseOrder(POId, "PO-20260310-0001", PurchaseOrderStatus.Sent, supplierName: null));

            var result = await _handler.Handle(Query(projectId: ProjectId), CancellationToken.None);

            result.Items.Should().ContainSingle().Which.SupplierName.Should().Be("N/A");
        }

        private static GetPurchaseOrdersQuery Query(long? projectId = ProjectId)
            => new() { ProjectId = projectId };

        private static PurchaseOrder PurchaseOrder(
            long poId,
            string poNumber,
            string status,
            long projectId = ProjectId,
            string? supplierName = "Công ty Vật liệu Minh Long",
            DateTime? orderDate = null)
            => new()
            {
                POId = poId,
                ProjectId = projectId,
                PONumber = poNumber,
                Status = status,
                OrderDate = orderDate ?? OrderDate,
                TotalAmount = 15_000_000m,
                SupplierId = supplierName == null ? null : 30,
                Supplier = supplierName == null
                    ? null
                    : new Supplier { SupplierId = 30, SupplierName = supplierName },
                Items =
                [
                    new PurchaseOrderItem
                    {
                        POItemId = poId,
                        POId = poId,
                        MaterialId = CementId,
                        UnitId = UnitId,
                        Quantity = 10m,
                        UnitPrice = 1_500_000m,
                        LineTotal = 15_000_000m,
                        ConversionRate = 1,
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

        private static GoodsReceiptItem ApprovedReceiptItem(long poId, decimal quantity)
            => new()
            {
                MaterialId = CementId,
                Quantity = quantity,
                Receipt = new GoodsReceipt { POId = poId, Status = GoodsReceiptStatus.Approved }
            };

        private void SetupPurchaseOrders(params PurchaseOrder[] purchaseOrders)
            => _mockPoRepo.Setup(r => r.Query()).Returns(purchaseOrders.AsQueryable().BuildMock());

        private void SetupApprovedReceiptItems(params GoodsReceiptItem[] items)
            => _mockReceiptItemRepo.Setup(r => r.Query()).Returns(items.AsQueryable().BuildMock());

        private void SetupAccessibleProjects(params long[] projectIds)
            => _mockProjectAccessService
                .Setup(s => s.GetAccessibleProjectIdsAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(projectIds.ToHashSet());
    }
}
