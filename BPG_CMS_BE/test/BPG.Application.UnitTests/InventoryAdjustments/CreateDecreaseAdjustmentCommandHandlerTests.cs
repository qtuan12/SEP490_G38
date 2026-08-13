using BPG.Application.Features.InventoryAdjustments.Commands;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Application.UnitTests.Helpers;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using Moq;
using BPG.Domain.Constants;
using ErrorCodes = BPG.Domain.Constants.ErrorCodes;

namespace BPG.Application.UnitTests.InventoryAdjustments
{
    public class CreateDecreaseAdjustmentCommandHandlerTests
    {
        private const long ProjectId = 1;
        private const long PhaseId = 2;
        private const long MaterialId = 10;
        private const long GeneratedAdjustmentId = 900;

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IGenericRepository<Project>> _mockProjectRepo;
        private readonly Mock<IGenericRepository<Phase>> _mockPhaseRepo;
        private readonly Mock<IGenericRepository<MaterialCatalog>> _mockMaterialRepo;
        private readonly Mock<IGenericRepository<CurrentInventory>> _mockInventoryRepo;
        private readonly Mock<IGenericRepository<InventoryAdjustment>> _mockAdjustmentRepo;
        private readonly CreateDecreaseAdjustmentCommandHandler _handler;

        public CreateDecreaseAdjustmentCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockProjectRepo = new Mock<IGenericRepository<Project>>();
            _mockPhaseRepo = new Mock<IGenericRepository<Phase>>();
            _mockMaterialRepo = new Mock<IGenericRepository<MaterialCatalog>>();
            _mockInventoryRepo = new Mock<IGenericRepository<CurrentInventory>>();
            _mockAdjustmentRepo = new Mock<IGenericRepository<InventoryAdjustment>>();

            _mockUow.Setup(uow => uow.Repository<Project>()).Returns(_mockProjectRepo.Object);
            _mockUow.Setup(uow => uow.Repository<Phase>()).Returns(_mockPhaseRepo.Object);
            _mockUow.Setup(uow => uow.Repository<MaterialCatalog>()).Returns(_mockMaterialRepo.Object);
            _mockUow.Setup(uow => uow.Repository<CurrentInventory>()).Returns(_mockInventoryRepo.Object);
            _mockUow.Setup(uow => uow.Repository<InventoryAdjustment>()).Returns(_mockAdjustmentRepo.Object);

            _mockMaterialRepo.SetupMockData(new List<MaterialCatalog>());
            _mockInventoryRepo.SetupMockData(new List<CurrentInventory>());
            _mockAdjustmentRepo.Setup(repository => repository.AddAsync(It.IsAny<InventoryAdjustment>(), It.IsAny<CancellationToken>()))
                .Callback<InventoryAdjustment, CancellationToken>((adjustment, _) => adjustment.AdjustmentId = GeneratedAdjustmentId)
                .Returns(Task.CompletedTask);

            _handler = new CreateDecreaseAdjustmentCommandHandler(
                _mockUow.Object,
                Mock.Of<ICurrentUserService>(),
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

        private static CreateDecreaseAdjustmentCommand Command(decimal quantity = 2)
            => new()
            {
                ProjectId = ProjectId,
                PhaseId = PhaseId,
                Reason = "Giảm tồn do hư hỏng",
                Description = "Sự cố vật tư",
                Items = new List<AdjustmentItemRequest> { new() { MaterialId = MaterialId, Quantity = quantity } }
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

        private void SetupInventories(params CurrentInventory[] inventories)
        {
            _mockInventoryRepo.SetupMockData(inventories.ToList());
        }
    }
}
