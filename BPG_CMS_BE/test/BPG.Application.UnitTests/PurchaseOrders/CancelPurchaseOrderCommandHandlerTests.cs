using BPG.Application.Features.PurchaseOrders.Commands;
using BPG.Application.Features.PurchaseOrders.Handlers;
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
    public class CancelPurchaseOrderCommandHandlerTests
    {
        private const long CurrentUserId = 10;
        private const long ProjectId = 5;
        private const long POId = 300;

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IGenericRepository<PurchaseOrder>> _mockPoRepo;
        private readonly Mock<IGenericRepository<GoodsReceipt>> _mockReceiptRepo;
        private readonly Mock<IGenericRepository<ProjectMember>> _mockMemberRepo;
        private readonly CancelPurchaseOrderCommandHandler _handler;

        public CancelPurchaseOrderCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockPoRepo = new Mock<IGenericRepository<PurchaseOrder>>();
            _mockReceiptRepo = new Mock<IGenericRepository<GoodsReceipt>>();
            _mockMemberRepo = new Mock<IGenericRepository<ProjectMember>>();

            _mockUow.Setup(u => u.Repository<PurchaseOrder>()).Returns(_mockPoRepo.Object);
            _mockUow.Setup(u => u.Repository<GoodsReceipt>()).Returns(_mockReceiptRepo.Object);
            _mockUow.Setup(u => u.Repository<ProjectMember>()).Returns(_mockMemberRepo.Object);
            _mockUow.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

            _mockMemberRepo.Setup(r => r.Query()).Returns(Array.Empty<ProjectMember>().AsQueryable().BuildMock());

            SetupPurchaseOrders(PurchaseOrderWithStatus(PurchaseOrderStatus.Sent));
            SetupGoodsReceipts();

            var mockCurrentUserService = new Mock<ICurrentUserService>();
            mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.Accountant);

            _handler = new CancelPurchaseOrderCommandHandler(
                _mockUow.Object,
                ServiceStubFactory.RealtimeSender(),
                ServiceStubFactory.NotificationService(),
                mockCurrentUserService.Object);
        }

        [Theory]
        [InlineData(PurchaseOrderStatus.Draft)]
        [InlineData(PurchaseOrderStatus.PendingApproval)]
        [InlineData(PurchaseOrderStatus.Sent)]
        public async Task UTCID01_Handle_PONotYetReceivedWithReason_ShouldReturnTrue(string status)
        {
            SetupPurchaseOrders(PurchaseOrderWithStatus(status));

            var result = await _handler.Handle(Command(), CancellationToken.None);

            result.Should().BeTrue();
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        public async Task UTCID02_Handle_ReasonIsBlank_ShouldThrowBusinessException(string reason)
        {
            Func<Task> act = () => _handler.Handle(Command(reason: reason), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be(ErrorCodes.PoCancelReasonRequired);
        }

        [Fact]
        public async Task UTCID03_Handle_PurchaseOrderNotFound_ShouldThrowNotFoundException()
        {
            SetupPurchaseOrders();

            Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<NotFoundException>();
            exception.Which.ErrorCode.Should().Be("BIZ_001");
        }

        [Fact]
        public async Task UTCID04_Handle_POAlreadyCancelled_ShouldThrowBusinessException()
        {
            SetupPurchaseOrders(PurchaseOrderWithStatus(PurchaseOrderStatus.Cancelled));

            Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be(ErrorCodes.PoAlreadyCancelled);
        }

        [Fact]
        public async Task UTCID05_Handle_PORejectedByDirector_ShouldThrowBusinessException()
        {
            SetupPurchaseOrders(PurchaseOrderWithStatus(PurchaseOrderStatus.Rejected));

            Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be(ErrorCodes.PoCannotCancel);
        }

        [Theory]
        [InlineData(PurchaseOrderStatus.PartiallyReceived)]
        [InlineData(PurchaseOrderStatus.FullyReceived)]
        [InlineData(PurchaseOrderStatus.Closed)]
        public async Task UTCID06_Handle_POAlreadyReceivedOrClosed_ShouldThrowBusinessException(string status)
        {
            SetupPurchaseOrders(PurchaseOrderWithStatus(status));

            Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be(ErrorCodes.PoCannotCancel);
        }

        [Fact]
        public async Task UTCID07_Handle_POHasApprovedGoodsReceipt_ShouldThrowBusinessException()
        {
            SetupGoodsReceipts(new GoodsReceipt
            {
                ReceiptId = 400,
                POId = POId,
                ReceiptNo = "GR-20260311-0001",
                Status = GoodsReceiptStatus.Approved
            });

            Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be(ErrorCodes.PoHasReceipts);
        }

        [Fact]
        public async Task UTCID08_Handle_POHasOnlyDraftGoodsReceipt_ShouldReturnTrue()
        {
            SetupGoodsReceipts(new GoodsReceipt
            {
                ReceiptId = 400,
                POId = POId,
                ReceiptNo = "GR-20260311-0001",
                Status = GoodsReceiptStatus.Draft
            });

            var result = await _handler.Handle(Command(), CancellationToken.None);

            result.Should().BeTrue();
        }

        private static CancelPurchaseOrderCommand Command(
            long poId = POId,
            string reason = "Nhà cung cấp không đáp ứng được tiến độ giao hàng.")
            => new() { POId = poId, Reason = reason };

        private static PurchaseOrder PurchaseOrderWithStatus(string status)
            => new()
            {
                POId = POId,
                ProjectId = ProjectId,
                PONumber = "PO-20260310-0001",
                Status = status,
                TotalAmount = 15_000_000m
            };

        private void SetupPurchaseOrders(params PurchaseOrder[] purchaseOrders)
            => _mockPoRepo.Setup(r => r.Query()).Returns(purchaseOrders.AsQueryable().BuildMock());

        private void SetupGoodsReceipts(params GoodsReceipt[] receipts)
            => _mockReceiptRepo.Setup(r => r.Query()).Returns(receipts.AsQueryable().BuildMock());
    }
}
