using BPG.Application.Features.PurchaseOrders.Handlers;
using BPG.Application.Features.PurchaseOrders.Queries;
using BPG.Application.IRepositories;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using FluentAssertions;
using MockQueryable;
using Moq;

namespace BPG.Application.UnitTests.PurchaseOrders
{
    public class GetApprovedRequestsForPOQueryHandlerTests
    {
        private const long ProjectId = 5;
        private const long OtherProjectId = 6;
        private const long PhaseId = 7;
        private const long RequestId = 20;
        private const long CementId = 50;
        private const int UnitId = 1;
        private const decimal RequestedCementQty = 100m;

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IGenericRepository<MaterialRequest>> _mockRequestRepo;
        private readonly Mock<IGenericRepository<PurchaseOrderItem>> _mockPoItemRepo;
        private readonly Mock<IGenericRepository<GoodsReceiptItem>> _mockReceiptItemRepo;
        private readonly GetApprovedRequestsForPOQueryHandler _handler;

        public GetApprovedRequestsForPOQueryHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockRequestRepo = new Mock<IGenericRepository<MaterialRequest>>();
            _mockPoItemRepo = new Mock<IGenericRepository<PurchaseOrderItem>>();
            _mockReceiptItemRepo = new Mock<IGenericRepository<GoodsReceiptItem>>();

            _mockUow.Setup(u => u.Repository<MaterialRequest>()).Returns(_mockRequestRepo.Object);
            _mockUow.Setup(u => u.Repository<PurchaseOrderItem>()).Returns(_mockPoItemRepo.Object);
            _mockUow.Setup(u => u.Repository<GoodsReceiptItem>()).Returns(_mockReceiptItemRepo.Object);

            SetupMaterialRequests(ApprovedRequest());
            SetupPOItems();
            SetupApprovedReceiptItems();

            _handler = new GetApprovedRequestsForPOQueryHandler(_mockUow.Object);
        }

        [Fact]
        public async Task UTCID01_Handle_ApprovedRequestWithoutPurchaseOrder_ShouldReturnFullRemainingQuantity()
        {
            var result = await _handler.Handle(new GetApprovedRequestsForPOQuery(ProjectId), CancellationToken.None);

            var request = result.Should().ContainSingle().Subject;
            request.RequestId.Should().Be(RequestId);
            request.Reason.Should().Be("Đổ bê tông sàn tầng 2");
            request.ProjectId.Should().Be(ProjectId);
            request.ProjectName.Should().Be("Nhà máy Bắc Ninh");
            request.PhaseId.Should().Be(PhaseId);
            request.PhaseName.Should().Be("Phần thô");
            request.HasPO.Should().BeFalse();

            var item = request.Items.Should().ContainSingle().Subject;
            item.MaterialId.Should().Be(CementId);
            item.MaterialCode.Should().Be("XM-01");
            item.MaterialName.Should().Be("Xi măng PCB40");
            item.UnitName.Should().Be("Bao");
            item.Quantity.Should().Be(RequestedCementQty);
            item.OrderedQuantity.Should().Be(0m);
            item.RemainingQuantity.Should().Be(RequestedCementQty);
            item.IsDiscreteUnit.Should().BeFalse();
            item.BaseUnitName.Should().Be("Bao");
        }

        [Fact]
        public async Task UTCID02_Handle_RequestPartiallyOrderedByActivePO_ShouldReturnRemainingQuantity()
        {
            SetupPOItems(POItem(poId: 200, PurchaseOrderStatus.Sent, quantity: 60));

            var result = await _handler.Handle(new GetApprovedRequestsForPOQuery(ProjectId), CancellationToken.None);

            var request = result.Should().ContainSingle().Subject;
            request.HasPO.Should().BeTrue();

            var item = request.Items.Should().ContainSingle().Subject;
            item.OrderedQuantity.Should().Be(60m);
            item.RemainingQuantity.Should().Be(40m);
        }

        [Fact]
        public async Task UTCID03_Handle_CancelledAndRejectedPOs_ShouldNotHoldQuantity()
        {
            SetupPOItems(
                POItem(poId: 200, PurchaseOrderStatus.Cancelled, quantity: 60),
                POItem(poId: 201, PurchaseOrderStatus.Rejected, quantity: 40));

            var result = await _handler.Handle(new GetApprovedRequestsForPOQuery(ProjectId), CancellationToken.None);

            var request = result.Should().ContainSingle().Subject;
            request.HasPO.Should().BeFalse();

            var item = request.Items.Should().ContainSingle().Subject;
            item.OrderedQuantity.Should().Be(0m);
            item.RemainingQuantity.Should().Be(RequestedCementQty);
        }

        [Fact]
        public async Task UTCID04_Handle_ClosedPO_ShouldOnlyHoldReceivedQuantity()
        {
            SetupPOItems(POItem(poId: 200, PurchaseOrderStatus.Closed, quantity: 60));
            SetupApprovedReceiptItems(ApprovedReceiptItem(poId: 200, quantity: 20));

            var result = await _handler.Handle(new GetApprovedRequestsForPOQuery(ProjectId), CancellationToken.None);

            var item = result.Should().ContainSingle().Subject.Items.Should().ContainSingle().Subject;
            item.OrderedQuantity.Should().Be(20m);
            item.RemainingQuantity.Should().Be(80m);
        }

        [Fact]
        public async Task UTCID05_Handle_OrderedQuantityExceedsRequested_ShouldClampRemainingToZero()
        {
            SetupPOItems(POItem(poId: 200, PurchaseOrderStatus.Sent, quantity: RequestedCementQty + 10));

            var result = await _handler.Handle(new GetApprovedRequestsForPOQuery(ProjectId), CancellationToken.None);

            var item = result.Should().ContainSingle().Subject.Items.Should().ContainSingle().Subject;
            item.OrderedQuantity.Should().Be(RequestedCementQty + 10);
            item.RemainingQuantity.Should().Be(0m);
        }

        [Fact]
        public async Task UTCID06_Handle_NotApprovedOrOtherProjectRequests_ShouldReturnEmptyList()
        {
            SetupMaterialRequests(
                ApprovedRequest(requestId: 21, status: MaterialRequestStatus.Pending),
                ApprovedRequest(requestId: 22, projectId: OtherProjectId));

            var result = await _handler.Handle(new GetApprovedRequestsForPOQuery(ProjectId), CancellationToken.None);

            result.Should().BeEmpty();
        }

        [Fact]
        public async Task UTCID07_Handle_DiscreteBaseUnitMaterial_ShouldFlagIsDiscreteUnit()
        {
            SetupMaterialRequests(ApprovedRequest(isDiscreteUnit: true));

            var result = await _handler.Handle(new GetApprovedRequestsForPOQuery(ProjectId), CancellationToken.None);

            result.Should().ContainSingle().Subject.Items.Should().ContainSingle()
                .Which.IsDiscreteUnit.Should().BeTrue();
        }

        private static MaterialRequest ApprovedRequest(
            long requestId = RequestId,
            long projectId = ProjectId,
            string status = MaterialRequestStatus.Approved,
            bool isDiscreteUnit = false)
            => new()
            {
                RequestId = requestId,
                PhaseId = PhaseId,
                Status = status,
                Reason = "Đổ bê tông sàn tầng 2",
                Phase = new Phase
                {
                    PhaseId = PhaseId,
                    ProjectId = projectId,
                    Name = "Phần thô",
                    Project = new Project { ProjectId = projectId, Name = "Nhà máy Bắc Ninh" }
                },
                Items =
                [
                    new MaterialRequestItem
                    {
                        RequestItemId = 1,
                        RequestId = requestId,
                        MaterialId = CementId,
                        UnitId = UnitId,
                        Quantity = RequestedCementQty,
                        ConversionRate = 1,
                        Material = new MaterialCatalog
                        {
                            MaterialId = CementId,
                            Code = "XM-01",
                            Name = "Xi măng PCB40",
                            Specification = "Bao 50kg",
                            BaseUnit = new Unit { UnitId = UnitId, UnitName = "Bao", IsDiscrete = isDiscreteUnit }
                        },
                        Unit = new Unit { UnitId = UnitId, UnitName = "Bao" }
                    }
                ]
            };

        private static PurchaseOrderItem POItem(long poId, string poStatus, decimal quantity)
            => new()
            {
                POId = poId,
                MaterialId = CementId,
                UnitId = UnitId,
                Quantity = quantity,
                PurchaseOrder = new PurchaseOrder
                {
                    POId = poId,
                    RequestId = RequestId,
                    ProjectId = ProjectId,
                    Status = poStatus
                }
            };

        private static GoodsReceiptItem ApprovedReceiptItem(long poId, decimal quantity)
            => new()
            {
                MaterialId = CementId,
                Quantity = quantity,
                Receipt = new GoodsReceipt { POId = poId, Status = GoodsReceiptStatus.Approved }
            };

        private void SetupMaterialRequests(params MaterialRequest[] requests)
            => _mockRequestRepo.Setup(r => r.Query()).Returns(requests.AsQueryable().BuildMock());

        private void SetupPOItems(params PurchaseOrderItem[] items)
            => _mockPoItemRepo.Setup(r => r.Query()).Returns(items.AsQueryable().BuildMock());

        private void SetupApprovedReceiptItems(params GoodsReceiptItem[] items)
            => _mockReceiptItemRepo.Setup(r => r.Query()).Returns(items.AsQueryable().BuildMock());
    }
}
