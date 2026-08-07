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
    public class ClosePurchaseOrderCommandHandlerTests
    {
        private const long CurrentUserId = 10;
        private const long ProjectId = 5;
        private const long POId = 300;

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IGenericRepository<PurchaseOrder>> _mockPoRepo;
        private readonly Mock<IGenericRepository<ProjectMember>> _mockMemberRepo;
        private readonly ClosePurchaseOrderCommandHandler _handler;

        public ClosePurchaseOrderCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockPoRepo = new Mock<IGenericRepository<PurchaseOrder>>();
            _mockMemberRepo = new Mock<IGenericRepository<ProjectMember>>();

            _mockUow.Setup(u => u.Repository<PurchaseOrder>()).Returns(_mockPoRepo.Object);
            _mockUow.Setup(u => u.Repository<ProjectMember>()).Returns(_mockMemberRepo.Object);
            _mockUow.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

            _mockMemberRepo.Setup(r => r.Query()).Returns(Array.Empty<ProjectMember>().AsQueryable().BuildMock());

            SetupPurchaseOrders(PurchaseOrderWithStatus(PurchaseOrderStatus.PartiallyReceived));

            var mockCurrentUserService = new Mock<ICurrentUserService>();
            mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.Accountant);

            _handler = new ClosePurchaseOrderCommandHandler(
                _mockUow.Object,
                ServiceStubFactory.RealtimeSender(),
                ServiceStubFactory.NotificationService(),
                mockCurrentUserService.Object);
        }

        [Fact]
        public async Task UTCID01_Handle_PartiallyReceivedPOWithReason_ShouldReturnTrue()
        {
            var result = await _handler.Handle(Command(), CancellationToken.None);

            result.Should().BeTrue();
        }

        [Fact]
        public async Task UTCID02_Handle_PurchaseOrderNotFound_ShouldThrowNotFoundException()
        {
            SetupPurchaseOrders();

            Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<NotFoundException>();
            exception.Which.ErrorCode.Should().Be("BIZ_001");
        }

        [Theory]
        [InlineData(PurchaseOrderStatus.Sent)]
        [InlineData(PurchaseOrderStatus.FullyReceived)]
        [InlineData(PurchaseOrderStatus.Closed)]
        [InlineData(PurchaseOrderStatus.Cancelled)]
        public async Task UTCID03_Handle_PONotPartiallyReceived_ShouldThrowBusinessException(string status)
        {
            SetupPurchaseOrders(PurchaseOrderWithStatus(status));

            Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be(ErrorCodes.PoCannotClose);
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        public async Task UTCID04_Handle_ReasonIsBlank_ShouldThrowBusinessException(string reason)
        {
            Func<Task> act = () => _handler.Handle(Command(reason: reason), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be(ErrorCodes.PoCloseReasonRequired);
        }

        private static ClosePurchaseOrderCommand Command(
            long poId = POId,
            string reason = "Nhà cung cấp hết hàng, phần còn lại mua từ đơn khác.")
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
    }
}
