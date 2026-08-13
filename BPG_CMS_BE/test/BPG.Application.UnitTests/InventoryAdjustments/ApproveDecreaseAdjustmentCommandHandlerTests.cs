using BPG.Application.Features.InventoryAdjustments.Commands;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Application.UnitTests.Helpers;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using Moq;
using BPG.Domain.Constants;
using Microsoft.EntityFrameworkCore;
using InventoryAdjustmentStatus = BPG.Domain.Constants.InventoryAdjustmentStatus;

namespace BPG.Application.UnitTests.InventoryAdjustments
{
    public class ApproveDecreaseAdjustmentCommandHandlerTests
    {
        private const long CurrentUserId = 50;
        private const long AdjustmentId = 1;
        private const long ProjectId = 100;
        private const long PhaseId = 200;
        private const long MaterialId = 20;
        private const long IncidentId = 300;

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly Mock<IGenericRepository<Project>> _mockProjectRepo;
        private readonly Mock<IGenericRepository<InventoryAdjustment>> _mockAdjustmentRepo;
        private readonly Mock<IGenericRepository<CurrentInventory>> _mockInventoryRepo;
        private readonly Mock<IGenericRepository<Incident>> _mockIncidentRepo;
        private readonly Mock<IGenericRepository<MaterialCatalog>> _mockMaterialRepo;
        private readonly Mock<IGenericRepository<InventoryTransaction>> _mockTransactionRepo;
        private readonly Mock<IRealtimeNotificationSender> _mockRealtimeSender;
        private readonly List<InventoryTransaction> _transactions = new();
        private readonly ApproveDecreaseAdjustmentCommandHandler _handler;

        public ApproveDecreaseAdjustmentCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();
            _mockProjectRepo = new Mock<IGenericRepository<Project>>();
            _mockAdjustmentRepo = new Mock<IGenericRepository<InventoryAdjustment>>();
            _mockInventoryRepo = new Mock<IGenericRepository<CurrentInventory>>();
            _mockIncidentRepo = new Mock<IGenericRepository<Incident>>();
            _mockMaterialRepo = new Mock<IGenericRepository<MaterialCatalog>>();
            _mockTransactionRepo = new Mock<IGenericRepository<InventoryTransaction>>();
            _mockRealtimeSender = new Mock<IRealtimeNotificationSender>();

            _mockUow.Setup(uow => uow.Repository<Project>()).Returns(_mockProjectRepo.Object);
            _mockUow.Setup(uow => uow.Repository<InventoryAdjustment>()).Returns(_mockAdjustmentRepo.Object);
            _mockUow.Setup(uow => uow.Repository<CurrentInventory>()).Returns(_mockInventoryRepo.Object);
            _mockUow.Setup(uow => uow.Repository<InventoryTransaction>()).Returns(_mockTransactionRepo.Object);
            _mockUow.Setup(uow => uow.Repository<Incident>()).Returns(_mockIncidentRepo.Object);
            _mockUow.Setup(uow => uow.Repository<MaterialCatalog>()).Returns(_mockMaterialRepo.Object);

            _mockProjectRepo.Setup(r => r.GetByIdAsync(ProjectId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new Project { ProjectId = ProjectId, Name = "Project Alpha", Status = ProjectStatus.InProgress });

            _mockCurrentUserService.SetupUser(CurrentUserId);
            _mockAdjustmentRepo.SetupMockData(new List<InventoryAdjustment>());
            _mockInventoryRepo.SetupMockData(new List<CurrentInventory>());
            _mockIncidentRepo.SetupMockData(new List<Incident>());
            _mockMaterialRepo.SetupMockData(new List<MaterialCatalog>());
            _mockTransactionRepo.Setup(repository => repository.AddAsync(It.IsAny<InventoryTransaction>(), It.IsAny<CancellationToken>()))
                .Callback<InventoryTransaction, CancellationToken>((transaction, _) => _transactions.Add(transaction))
                .Returns(Task.CompletedTask);
            _mockRealtimeSender.Setup(sender => sender.SendToGroupAsync(
                    It.IsAny<string>(),
                    It.IsAny<string>(),
                    It.IsAny<object>(),
                    It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);

            _handler = new ApproveDecreaseAdjustmentCommandHandler(
                _mockUow.Object,
                _mockCurrentUserService.Object,
                _mockRealtimeSender.Object,
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

        [Fact]
        public async Task Handle_ProjectRouteMismatch_ShouldRejectRequest()
        {
            SetupAdjustments(Adjustment());
            var command = Command(isApproved: true);
            command.ProjectId = 999;

            var act = async () => await _handler.Handle(command, CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_ADJUSTMENT_PROJECT_MISMATCH");
        }

        [Fact]
        public async Task Handle_ApproveAlternativeUnitDecrease_ShouldConsumeBaseQuantity()
        {
            _mockCurrentUserService.Setup(service => service.IsInRole(BPG.Domain.Constants.UserRole.Director)).Returns(true);
            SetupAdjustments(Adjustment(quantity: 2m, conversionRate: 0.001m));
            var inventory = Inventory(quantity: 5_000m, reservedQuantity: 2_000m);
            SetupInventories(inventory);

            await _handler.Handle(Command(isApproved: true), CancellationToken.None);

            inventory.Quantity.Should().Be(3_000m);
            inventory.ReservedQuantity.Should().Be(0m);
            var transaction = _transactions.Should().ContainSingle().Subject;
            transaction.QuantityChange.Should().Be(-2_000m);
            transaction.TransactionType.Should().Be(InventoryTransactionType.Adjustment);
        }

        [Fact]
        public async Task Handle_NonTerminatingConversion_ShouldUseSameThreeDecimalBaseQuantity()
        {
            _mockCurrentUserService.Setup(service => service.IsInRole(BPG.Domain.Constants.UserRole.Director)).Returns(true);
            SetupAdjustments(Adjustment(quantity: 1m, conversionRate: 3m));
            var inventory = Inventory(quantity: 5m, reservedQuantity: 0.333m);
            SetupInventories(inventory);

            await _handler.Handle(Command(isApproved: true), CancellationToken.None);

            inventory.Quantity.Should().Be(4.667m);
            inventory.ReservedQuantity.Should().Be(0m);
            _transactions.Should().ContainSingle()
                .Which.QuantityChange.Should().Be(-0.333m);
        }

        [Fact]
        public async Task Handle_RejectAlternativeUnitDecrease_ShouldReleaseBaseReservation()
        {
            _mockCurrentUserService.Setup(service => service.IsInRole(BPG.Domain.Constants.UserRole.Director)).Returns(true);
            SetupAdjustments(Adjustment(quantity: 2m, conversionRate: 0.001m));
            var inventory = Inventory(quantity: 5_000m, reservedQuantity: 2_000m);
            SetupInventories(inventory);

            await _handler.Handle(
                Command(isApproved: false, rejectedReason: "Không hợp lệ"),
                CancellationToken.None);

            inventory.Quantity.Should().Be(5_000m);
            inventory.ReservedQuantity.Should().Be(0m);
            _transactions.Should().BeEmpty();
        }

        [Fact]
        public async Task Handle_StandaloneDecrease_ShouldNotFallBackToSamePhaseIncident()
        {
            _mockCurrentUserService.Setup(service => service.IsInRole(BPG.Domain.Constants.UserRole.Director)).Returns(true);
            SetupAdjustments(Adjustment(quantity: 20m));
            SetupInventories(Inventory(quantity: 100m, reservedQuantity: 20m));
            var unrelatedIncident = LinkedIncident();
            _mockIncidentRepo.SetupMockData(new List<Incident> { unrelatedIncident });

            await _handler.Handle(Command(isApproved: true), CancellationToken.None);

            unrelatedIncident.Status.Should().Be("WaitingDirector");
            _mockIncidentRepo.Verify(repository => repository.Update(It.IsAny<Incident>()), Times.Never);
            _transactions.Should().ContainSingle()
                .Which.TransactionType.Should().Be(InventoryTransactionType.Adjustment);
        }

        [Fact]
        public async Task Handle_LinkedDecrease_ShouldUpdateExactIncidentAndUseIncidentLedgerType()
        {
            _mockCurrentUserService.Setup(service => service.IsInRole(BPG.Domain.Constants.UserRole.Director)).Returns(true);
            SetupAdjustments(Adjustment(quantity: 20m, incidentId: IncidentId));
            SetupInventories(Inventory(quantity: 100m, reservedQuantity: 20m));
            var linkedIncident = LinkedIncident();
            SetupIncident(linkedIncident);

            await _handler.Handle(Command(isApproved: true), CancellationToken.None);

            linkedIncident.Status.Should().Be("Approved");
            _transactions.Should().ContainSingle()
                .Which.TransactionType.Should().Be(InventoryTransactionType.IncidentLoss);
        }

        [Fact]
        public async Task Handle_ConcurrencyConflict_ShouldMapStableErrorAndPublishNoRealtimeEvent()
        {
            _mockCurrentUserService.Setup(service => service.IsInRole(BPG.Domain.Constants.UserRole.Director)).Returns(true);
            SetupAdjustments(Adjustment(quantity: 20m, incidentId: IncidentId));
            SetupInventories(Inventory(quantity: 100m, reservedQuantity: 20m));
            SetupIncident(LinkedIncident());
            _mockUow.Setup(unitOfWork => unitOfWork.SaveChangesAsync(It.IsAny<CancellationToken>()))
                .ThrowsAsync(new DbUpdateConcurrencyException());

            var act = async () => await _handler.Handle(
                Command(isApproved: true),
                CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_ADJUSTMENT_ALREADY_PROCESSED");
            _mockRealtimeSender.Verify(sender => sender.SendToGroupAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<object>(),
                It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task Handle_ConcurrentFirstInventoryCreation_ShouldMapStableError()
        {
            _mockCurrentUserService.Setup(service => service.IsInRole(BPG.Domain.Constants.UserRole.TechnicalManager)).Returns(true);
            SetupAdjustments(Adjustment(
                adjustmentType: BPG.Domain.Constants.InventoryAdjustmentType.Increase,
                quantity: 20m));
            SetupInventories();
            _mockMaterialRepo.SetupMockData(new List<MaterialCatalog>
            {
                new() { MaterialId = MaterialId, BaseUnitId = 1, Name = "Material" }
            });
            _mockInventoryRepo.Setup(repository => repository.AddAsync(
                    It.IsAny<CurrentInventory>(),
                    It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);
            _mockUow.Setup(unitOfWork => unitOfWork.SaveChangesAsync(It.IsAny<CancellationToken>()))
                .ThrowsAsync(new DbUpdateException(
                    "Concurrent inventory insert failed.",
                    new FakeSqlException(
                        2601,
                        "Cannot insert duplicate key row in object with unique index 'IX_CurrentInventories_ProjectId_MaterialId_UnitId'.")));

            var act = async () => await _handler.Handle(
                Command(isApproved: true),
                CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_INVENTORY_STATE_CHANGED");
            _mockRealtimeSender.Verify(sender => sender.SendToGroupAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<object>(),
                It.IsAny<CancellationToken>()), Times.Never);
        }

        private static ApproveDecreaseAdjustmentCommand Command(bool isApproved, string? rejectedReason = null)
            => new()
            {
                ProjectId = ProjectId,
                AdjustmentId = AdjustmentId,
                IsApproved = isApproved,
                RejectedReason = rejectedReason
            };

        private static InventoryAdjustment Adjustment(
            string status = InventoryAdjustmentStatus.Pending,
            string adjustmentType = BPG.Domain.Constants.InventoryAdjustmentType.Decrease,
            decimal quantity = 20,
            decimal conversionRate = 1m,
            long? incidentId = null)
            => new()
            {
                AdjustmentId = AdjustmentId,
                ProjectId = ProjectId,
                PhaseId = PhaseId,
                IncidentId = incidentId,
                AdjustmentType = adjustmentType,
                Status = status,
                CreatedBy = 10,
                Items = new List<AdjustmentItem>
                {
                    new()
                    {
                        MaterialId = MaterialId,
                        UnitId = conversionRate == 1m ? 1 : 2,
                        Quantity = quantity,
                        ConversionRate = conversionRate
                    }
                }
            };

        private static CurrentInventory Inventory(decimal quantity, decimal reservedQuantity = 0)
            => new()
            {
                ProjectId = ProjectId,
                MaterialId = MaterialId,
                Quantity = quantity,
                ReservedQuantity = reservedQuantity
            };

        private static Incident LinkedIncident()
            => new()
            {
                IncidentId = IncidentId,
                ProjectId = ProjectId,
                PhaseId = PhaseId,
                IncidentType = "InventoryLoss",
                Status = "WaitingDirector"
            };

        private void SetupAdjustments(params InventoryAdjustment[] adjustments)
        {
            _mockAdjustmentRepo.SetupMockData(adjustments.ToList());
        }

        private void SetupInventories(params CurrentInventory[] inventories)
        {
            _mockInventoryRepo.SetupMockData(inventories.ToList());
        }

        private void SetupIncident(Incident incident)
        {
            _mockIncidentRepo.Setup(repository => repository.GetByIdAsync(
                    incident.IncidentId,
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(incident);
        }

        private sealed class FakeSqlException : Exception
        {
            public FakeSqlException(int number, string message) : base(message)
            {
                Number = number;
            }

            public int Number { get; }
        }
    }
}
