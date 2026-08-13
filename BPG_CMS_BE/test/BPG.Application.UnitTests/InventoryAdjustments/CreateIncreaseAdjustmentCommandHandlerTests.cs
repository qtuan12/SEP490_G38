using BPG.Application.Features.InventoryAdjustments.Commands;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Application.UnitTests.Helpers;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using Moq;
using ErrorCodes = BPG.Domain.Constants.ErrorCodes;
using RoleConstants = BPG.Domain.Constants.UserRole;

namespace BPG.Application.UnitTests.InventoryAdjustments
{
    public class CreateIncreaseAdjustmentCommandHandlerTests
    {
        private const long CurrentUserId = 10;
        private const long ProjectId = 1;
        private const long PhaseId = 2;
        private const long MaterialId = 10;
        private const int AlternativeUnitId = 2;
        private const long GeneratedAdjustmentId = 800;

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly Mock<IGenericRepository<Project>> _mockProjectRepo;
        private readonly Mock<IGenericRepository<ProjectMember>> _mockMemberRepo;
        private readonly Mock<IGenericRepository<Phase>> _mockPhaseRepo;
        private readonly Mock<IGenericRepository<MaterialCatalog>> _mockMaterialRepo;
        private readonly Mock<IGenericRepository<MaterialConversion>> _mockConversionRepo;
        private readonly Mock<IGenericRepository<CurrentInventory>> _mockInventoryRepo;
        private readonly Mock<IGenericRepository<InventoryAdjustment>> _mockAdjustmentRepo;
        private InventoryAdjustment? _addedAdjustment;
        private readonly CreateIncreaseAdjustmentCommandHandler _handler;

        public CreateIncreaseAdjustmentCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();
            _mockProjectRepo = new Mock<IGenericRepository<Project>>();
            _mockMemberRepo = new Mock<IGenericRepository<ProjectMember>>();
            _mockPhaseRepo = new Mock<IGenericRepository<Phase>>();
            _mockMaterialRepo = new Mock<IGenericRepository<MaterialCatalog>>();
            _mockConversionRepo = new Mock<IGenericRepository<MaterialConversion>>();
            _mockInventoryRepo = new Mock<IGenericRepository<CurrentInventory>>();
            _mockAdjustmentRepo = new Mock<IGenericRepository<InventoryAdjustment>>();
            var transactionRepo = new Mock<IGenericRepository<InventoryTransaction>>();

            _mockUow.Setup(uow => uow.Repository<Project>()).Returns(_mockProjectRepo.Object);
            _mockUow.Setup(uow => uow.Repository<ProjectMember>()).Returns(_mockMemberRepo.Object);
            _mockUow.Setup(uow => uow.Repository<Phase>()).Returns(_mockPhaseRepo.Object);
            _mockUow.Setup(uow => uow.Repository<MaterialCatalog>()).Returns(_mockMaterialRepo.Object);
            _mockUow.Setup(uow => uow.Repository<MaterialConversion>()).Returns(_mockConversionRepo.Object);
            _mockUow.Setup(uow => uow.Repository<CurrentInventory>()).Returns(_mockInventoryRepo.Object);
            _mockUow.Setup(uow => uow.Repository<InventoryTransaction>()).Returns(transactionRepo.Object);
            _mockUow.Setup(uow => uow.Repository<InventoryAdjustment>()).Returns(_mockAdjustmentRepo.Object);

            _mockMemberRepo.SetupMockData(new List<ProjectMember>());
            _mockMaterialRepo.SetupMockData(new List<MaterialCatalog>());
            _mockConversionRepo.SetupMockData(new List<MaterialConversion>());
            _mockInventoryRepo.SetupMockData(new List<CurrentInventory>());
            _mockInventoryRepo.Setup(repository => repository.AddAsync(It.IsAny<CurrentInventory>(), It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);
            transactionRepo.Setup(repository => repository.AddAsync(It.IsAny<InventoryTransaction>(), It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);
            _mockAdjustmentRepo.Setup(repository => repository.AddAsync(It.IsAny<InventoryAdjustment>(), It.IsAny<CancellationToken>()))
                .Callback<InventoryAdjustment, CancellationToken>((adjustment, _) =>
                {
                    _addedAdjustment = adjustment;
                    adjustment.AdjustmentId = GeneratedAdjustmentId;
                })
                .Returns(Task.CompletedTask);

            _handler = new CreateIncreaseAdjustmentCommandHandler(
                _mockUow.Object,
                _mockCurrentUserService.Object,
                ServiceStubFactory.RealtimeSender(),
                ServiceStubFactory.NotificationService());
        }
        [Fact]
        public async Task UTCID02_Handle_ProjectInactive_ShouldThrowBusinessException()
        {
            SetupProject(Project(status: ProjectStatus.Paused));
            SetupUser(RoleConstants.Admin);

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_PROJECT_NOT_ACTIVE");
            exception.Which.Message.Should().Be("Dự án đang tạm dừng, đã đóng hoặc chưa bắt đầu, không thể thực hiện thao tác này.");
        }

        [Fact]
        public async Task UTCID03_Handle_PhaseNotFound_ShouldThrowNotFoundException()
        {
            SetupProject(Project());
            SetupUser(RoleConstants.Admin);
            SetupPhase(null);

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<NotFoundException>();
            exception.Which.ErrorCode.Should().Be("BIZ_001");
            exception.Which.Message.Should().Be("Phase với ID [2] không tồn tại.");
        }

        [Fact]
        public async Task UTCID04_Handle_PhaseNotInProject_ShouldThrowBusinessException()
        {
            SetupProject(Project());
            SetupUser(RoleConstants.Admin);
            SetupPhase(new Phase { PhaseId = PhaseId, ProjectId = 999 });

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be(ErrorCodes.InvalidTransition);
            exception.Which.Message.Should().Be("Giai đoạn không thuộc dự án này.");
        }

        [Fact]
        public async Task UTCID05_Handle_MaterialNotFound_ShouldThrowNotFoundException()
        {
            SetupValidPreconditions();
            SetupMaterials();

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<NotFoundException>();
            exception.Which.ErrorCode.Should().Be("BIZ_001");
            exception.Which.Message.Should().Be("MaterialCatalog với ID [10] không tồn tại.");
        }

        [Fact]
        public async Task UTCID06_Handle_DiscreteMaterialWithDecimalQuantity_ShouldThrowBusinessException()
        {
            SetupValidPreconditions();
            SetupMaterials(Material(isDiscrete: true));

            var act = async () => await _handler.Handle(Command(quantity: 1.5m), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be(ErrorCodes.InvalidUnitQuantity);
            exception.Which.Message.Should().Be("Đơn vị tính 'Bao' của vật tư [Xi măng] yêu cầu số lượng phải là số nguyên.");
        }

        [Fact]
        public async Task UTCID07_Handle_AdminWithValidRequest_ShouldReturnSuccessResponse()
        {
            SetupValidPreconditions();
            SetupMaterials(Material(isDiscrete: true));

            var result = await _handler.Handle(Command(quantity: 10), CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Data.Should().Be(GeneratedAdjustmentId);
            result.Message.Should().Be("Tạo phiếu điều chỉnh tăng tồn thành công, chờ phê duyệt");
        }

        [Fact]
        public async Task UTCID08_Handle_ProjectLeaderWithValidRequest_ShouldReturnSuccessResponse()
        {
            SetupProject(Project());
            SetupUser(RoleConstants.SiteEngineer, hasRole: false);
            SetupMembers(new ProjectMember { ProjectId = ProjectId, UserId = CurrentUserId, IsLeader = true });
            SetupPhase(Phase());
            SetupMaterials(Material(isDiscrete: false));

            var result = await _handler.Handle(Command(quantity: 12.5m), CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Data.Should().Be(GeneratedAdjustmentId);
            result.Message.Should().Be("Tạo phiếu điều chỉnh tăng tồn thành công, chờ phê duyệt");
        }

        [Fact]
        public async Task Handle_AlternativeUnit_ShouldStoreSelectedUnitQuantityAndHistoricalRate()
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

            await _handler.Handle(
                Command(quantity: 2m, unitId: AlternativeUnitId),
                CancellationToken.None);

            var item = _addedAdjustment!.Items.Should().ContainSingle().Subject;
            item.UnitId.Should().Be(AlternativeUnitId);
            item.Quantity.Should().Be(2m);
            item.ConversionRate.Should().Be(0.001m);
        }

        [Fact]
        public async Task Handle_AlternativeUnitThatNormalizesToFractionalDiscreteBase_ShouldReject()
        {
            SetupValidPreconditions();
            SetupMaterials(Material(isDiscrete: true));
            SetupConversions(new MaterialConversion
            {
                MaterialId = MaterialId,
                AlternativeUnitId = AlternativeUnitId,
                AlternativeUnit = new Unit
                {
                    UnitId = AlternativeUnitId,
                    UnitName = "Thùng",
                    IsDiscrete = false
                },
                ConversionRate = 2m
            });

            var act = async () => await _handler.Handle(
                Command(quantity: 1m, unitId: AlternativeUnitId),
                CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be(ErrorCodes.InvalidUnitQuantity);
        }

        [Fact]
        public async Task Handle_LegacyPayloadWithoutUnitId_ShouldResolveAndStoreBaseUnit()
        {
            SetupValidPreconditions();
            SetupMaterials(Material(isDiscrete: false));

            await _handler.Handle(Command(quantity: 2m), CancellationToken.None);

            var item = _addedAdjustment!.Items.Should().ContainSingle().Subject;
            item.UnitId.Should().Be(1);
            item.ConversionRate.Should().Be(1m);
        }

        private static CreateIncreaseAdjustmentCommand Command(decimal quantity = 5, int? unitId = null)
            => new()
            {
                ProjectId = ProjectId,
                PhaseId = PhaseId,
                Reason = "Tăng tồn kho sau kiểm kê",
                Description = "Kiểm kê thực tế",
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
                Name = "Xi măng",
                BaseUnitId = 1,
                BaseUnit = new Unit { UnitId = 1, UnitName = "Bao", IsDiscrete = isDiscrete }
            };

        private void SetupValidPreconditions()
        {
            SetupProject(Project());
            SetupUser(RoleConstants.Admin);
            SetupPhase(Phase());
        }

        private void SetupProject(Project? project)
        {
            _mockProjectRepo.Setup(repository => repository.GetByIdAsync(ProjectId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(project);
        }

        private void SetupUser(string role, bool hasRole = true)
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, role, hasRole);
        }

        private void SetupPhase(Phase? phase)
        {
            _mockPhaseRepo.Setup(repository => repository.GetByIdAsync(PhaseId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(phase);
        }

        private void SetupMembers(params ProjectMember[] members)
        {
            _mockMemberRepo.SetupMockData(members.ToList());
        }

        private void SetupMaterials(params MaterialCatalog[] materials)
        {
            _mockMaterialRepo.SetupMockData(materials.ToList());
        }

        private void SetupConversions(params MaterialConversion[] conversions)
        {
            _mockConversionRepo.SetupMockData(conversions.ToList());
        }
    }
}
