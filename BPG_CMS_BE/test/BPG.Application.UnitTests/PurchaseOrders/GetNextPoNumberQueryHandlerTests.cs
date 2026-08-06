using BPG.Application.Features.PurchaseOrders.Handlers;
using BPG.Application.Features.PurchaseOrders.Queries;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using FluentAssertions;
using MockQueryable;
using Moq;

namespace BPG.Application.UnitTests.PurchaseOrders
{
    public class GetNextPoNumberQueryHandlerTests
    {
        private static readonly DateTime OrderDate = new(2026, 3, 10);

        private readonly Mock<IGenericRepository<PurchaseOrder>> _mockPoRepo;
        private readonly GetNextPoNumberQueryHandler _handler;

        public GetNextPoNumberQueryHandlerTests()
        {
            var mockUow = new Mock<IUnitOfWork>();
            _mockPoRepo = new Mock<IGenericRepository<PurchaseOrder>>();
            mockUow.Setup(u => u.Repository<PurchaseOrder>()).Returns(_mockPoRepo.Object);

            SetupPurchaseOrders();

            _handler = new GetNextPoNumberQueryHandler(mockUow.Object);
        }

        [Fact]
        public async Task UTCID01_Handle_NoPurchaseOrderOnOrderDate_ShouldReturnFirstSequence()
        {
            var result = await _handler.Handle(new GetNextPoNumberQuery(OrderDate), CancellationToken.None);

            result.Should().Be("PO-20260310-0001");
        }

        [Fact]
        public async Task UTCID02_Handle_ExistingPurchaseOrdersOnOrderDate_ShouldReturnMaxSequencePlusOne()
        {
            SetupPurchaseOrders(
                PurchaseOrder("PO-20260310-0001"),
                PurchaseOrder("PO-20260310-0003"),
                PurchaseOrder("PO-20260310-0002"));

            var result = await _handler.Handle(new GetNextPoNumberQuery(OrderDate), CancellationToken.None);

            result.Should().Be("PO-20260310-0004");
        }

        [Fact]
        public async Task UTCID03_Handle_PurchaseOrdersOnOtherDatesOnly_ShouldReturnFirstSequence()
        {
            SetupPurchaseOrders(
                PurchaseOrder("PO-20260309-0007"),
                PurchaseOrder("PO-20260311-0002"));

            var result = await _handler.Handle(new GetNextPoNumberQuery(OrderDate), CancellationToken.None);

            result.Should().Be("PO-20260310-0001");
        }

        [Fact]
        public async Task UTCID04_Handle_ManualPoNumberWithNonNumericSuffix_ShouldReturnFirstSequence()
        {
            SetupPurchaseOrders(PurchaseOrder("PO-20260310-ABC"));

            var result = await _handler.Handle(new GetNextPoNumberQuery(OrderDate), CancellationToken.None);

            result.Should().Be("PO-20260310-0001");
        }

        [Fact]
        public async Task UTCID05_Handle_SequenceReachesFourDigitBoundary_ShouldKeepIncrementing()
        {
            SetupPurchaseOrders(PurchaseOrder("PO-20260310-9999"));

            var result = await _handler.Handle(new GetNextPoNumberQuery(OrderDate), CancellationToken.None);

            result.Should().Be("PO-20260310-10000");
        }

        private static PurchaseOrder PurchaseOrder(string poNumber)
            => new() { PONumber = poNumber };

        private void SetupPurchaseOrders(params PurchaseOrder[] purchaseOrders)
            => _mockPoRepo.Setup(r => r.Query()).Returns(purchaseOrders.AsQueryable().BuildMock());
    }
}
