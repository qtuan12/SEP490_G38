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
    public class ApprovePurchaseOrderCommandHandlerTests
    {
        private const long CurrentUserId = 10;
        private const long ProjectId = 5;
        private const long POId = 300;

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IGenericRepository<PurchaseOrder>> _mockPoRepo;
        private readonly Mock<IGenericRepository<User>> _mockUserRepo;
        private readonly Mock<IGenericRepository<ProjectMember>> _mockMemberRepo;
        private readonly ApprovePurchaseOrderCommandHandler _handler;

        public ApprovePurchaseOrderCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockPoRepo = new Mock<IGenericRepository<PurchaseOrder>>();
            _mockUserRepo = new Mock<IGenericRepository<User>>();
            _mockMemberRepo = new Mock<IGenericRepository<ProjectMember>>();

            _mockUow.Setup(u => u.Repository<PurchaseOrder>()).Returns(_mockPoRepo.Object);
            _mockUow.Setup(u => u.Repository<User>()).Returns(_mockUserRepo.Object);
            _mockUow.Setup(u => u.Repository<ProjectMember>()).Returns(_mockMemberRepo.Object);
            _mockUow.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

            _mockUserRepo.Setup(r => r.GetByIdAsync(CurrentUserId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new User { UserId = CurrentUserId, FullName = "Trần Giám Đốc" });
            _mockMemberRepo.Setup(r => r.Query()).Returns(Array.Empty<ProjectMember>().AsQueryable().BuildMock());

            SetupPurchaseOrders(PurchaseOrderWithStatus(PurchaseOrderStatus.PendingApproval));

            var mockCurrentUserService = new Mock<ICurrentUserService>();
            mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.Director);

            _handler = new ApprovePurchaseOrderCommandHandler(
                _mockUow.Object,
                ServiceStubFactory.RealtimeSender(),
                ServiceStubFactory.NotificationService(),
                mockCurrentUserService.Object);
        }

        [Fact]
        public async Task UTCID01_Handle_PendingApprovalPO_ShouldReturnTrue()
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
        [InlineData(PurchaseOrderStatus.Draft)]
        [InlineData(PurchaseOrderStatus.Sent)]
        [InlineData(PurchaseOrderStatus.Rejected)]
        [InlineData(PurchaseOrderStatus.Cancelled)]
        public async Task UTCID03_Handle_PONotWaitingForDirector_ShouldThrowBusinessException(string status)
        {
            SetupPurchaseOrders(PurchaseOrderWithStatus(status));

            Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be(ErrorCodes.PoNotPendingApproval);
        }

        [Fact]
        public async Task UTCID04_Handle_NoteIsNull_ShouldReturnTrue()
        {
            var result = await _handler.Handle(Command(note: null), CancellationToken.None);

            result.Should().BeTrue();
        }

        private static ApprovePurchaseOrderCommand Command(long poId = POId, string? note = "Đồng ý mua theo báo giá đã duyệt.")
            => new() { POId = poId, Note = note };

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
