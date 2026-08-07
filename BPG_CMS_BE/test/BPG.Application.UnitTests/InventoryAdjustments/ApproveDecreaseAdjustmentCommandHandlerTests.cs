using BPG.Application.Features.InventoryAdjustments.Commands;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Application.UnitTests.Helpers;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using Moq;
using BPG.Domain.Constants;
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
        private readonly Mock<IGenericRepository<Project>> _mockProjectRepo;
        private readonly Mock<IGenericRepository<InventoryAdjustment>> _mockAdjustmentRepo;
        private readonly Mock<IGenericRepository<CurrentInventory>> _mockInventoryRepo;
        private readonly Mock<IGenericRepository<Incident>> _mockIncidentRepo;
        private readonly ApproveDecreaseAdjustmentCommandHandler _handler;

        public ApproveDecreaseAdjustmentCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();
            _mockProjectRepo = new Mock<IGenericRepository<Project>>();
            _mockAdjustmentRepo = new Mock<IGenericRepository<InventoryAdjustment>>();
            _mockInventoryRepo = new Mock<IGenericRepository<CurrentInventory>>();
            _mockIncidentRepo = new Mock<IGenericRepository<Incident>>();
            var transactionRepo = new Mock<IGenericRepository<InventoryTransaction>>();

            _mockUow.Setup(uow => uow.Repository<Project>()).Returns(_mockProjectRepo.Object);
            _mockUow.Setup(uow => uow.Repository<InventoryAdjustment>()).Returns(_mockAdjustmentRepo.Object);
            _mockUow.Setup(uow => uow.Repository<CurrentInventory>()).Returns(_mockInventoryRepo.Object);
            _mockUow.Setup(uow => uow.Repository<InventoryTransaction>()).Returns(transactionRepo.Object);
            _mockUow.Setup(uow => uow.Repository<Incident>()).Returns(_mockIncidentRepo.Object);

            _mockProjectRepo.Setup(r => r.GetByIdAsync(ProjectId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new Project { ProjectId = ProjectId, Name = "Project Alpha", Status = ProjectStatus.InProgress });

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
            _mockCurrentUserService.Setup(c => c.IsInRole(BPG.Domain.Constants.UserRole.Director)).Returns(true);
            var act = async () => await _handler.Handle(Command(isApproved: true), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<NotFoundException>();
            exception.Which.ErrorCode.Should().Be("BIZ_001");
            exception.Which.Message.Should().Be("InventoryAdjustment với ID [1] không tồn tại.");
        }

        [Fact]
        public async Task UTCID02_Handle_AdjustmentNotPending_ShouldThrowBusinessException()
        {
            _mockCurrentUserService.Setup(c => c.IsInRole(BPG.Domain.Constants.UserRole.Director)).Returns(true);
            SetupAdjustments(Adjustment(status: InventoryAdjustmentStatus.Approved));

            var act = async () => await _handler.Handle(Command(isApproved: true), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_INVALID_STATUS");
            exception.Which.Message.Should().Be("Phiếu không ở trạng thái chờ duyệt");
        }

        [Fact]
        public async Task UTCID02B_Handle_ProjectInactive_ShouldThrowBusinessException()
        {
            _mockCurrentUserService.Setup(c => c.IsInRole(BPG.Domain.Constants.UserRole.Director)).Returns(true);
            _mockProjectRepo.Setup(r => r.GetByIdAsync(ProjectId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new Project { ProjectId = ProjectId, Name = "Project Alpha", Status = ProjectStatus.Paused });
            SetupAdjustments(Adjustment(status: InventoryAdjustmentStatus.Pending));

            var act = async () => await _handler.Handle(Command(isApproved: true), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_PROJECT_NOT_ACTIVE");
            exception.Which.Message.Should().Be("Dự án đang tạm dừng, đã đóng hoặc chưa bắt đầu, không thể thực hiện thao tác này.");
        }

        [Fact]
        public async Task UTCID03_Handle_RejectRequest_ShouldReturnSuccessResponse()
        {
            _mockCurrentUserService.Setup(c => c.IsInRole(BPG.Domain.Constants.UserRole.Director)).Returns(true);
            SetupAdjustments(Adjustment());

            var result = await _handler.Handle(Command(isApproved: false, rejectedReason: "Thông tin hao hụt không rõ ràng"), CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Data.Should().BeTrue();
            result.Message.Should().Be("Đã từ chối phiếu điều chỉnh giảm tồn");
        }

        [Fact]
        public async Task UTCID04_Handle_ApproveRequestWithInsufficientStock_ShouldThrowBusinessException()
        {
            _mockCurrentUserService.Setup(c => c.IsInRole(BPG.Domain.Constants.UserRole.Director)).Returns(true);
            SetupAdjustments(Adjustment(quantity: 50));
            SetupInventories(Inventory(quantity: 30));

            var act = async () => await _handler.Handle(Command(isApproved: true), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_INSUFFICIENT_STOCK");
            exception.Which.Message.Should().Be("Không đủ tồn kho cho vật tư ID 20");
        }

        [Fact]
        public async Task UTCID05_Handle_ApproveRequestWithSufficientStock_ShouldReturnSuccessResponse()
        {
            _mockCurrentUserService.Setup(c => c.IsInRole(BPG.Domain.Constants.UserRole.Director)).Returns(true);
            SetupAdjustments(Adjustment(quantity: 20));
            SetupInventories(Inventory(quantity: 100));

            var result = await _handler.Handle(Command(isApproved: true), CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Data.Should().BeTrue();
            result.Message.Should().Be("Phê duyệt phiếu điều chỉnh giảm tồn thành công");
        }

        [Fact]
        public async Task UTCID06_Handle_ApproveIncreaseAdjustment_ShouldReturnSuccessResponse()
        {
            _mockCurrentUserService.Setup(c => c.IsInRole(BPG.Domain.Constants.UserRole.TechnicalManager)).Returns(true);
            SetupAdjustments(Adjustment(adjustmentType: BPG.Domain.Constants.InventoryAdjustmentType.Increase, quantity: 15));
            SetupInventories(Inventory(quantity: 10));

            var result = await _handler.Handle(Command(isApproved: true), CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Data.Should().BeTrue();
            result.Message.Should().Be("Phê duyệt phiếu điều chỉnh tăng tồn thành công");
        }

        [Fact]
        public async Task UTCID07_Handle_RejectIncreaseAdjustment_ShouldReturnSuccessResponse()
        {
            _mockCurrentUserService.Setup(c => c.IsInRole(BPG.Domain.Constants.UserRole.TechnicalManager)).Returns(true);
            SetupAdjustments(Adjustment(adjustmentType: BPG.Domain.Constants.InventoryAdjustmentType.Increase, quantity: 15));

            var result = await _handler.Handle(Command(isApproved: false, rejectedReason: "Số lượng sai thực tế"), CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Data.Should().BeTrue();
            result.Message.Should().Be("Đã từ chối phiếu điều chỉnh tăng tồn");
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
            string adjustmentType = BPG.Domain.Constants.InventoryAdjustmentType.Decrease,
            decimal quantity = 20)
            => new()
            {
                AdjustmentId = AdjustmentId,
                ProjectId = ProjectId,
                AdjustmentType = adjustmentType,
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
