using BPG.Application.Features.InventoryAdjustments.Commands;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Application.UnitTests.Helpers;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using Moq;
using InventoryAdjustmentStatus = BPG.Domain.Constants.InventoryAdjustmentStatus;

namespace BPG.Application.UnitTests.InventoryAdjustments
{
    public class ApproveDecreaseAdjustmentCommandHandlerTests
    {
        private const long CurrentUserId = 50;
        private const long AdjustmentId = 1;
        private const long ProjectId = 100;
        private const long MaterialId = 20;

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly Mock<IGenericRepository<InventoryAdjustment>> _mockAdjustmentRepo;
        private readonly Mock<IGenericRepository<CurrentInventory>> _mockInventoryRepo;
        private readonly Mock<IGenericRepository<Incident>> _mockIncidentRepo;
        private readonly ApproveDecreaseAdjustmentCommandHandler _handler;

        public ApproveDecreaseAdjustmentCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();
            _mockAdjustmentRepo = new Mock<IGenericRepository<InventoryAdjustment>>();
            _mockInventoryRepo = new Mock<IGenericRepository<CurrentInventory>>();
            _mockIncidentRepo = new Mock<IGenericRepository<Incident>>();
            var transactionRepo = new Mock<IGenericRepository<InventoryTransaction>>();

            _mockUow.Setup(uow => uow.Repository<InventoryAdjustment>()).Returns(_mockAdjustmentRepo.Object);
            _mockUow.Setup(uow => uow.Repository<CurrentInventory>()).Returns(_mockInventoryRepo.Object);
            _mockUow.Setup(uow => uow.Repository<InventoryTransaction>()).Returns(transactionRepo.Object);
            _mockUow.Setup(uow => uow.Repository<Incident>()).Returns(_mockIncidentRepo.Object);

            _mockCurrentUserService.SetupUser(CurrentUserId);
            _mockAdjustmentRepo.SetupMockData(new List<InventoryAdjustment>());
            _mockInventoryRepo.SetupMockData(new List<CurrentInventory>());
            _mockIncidentRepo.SetupMockData(new List<Incident>());
            transactionRepo.Setup(repository => repository.AddAsync(It.IsAny<InventoryTransaction>(), It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);

            _handler = new ApproveDecreaseAdjustmentCommandHandler(
                _mockUow.Object,
                _mockCurrentUserService.Object,
                ServiceStubFactory.RealtimeSender(),
                ServiceStubFactory.NotificationService());
        }

        [Fact]
        public async Task UTCID01_Handle_AdjustmentNotFound_ShouldThrowNotFoundException()
        {
            var act = async () => await _handler.Handle(Command(isApproved: true), CancellationToken.None);

            await act.Should().ThrowAsync<NotFoundException>();
        }

        [Fact]
        public async Task UTCID02_Handle_AdjustmentNotPending_ShouldThrowBusinessException()
        {
            SetupAdjustments(Adjustment(status: InventoryAdjustmentStatus.Approved));

            var act = async () => await _handler.Handle(Command(isApproved: true), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_INVALID_STATUS");
        }

        [Fact]
        public async Task UTCID03_Handle_RejectRequest_ShouldReturnSuccessResponse()
        {
            SetupAdjustments(Adjustment());

            var result = await _handler.Handle(Command(isApproved: false, rejectedReason: "Thông tin hao hụt không rõ ràng"), CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Data.Should().BeTrue();
            result.Message.Should().Be("Đã từ chối phiếu điều chỉnh giảm tồn");
        }

        [Fact]
        public async Task UTCID04_Handle_ApproveRequestWithInsufficientStock_ShouldThrowBusinessException()
        {
            SetupAdjustments(Adjustment(quantity: 50));
            SetupInventories(Inventory(quantity: 30));

            var act = async () => await _handler.Handle(Command(isApproved: true), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_INSUFFICIENT_STOCK");
        }

        [Fact]
        public async Task UTCID05_Handle_ApproveRequestWithSufficientStock_ShouldReturnSuccessResponse()
        {
            SetupAdjustments(Adjustment(quantity: 20));
            SetupInventories(Inventory(quantity: 100));

            var result = await _handler.Handle(Command(isApproved: true), CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Data.Should().BeTrue();
            result.Message.Should().Be("Phê duyệt phiếu điều chỉnh giảm tồn thành công");
        }

        private static ApproveDecreaseAdjustmentCommand Command(bool isApproved, string? rejectedReason = null)
            => new()
            {
                AdjustmentId = AdjustmentId,
                IsApproved = isApproved,
                RejectedReason = rejectedReason
            };

        private static InventoryAdjustment Adjustment(
            string status = InventoryAdjustmentStatus.Pending,
            decimal quantity = 20)
            => new()
            {
                AdjustmentId = AdjustmentId,
                ProjectId = ProjectId,
                Status = status,
                CreatedBy = 10,
                Items = new List<AdjustmentItem>
                {
                    new() { MaterialId = MaterialId, Quantity = quantity }
                }
            };

        private static CurrentInventory Inventory(decimal quantity)
            => new()
            {
                ProjectId = ProjectId,
                MaterialId = MaterialId,
                Quantity = quantity
            };

        private void SetupAdjustments(params InventoryAdjustment[] adjustments)
        {
            _mockAdjustmentRepo.SetupMockData(adjustments.ToList());
        }

        private void SetupInventories(params CurrentInventory[] inventories)
        {
            _mockInventoryRepo.SetupMockData(inventories.ToList());
        }
    }
}
