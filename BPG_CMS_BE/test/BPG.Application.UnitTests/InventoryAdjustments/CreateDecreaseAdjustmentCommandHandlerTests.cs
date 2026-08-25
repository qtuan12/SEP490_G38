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
using ErrorCodes = BPG.Domain.Constants.ErrorCodes;

namespace BPG.Application.UnitTests.InventoryAdjustments
{
    public class CreateDecreaseAdjustmentCommandHandlerTests
    {
        private const long CurrentUserId = 15;
        private const long ProjectId = 1;
        private const long PhaseId = 2;
        private const long MaterialId = 10;
        private const long IncidentId = 30;
        private const int AlternativeUnitId = 4;
        private const long GeneratedAdjustmentId = 900;

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly Mock<IGenericRepository<Project>> _mockProjectRepo;
        private readonly Mock<IGenericRepository<Phase>> _mockPhaseRepo;
        private readonly Mock<IGenericRepository<MaterialCatalog>> _mockMaterialRepo;
        private readonly Mock<IGenericRepository<MaterialConversion>> _mockConversionRepo;
        private readonly Mock<IGenericRepository<CurrentInventory>> _mockInventoryRepo;
        private readonly Mock<IGenericRepository<InventoryAdjustment>> _mockAdjustmentRepo;
        private readonly Mock<IGenericRepository<AdjustmentItem>> _mockAdjustmentItemRepo;
        private readonly Mock<IGenericRepository<Incident>> _mockIncidentRepo;
        private InventoryAdjustment? _addedAdjustment;
        private readonly CreateDecreaseAdjustmentCommandHandler _handler;

        public CreateDecreaseAdjustmentCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();
            _mockProjectRepo = new Mock<IGenericRepository<Project>>();
            _mockPhaseRepo = new Mock<IGenericRepository<Phase>>();
            _mockMaterialRepo = new Mock<IGenericRepository<MaterialCatalog>>();
            _mockConversionRepo = new Mock<IGenericRepository<MaterialConversion>>();
            _mockInventoryRepo = new Mock<IGenericRepository<CurrentInventory>>();
            _mockAdjustmentRepo = new Mock<IGenericRepository<InventoryAdjustment>>();
            _mockAdjustmentItemRepo = new Mock<IGenericRepository<AdjustmentItem>>();
            _mockIncidentRepo = new Mock<IGenericRepository<Incident>>();

            _mockUow.Setup(uow => uow.Repository<Project>()).Returns(_mockProjectRepo.Object);
            _mockUow.Setup(uow => uow.Repository<Phase>()).Returns(_mockPhaseRepo.Object);
            _mockUow.Setup(uow => uow.Repository<MaterialCatalog>()).Returns(_mockMaterialRepo.Object);
            _mockUow.Setup(uow => uow.Repository<MaterialConversion>()).Returns(_mockConversionRepo.Object);
            _mockUow.Setup(uow => uow.Repository<CurrentInventory>()).Returns(_mockInventoryRepo.Object);
            _mockUow.Setup(uow => uow.Repository<InventoryAdjustment>()).Returns(_mockAdjustmentRepo.Object);
            _mockUow.Setup(uow => uow.Repository<AdjustmentItem>()).Returns(_mockAdjustmentItemRepo.Object);
            _mockUow.Setup(uow => uow.Repository<Incident>()).Returns(_mockIncidentRepo.Object);

            _mockMaterialRepo.SetupMockData(new List<MaterialCatalog>());
            _mockConversionRepo.SetupMockData(new List<MaterialConversion>());
            _mockInventoryRepo.SetupMockData(new List<CurrentInventory>());
            _mockAdjustmentRepo.SetupMockData(new List<InventoryAdjustment>());
            _mockIncidentRepo.SetupMockData(new List<Incident>());
            _mockCurrentUserService.SetupUser(CurrentUserId);
            _mockAdjustmentRepo.Setup(repository => repository.AddAsync(It.IsAny<InventoryAdjustment>(), It.IsAny<CancellationToken>()))
                .Callback<InventoryAdjustment, CancellationToken>((adjustment, _) =>
                {
                    _addedAdjustment = adjustment;
                    adjustment.AdjustmentId = GeneratedAdjustmentId;
                })
                .Returns(Task.CompletedTask);

            _handler = new CreateDecreaseAdjustmentCommandHandler(
                _mockUow.Object,
                _mockCurrentUserService.Object,
                ServiceStubFactory.RealtimeSender(),
                ServiceStubFactory.NotificationService());
        }

        [Fact]
        public async Task UTCID01_Handle_ProjectNotFound_ShouldThrowNotFoundException()
        {
            SetupProject(null);

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<NotFoundException>();
            exception.Which.ErrorCode.Should().Be("BIZ_001");
            exception.Which.Message.Should().Be("Project với ID [1] không tồn tại.");
        }

        [Fact]
        public async Task UTCID01B_Handle_ProjectInactive_ShouldThrowBusinessException()
        {
            SetupProject(Project(status: ProjectStatus.Completed));

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_PROJECT_NOT_ACTIVE");
            exception.Which.Message.Should().Be("Dự án đang tạm dừng, đã đóng hoặc chưa bắt đầu, không thể thực hiện thao tác này.");
        }

        [Fact]
        public async Task UTCID02_Handle_PhaseNotFound_ShouldThrowNotFoundException()
        {
            SetupProject(Project());
            SetupPhase(null);

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<NotFoundException>();
            exception.Which.ErrorCode.Should().Be("BIZ_001");
            exception.Which.Message.Should().Be("Phase với ID [2] không tồn tại.");
        }

        [Fact]
        public async Task UTCID03_Handle_PhaseNotInProject_ShouldThrowBusinessException()
        {
            SetupProject(Project());
            SetupPhase(new Phase { PhaseId = PhaseId, ProjectId = 888 });

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_INVALID_PHASE");
            exception.Which.Message.Should().Be("Giai đoạn không thuộc dự án này");
        }

        [Fact]
        public async Task UTCID04_Handle_MaterialNotFound_ShouldThrowNotFoundException()
        {
            SetupValidPreconditions();
            SetupMaterials();

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<NotFoundException>();
            exception.Which.ErrorCode.Should().Be("BIZ_001");
            exception.Which.Message.Should().Be("MaterialCatalog với ID [10] không tồn tại.");
        }

        [Fact]
        public async Task UTCID05_Handle_DiscreteMaterialWithDecimalQuantity_ShouldThrowBusinessException()
        {
            SetupValidPreconditions();
            SetupMaterials(Material(isDiscrete: true));

            var act = async () => await _handler.Handle(Command(quantity: 2.3m), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be(ErrorCodes.InvalidUnitQuantity);
            exception.Which.Message.Should().Be("Đơn vị tính 'm3' của vật tư [Cát xây dựng] yêu cầu số lượng phải là số nguyên.");
        }

        [Fact]
        public async Task UTCID06_Handle_ValidRequest_ShouldReturnSuccessResponse()
        {
            SetupValidPreconditions();
            SetupMaterials(Material(isDiscrete: false));
            SetupInventories(Inventory(quantity: 30));

            var result = await _handler.Handle(Command(quantity: 15.5m), CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Data.Should().Be(GeneratedAdjustmentId);
        }

        [Fact]
        public async Task UTCID07_Handle_QuantityExceedsAvailableStock_ShouldThrowInsufficientStockException()
        {
            SetupValidPreconditions();
            SetupMaterials(Material(isDiscrete: false));
            SetupInventories(Inventory(quantity: 30, reservedQuantity: 10));

            var act = async () => await _handler.Handle(Command(quantity: 21), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<InsufficientStockException>();
            exception.Which.ErrorCode.Should().Be(ErrorCodes.InsufficientStock);
        }

        [Fact]
        public async Task UTCID08_Handle_SecondDecreaseExceedsStockAfterFirstHold_ShouldThrowInsufficientStockException()
        {
            SetupValidPreconditions();
            SetupMaterials(Material(isDiscrete: false));
            SetupInventories(Inventory(quantity: 30));

            await _handler.Handle(Command(quantity: 10), CancellationToken.None);
            var act = async () => await _handler.Handle(Command(quantity: 21), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<InsufficientStockException>();
            exception.Which.ErrorCode.Should().Be(ErrorCodes.InsufficientStock);
        }

        [Fact]
        public async Task Handle_AlternativeUnit_ShouldReserveBaseQuantityAndStoreHistoricalConversion()
        {
            SetupValidPreconditions();
            SetupMaterials(Material(isDiscrete: false));
            SetupConversions(new MaterialConversion
            {
                MaterialId = MaterialId,
                AlternativeUnitId = AlternativeUnitId,
                AlternativeUnit = new Unit
                {
                    UnitId = AlternativeUnitId,
                    UnitName = "Tấn",
                    IsDiscrete = false
                },
                ConversionRate = 0.001m
            });
            var inventory = Inventory(quantity: 5_000);
            SetupInventories(inventory);

            await _handler.Handle(
                Command(quantity: 2m, unitId: AlternativeUnitId),
                CancellationToken.None);

            inventory.ReservedQuantity.Should().Be(2_000m);
            var item = _addedAdjustment!.Items.Should().ContainSingle().Subject;
            item.UnitId.Should().Be(AlternativeUnitId);
            item.Quantity.Should().Be(2m);
            item.ConversionRate.Should().Be(0.001m);
        }

        [Fact]
        public async Task Handle_LinkedIncidentInWrongStatus_ShouldRejectRequest()
        {
            SetupValidPreconditions();
            SetupIncident(Incident(status: "Reported"));

            var act = async () => await _handler.Handle(
                Command(incidentId: IncidentId),
                CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_INVALID_INCIDENT_STATUS");
        }

        [Fact]
        public async Task Handle_LinkedIncidentWithExistingAdjustment_ShouldRejectRequest()
        {
            SetupValidPreconditions();
            SetupIncident(Incident());
            _mockAdjustmentRepo.SetupMockData(new List<InventoryAdjustment>
            {
                new() { AdjustmentId = 99, IncidentId = IncidentId, Status = InventoryAdjustmentStatus.Pending }
            });

            var act = async () => await _handler.Handle(
                Command(incidentId: IncidentId),
                CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_INCIDENT_ALREADY_ADJUSTED");
        }

        [Fact]
        public async Task Handle_LinkedIncident_ShouldTransitionOnlyThatIncidentAfterValidation()
        {
            SetupValidPreconditions();
            SetupMaterials(Material(isDiscrete: false));
            SetupInventories(Inventory(quantity: 10));
            var incident = Incident();
            SetupIncident(incident);

            await _handler.Handle(
                Command(quantity: 2, incidentId: IncidentId),
                CancellationToken.None);

            incident.Status.Should().Be(IncidentStatus.UnderResolution);
            _addedAdjustment!.IncidentId.Should().Be(IncidentId);
        }

        [Fact]
        public async Task Handle_IncidentWithRevisionRequiredAdjustment_ShouldUpdateAndResubmitSameAdjustment()
        {
            SetupValidPreconditions();
            SetupMaterials(Material(isDiscrete: false));
            var inventory = Inventory(quantity: 10);
            SetupInventories(inventory);
            var incident = Incident(status: IncidentStatus.UnderResolution);
            SetupIncident(incident);
            var oldItem = new AdjustmentItem
            {
                AdjustmentItemId = 501,
                AdjustmentId = 99,
                MaterialId = MaterialId,
                UnitId = 3,
                Quantity = 1,
                ConversionRate = 1
            };
            var existingAdjustment = new InventoryAdjustment
            {
                AdjustmentId = 99,
                ProjectId = ProjectId,
                PhaseId = PhaseId,
                IncidentId = IncidentId,
                AdjustmentType = InventoryAdjustmentType.Decrease,
                Reason = "Nội dung cũ",
                Description = "Mô tả cũ",
                Status = InventoryAdjustmentStatus.RevisionRequired,
                RejectedReason = "Cần làm rõ số lượng",
                ApprovedBy = 88,
                ApprovedAt = DateTime.UtcNow,
                Items = new List<AdjustmentItem> { oldItem }
            };
            _mockAdjustmentRepo.SetupMockData(new List<InventoryAdjustment>
            {
                existingAdjustment
            });

            var result = await _handler.Handle(
                Command(quantity: 2, incidentId: IncidentId),
                CancellationToken.None);

            result.Data.Should().Be(99);
            _addedAdjustment.Should().BeNull();
            existingAdjustment.Status.Should().Be(InventoryAdjustmentStatus.Pending);
            existingAdjustment.Reason.Should().Be("Giảm tồn do hư hỏng");
            existingAdjustment.Description.Should().Be("Sự cố vật tư");
            existingAdjustment.RejectedReason.Should().BeNull();
            existingAdjustment.ApprovedBy.Should().BeNull();
            existingAdjustment.ApprovedAt.Should().BeNull();
            existingAdjustment.Items.Should().ContainSingle()
                .Which.Quantity.Should().Be(2);
            inventory.ReservedQuantity.Should().Be(2);
            incident.Status.Should().Be(IncidentStatus.UnderResolution);
            _mockAdjustmentRepo.Verify(
                repository => repository.Update(existingAdjustment),
                Times.Once);
            _mockAdjustmentItemRepo.Verify(
                repository => repository.RemoveRange(
                    It.Is<IEnumerable<AdjustmentItem>>(items => items.Single() == oldItem)),
                Times.Once);
        }

        [Fact]
        public async Task Handle_ConcurrentDuplicateIncident_ShouldMapUniqueViolationToBusinessError()
        {
            SetupValidPreconditions();
            SetupMaterials(Material(isDiscrete: false));
            SetupInventories(Inventory(quantity: 10));
            SetupIncident(Incident());
            _mockUow.Setup(unitOfWork => unitOfWork.SaveChangesAsync(It.IsAny<CancellationToken>()))
                .ThrowsAsync(new DbUpdateException(
                    "Unique index violation",
                    new FakeSqlException(
                        2601,
                        "Cannot insert duplicate key row in index 'IX_InventoryAdjustments_IncidentId'.")));

            var act = async () => await _handler.Handle(
                Command(quantity: 2, incidentId: IncidentId),
                CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_INCIDENT_ALREADY_ADJUSTED");
        }

        [Fact]
        public async Task Handle_ConcurrentIncidentTransition_ShouldMapConcurrencyToBusinessError()
        {
            SetupValidPreconditions();
            SetupMaterials(Material(isDiscrete: false));
            SetupInventories(Inventory(quantity: 10));
            SetupIncident(Incident());
            _mockUow.Setup(unitOfWork => unitOfWork.SaveChangesAsync(It.IsAny<CancellationToken>()))
                .ThrowsAsync(new DbUpdateConcurrencyException());

            var act = async () => await _handler.Handle(
                Command(quantity: 2, incidentId: IncidentId),
                CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_INCIDENT_STATE_CHANGED");
        }

        [Theory]
        [InlineData(0)]
        [InlineData(-1)]
        public async Task Validator_NonPositiveIncidentId_ShouldFail(long incidentId)
        {
            var validator = new CreateDecreaseAdjustmentCommandValidator();

            var result = await validator.ValidateAsync(Command(incidentId: incidentId));

            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(error => error.PropertyName == nameof(CreateDecreaseAdjustmentCommand.IncidentId));
        }

        private static CreateDecreaseAdjustmentCommand Command(
            decimal quantity = 2,
            int? unitId = null,
            long? incidentId = null)
            => new()
            {
                ProjectId = ProjectId,
                PhaseId = PhaseId,
                IncidentId = incidentId,
                Reason = "Giảm tồn do hư hỏng",
                Description = "Sự cố vật tư",
                Items = new List<AdjustmentItemRequest>
                {
                    new() { MaterialId = MaterialId, UnitId = unitId, Quantity = quantity }
                }
            };

        private static Project Project(string status = ProjectStatus.InProgress)
            => new() { ProjectId = ProjectId, Name = "Project Alpha", Status = status };

        private static Phase Phase()
            => new() { PhaseId = PhaseId, ProjectId = ProjectId };

        private static MaterialCatalog Material(bool isDiscrete)
            => new()
            {
                MaterialId = MaterialId,
                Name = "Cát xây dựng",
                BaseUnitId = 3,
                BaseUnit = new Unit { UnitId = 3, UnitName = "m3", IsDiscrete = isDiscrete }
            };

        private static CurrentInventory Inventory(decimal quantity, decimal reservedQuantity = 0)
            => new()
            {
                ProjectId = ProjectId,
                MaterialId = MaterialId,
                Quantity = quantity,
                ReservedQuantity = reservedQuantity
            };

        private static Incident Incident(string status = "WaitingAccountant")
            => new()
            {
                IncidentId = IncidentId,
                ProjectId = ProjectId,
                PhaseId = PhaseId,
                IncidentType = "InventoryLoss",
                Status = status
            };

        private void SetupValidPreconditions()
        {
            SetupProject(Project());
            SetupPhase(Phase());
        }

        private void SetupProject(Project? project)
        {
            _mockProjectRepo.Setup(repository => repository.GetByIdAsync(ProjectId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(project);
        }

        private void SetupPhase(Phase? phase)
        {
            _mockPhaseRepo.Setup(repository => repository.GetByIdAsync(PhaseId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(phase);
        }

        private void SetupMaterials(params MaterialCatalog[] materials)
        {
            _mockMaterialRepo.SetupMockData(materials.ToList());
        }

        private void SetupConversions(params MaterialConversion[] conversions)
        {
            _mockConversionRepo.SetupMockData(conversions.ToList());
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
            public FakeSqlException(int number, string message)
                : base(message)
            {
                Number = number;
            }

            public int Number { get; }
        }
    }
}
