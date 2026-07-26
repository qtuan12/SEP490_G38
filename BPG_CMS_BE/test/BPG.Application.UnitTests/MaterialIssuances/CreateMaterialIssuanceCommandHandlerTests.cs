using BPG.Application.Features.MaterialIssuances.Commands;
using BPG.Application.Features.MaterialIssuances.Handlers;
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

namespace BPG.Application.UnitTests.MaterialIssuances
{
    public class CreateMaterialIssuanceCommandHandlerTests
    {
        private const long CurrentUserId = 10;
        private const long ProjectId = 5;
        private const long TaskId = 100;
        private const long GeneratedIssuanceId = 600;
        private const long CementId = 50;
        private const long SandId = 51;
        private const int UnitId = 1;
        private const string ProjectGroup = "Project_5";
        private const string GlobalInventoryGroup = "Project_0";

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IGenericRepository<ProjectTask>> _mockTaskRepo;
        private readonly Mock<IGenericRepository<MaterialIssuance>> _mockIssuanceRepo;
        private readonly Mock<IGenericRepository<MaterialIssuanceItem>> _mockIssuanceItemRepo;
        private readonly Mock<IGenericRepository<CurrentInventory>> _mockInventoryRepo;
        private readonly Mock<IGenericRepository<ProjectMember>> _mockMemberRepo;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly Mock<IInventoryService> _mockInventoryService;
        private readonly Mock<IRealtimeNotificationSender> _mockRealtimeSender;
        private readonly CreateMaterialIssuanceCommandHandler _handler;

        public CreateMaterialIssuanceCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockTaskRepo = new Mock<IGenericRepository<ProjectTask>>();
            _mockIssuanceRepo = new Mock<IGenericRepository<MaterialIssuance>>();
            _mockIssuanceItemRepo = new Mock<IGenericRepository<MaterialIssuanceItem>>();
            _mockInventoryRepo = new Mock<IGenericRepository<CurrentInventory>>();
            _mockMemberRepo = new Mock<IGenericRepository<ProjectMember>>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();
            _mockInventoryService = new Mock<IInventoryService>();
            _mockRealtimeSender = new Mock<IRealtimeNotificationSender>();

            _mockUow.Setup(u => u.Repository<ProjectTask>()).Returns(_mockTaskRepo.Object);
            _mockUow.Setup(u => u.Repository<MaterialIssuance>()).Returns(_mockIssuanceRepo.Object);
            _mockUow.Setup(u => u.Repository<MaterialIssuanceItem>()).Returns(_mockIssuanceItemRepo.Object);
            _mockUow.Setup(u => u.Repository<CurrentInventory>()).Returns(_mockInventoryRepo.Object);
            _mockUow.Setup(u => u.Repository<ProjectMember>()).Returns(_mockMemberRepo.Object);

            SetupTasks();
            SetupInventories();
            SetupProjectMembers();
            SetupIssuanceIdGeneration();

            _handler = new CreateMaterialIssuanceCommandHandler(
                _mockUow.Object,
                _mockCurrentUserService.Object,
                _mockInventoryService.Object,
                _mockRealtimeSender.Object);
        }

        [Fact]
        public async Task UTCID01_Handle_TechnicalManagerIssuesMultipleMaterialsWithConversion_ShouldCreateIssuance()
        {
            SetupTechnicalManager();
            SetupTasks(Task());
            SetupInventories(
                Inventory(CementId, "Cement", quantity: 100, reservedQuantity: 10),
                Inventory(SandId, "Sand", quantity: 30));

            var command = Command(
                purpose: "Slab pouring",
                items: new[]
                {
                    Item(CementId, quantity: 20, conversionRate: 1),
                    Item(SandId, quantity: 10, conversionRate: 0.5m)
                });

            var result = await _handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Data.Should().Be(GeneratedIssuanceId);
            result.Message.Should().Be("Tạo phiếu xuất kho thành công.");
            VerifyIssuanceSaved("Slab pouring");
            VerifyIssuanceItemsSaved(CementId, SandId);
            VerifyStockUpdated(CementId, -20);
            VerifyStockUpdated(SandId, -20);
            VerifyCommittedAndRealtimeSent();
        }

        [Fact]
        public async Task UTCID02_Handle_ProjectLeaderIssuesExactlyAvailableQuantity_ShouldCreateIssuance()
        {
            SetupProjectLeader();
            SetupTasks(Task());
            SetupInventories(Inventory(CementId, "Cement", quantity: 10));

            var result = await _handler.Handle(Command(items: new[] { Item(CementId, 10) }), CancellationToken.None);

            result.Success.Should().BeTrue();
            VerifyStockUpdated(CementId, -10);
            VerifyCommittedAndRealtimeSent();
        }

        [Fact]
        public async Task UTCID03_Handle_EmptyItems_ShouldThrowBusinessException()
        {
            SetupTechnicalManager();

            var act = async () => await _handler.Handle(Command(items: Array.Empty<CreateMaterialIssuanceItemDto>()), CancellationToken.None);

            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Danh sách vật tư xuất dùng không được để trống.");
            VerifyTransactionNeverStarted();
        }

        [Fact]
        public async Task UTCID04_Handle_TaskNotFound_ShouldThrowNotFoundException()
        {
            SetupTechnicalManager();
            SetupTasks();

            var act = async () => await _handler.Handle(Command(taskId: 999), CancellationToken.None);

            await act.Should().ThrowAsync<NotFoundException>()
                .WithMessage("ProjectTask với ID [999] không tồn tại.");
            VerifyTransactionNeverStarted();
        }

        [Fact]
        public async Task UTCID05_Handle_TaskWithoutProject_ShouldThrowBusinessException()
        {
            SetupTechnicalManager();
            SetupTasks(new ProjectTask { TaskId = TaskId, Phase = null! });

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Không tìm thấy dự án liên kết với công việc này.");
            VerifyTransactionNeverStarted();
        }

        [Fact]
        public async Task UTCID06_Handle_UserIsNeitherTechnicalManagerNorProjectLeader_ShouldThrowForbiddenException()
        {
            SetupStandardUser();
            SetupTasks(Task());

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            await act.Should().ThrowAsync<ForbiddenException>()
                .WithMessage("Chỉ Quản lý Kỹ thuật hoặc Trưởng dự án mới có quyền tạo yêu cầu xuất dùng vật tư.");
            VerifyTransactionNeverStarted();
        }

        [Fact]
        public async Task UTCID07_Handle_ProjectNotInProgress_ShouldThrowBusinessException()
        {
            SetupTechnicalManager();
            SetupTasks(Task(projectStatus: ProjectStatus.Completed));

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Dự án liên kết phải ở trạng thái đang tiến hành (InProgress).");
            VerifyTransactionNeverStarted();
        }

        [Fact]
        public async Task UTCID08_Handle_TaskIsLocked_ShouldThrowBusinessException()
        {
            SetupTechnicalManager();
            SetupTasks(Task(isLocked: true));

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Công việc này đã bị khóa (đã nghiệm thu hoặc hoàn thành). Không thể xuất thêm vật tư.");
            VerifyTransactionNeverStarted();
        }

        [Fact]
        public async Task UTCID09_Handle_MaterialHasNoInventoryEntry_ShouldThrowBusinessException()
        {
            SetupTechnicalManager();
            SetupTasks(Task());
            SetupInventories();

            var act = async () => await _handler.Handle(Command(items: new[] { Item(99, 10) }), CancellationToken.None);

            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Vật tư ID 99 không tồn tại trong kho của dự án.");
            VerifyTransactionNeverStarted();
        }

        [Fact]
        public async Task UTCID10_Handle_DiscreteMaterialWithFractionalQuantity_ShouldThrowBusinessException()
        {
            SetupTechnicalManager();
            SetupTasks(Task());
            SetupInventories(Inventory(CementId, "Precast Panel", quantity: 10, isDiscrete: true, unitName: "Panel"));

            var act = async () => await _handler.Handle(Command(items: new[] { Item(CementId, 1.5m) }), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be(ErrorCodes.InvalidUnitQuantity);
            VerifyTransactionNeverStarted();
        }

        [Fact]
        public async Task UTCID11_Handle_InsufficientAvailableStock_ShouldThrowBusinessException()
        {
            SetupTechnicalManager();
            SetupTasks(Task());
            SetupInventories(
                Inventory(CementId, "Cement", quantity: 100),
                Inventory(SandId, "Sand", quantity: 5));

            var act = async () => await _handler.Handle(Command(items: new[] { Item(CementId, 5), Item(SandId, 10) }), CancellationToken.None);

            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Không đủ tồn kho khả dụng cho vật tư [Sand]. Yêu cầu xuất: 10 Bag, tồn khả dụng còn lại: 5 Bag.");
            VerifyTransactionNeverStarted();
        }

        [Fact]
        public async Task UTCID12_Handle_StockUpdateFails_ShouldRollbackTransactionAndRethrow()
        {
            SetupTechnicalManager();
            SetupTasks(Task());
            SetupInventories(Inventory(CementId, "Cement", quantity: 10));
            _mockInventoryService.Setup(s => s.UpdateStockAsync(
                    It.IsAny<long>(),
                    It.IsAny<long>(),
                    It.IsAny<decimal>(),
                    It.IsAny<byte>(),
                    It.IsAny<long>(),
                    It.IsAny<string>(),
                    It.IsAny<long>(),
                    It.IsAny<CancellationToken>()))
                .ThrowsAsync(new Exception("DB Error"));

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            await act.Should().ThrowAsync<Exception>().WithMessage("DB Error");
            _mockUow.Verify(u => u.RollbackTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        private static CreateMaterialIssuanceCommand Command(
            long taskId = TaskId,
            string purpose = "Purpose",
            IEnumerable<CreateMaterialIssuanceItemDto>? items = null)
            => new(
                taskId,
                purpose,
                items?.ToList() ?? new List<CreateMaterialIssuanceItemDto> { Item(CementId, 5) });

        private static CreateMaterialIssuanceItemDto Item(long materialId, decimal quantity, decimal conversionRate = 1)
            => new(materialId, UnitId, quantity, conversionRate);

        private static ProjectTask Task(bool isLocked = false, string projectStatus = ProjectStatus.InProgress)
            => new()
            {
                TaskId = TaskId,
                IsLocked = isLocked,
                Phase = new Phase
                {
                    Project = new Project { ProjectId = ProjectId, Status = projectStatus }
                }
            };

        private static CurrentInventory Inventory(
            long materialId,
            string materialName,
            decimal quantity,
            decimal reservedQuantity = 0,
            bool isDiscrete = false,
            string unitName = "Bag")
            => new()
            {
                ProjectId = ProjectId,
                MaterialId = materialId,
                Quantity = quantity,
                ReservedQuantity = reservedQuantity,
                Material = new MaterialCatalog
                {
                    MaterialId = materialId,
                    Name = materialName,
                    BaseUnit = new Unit { UnitName = unitName, IsDiscrete = isDiscrete }
                }
            };

        private void SetupTechnicalManager()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.TechnicalManager);
        }

        private void SetupProjectLeader()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.SiteEngineer, hasRole: false);
            SetupProjectMembers(new ProjectMember { ProjectId = ProjectId, UserId = CurrentUserId, IsLeader = true });
        }

        private void SetupStandardUser()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.SiteEngineer, hasRole: false);
            SetupProjectMembers(new ProjectMember { ProjectId = ProjectId, UserId = CurrentUserId, IsLeader = false });
        }

        private void SetupTasks(params ProjectTask[] tasks)
        {
            _mockTaskRepo.Setup(r => r.Query()).Returns(tasks.AsQueryable().BuildMock());
        }

        private void SetupInventories(params CurrentInventory[] inventories)
        {
            _mockInventoryRepo.Setup(r => r.Query()).Returns(inventories.AsQueryable().BuildMock());
        }

        private void SetupProjectMembers(params ProjectMember[] members)
        {
            _mockMemberRepo.Setup(r => r.Query()).Returns(members.AsQueryable().BuildMock());
        }

        private void SetupIssuanceIdGeneration()
        {
            _mockIssuanceRepo.Setup(r => r.AddAsync(It.IsAny<MaterialIssuance>(), It.IsAny<CancellationToken>()))
                .Callback<MaterialIssuance, CancellationToken>((issuance, _) => issuance.MaterialIssuanceId = GeneratedIssuanceId)
                .Returns(System.Threading.Tasks.Task.CompletedTask);
        }

        private void VerifyIssuanceSaved(string purpose)
        {
            _mockIssuanceRepo.Verify(r => r.AddAsync(It.Is<MaterialIssuance>(issuance =>
                issuance.TaskId == TaskId &&
                issuance.Purpose == purpose &&
                issuance.CreatedBy == CurrentUserId), It.IsAny<CancellationToken>()), Times.Once);
        }

        private void VerifyIssuanceItemsSaved(params long[] materialIds)
        {
            _mockIssuanceItemRepo.Verify(r => r.AddRangeAsync(It.Is<IEnumerable<MaterialIssuanceItem>>(items =>
                materialIds.All(materialId => items.Any(item => item.MaterialId == materialId)) &&
                items.Count() == materialIds.Length), It.IsAny<CancellationToken>()), Times.Once);
        }

        private void VerifyStockUpdated(long materialId, decimal baseQuantityChange)
        {
            _mockInventoryService.Verify(s => s.UpdateStockAsync(
                ProjectId,
                materialId,
                baseQuantityChange,
                InventoryTransactionType.Issuance,
                GeneratedIssuanceId,
                EntityType.MaterialIssuance,
                CurrentUserId,
                It.IsAny<CancellationToken>()), Times.Once);
        }

        private void VerifyCommittedAndRealtimeSent()
        {
            _mockUow.Verify(u => u.BeginTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
            _mockUow.Verify(u => u.CommitTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
            _mockRealtimeSender.Verify(s => s.SendToGroupAsync(
                ProjectGroup, HubMethodNames.MaterialIssuanceChanged, GeneratedIssuanceId, It.IsAny<CancellationToken>()), Times.Once);
            _mockRealtimeSender.Verify(s => s.SendToGroupAsync(
                GlobalInventoryGroup, HubMethodNames.MaterialIssuanceChanged, GeneratedIssuanceId, It.IsAny<CancellationToken>()), Times.Once);
        }

        private void VerifyTransactionNeverStarted()
        {
            _mockUow.Verify(u => u.BeginTransactionAsync(It.IsAny<CancellationToken>()), Times.Never);
            _mockIssuanceRepo.Verify(r => r.AddAsync(It.IsAny<MaterialIssuance>(), It.IsAny<CancellationToken>()), Times.Never);
        }
    }
}
