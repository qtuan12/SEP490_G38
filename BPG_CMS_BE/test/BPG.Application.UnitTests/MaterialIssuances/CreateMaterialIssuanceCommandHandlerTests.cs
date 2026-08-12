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

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IGenericRepository<ProjectTask>> _mockTaskRepo;
        private readonly Mock<IGenericRepository<TaskDependency>> _mockTaskDepRepo;
        private readonly Mock<IGenericRepository<MaterialIssuance>> _mockIssuanceRepo;
        private readonly Mock<IGenericRepository<MaterialIssuanceItem>> _mockIssuanceItemRepo;
        private readonly Mock<IGenericRepository<CurrentInventory>> _mockInventoryRepo;
        private readonly Mock<IGenericRepository<ProjectMember>> _mockMemberRepo;
        private readonly Mock<IGenericRepository<User>> _mockUserRepo;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly CreateMaterialIssuanceCommandHandler _handler;

        public CreateMaterialIssuanceCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockTaskRepo = new Mock<IGenericRepository<ProjectTask>>();
            _mockTaskDepRepo = new Mock<IGenericRepository<TaskDependency>>();
            _mockIssuanceRepo = new Mock<IGenericRepository<MaterialIssuance>>();
            _mockIssuanceItemRepo = new Mock<IGenericRepository<MaterialIssuanceItem>>();
            _mockInventoryRepo = new Mock<IGenericRepository<CurrentInventory>>();
            _mockMemberRepo = new Mock<IGenericRepository<ProjectMember>>();
            _mockUserRepo = new Mock<IGenericRepository<User>>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();

            _mockUow.Setup(u => u.Repository<ProjectTask>()).Returns(_mockTaskRepo.Object);
            _mockUow.Setup(u => u.Repository<TaskDependency>()).Returns(_mockTaskDepRepo.Object);
            _mockUow.Setup(u => u.Repository<MaterialIssuance>()).Returns(_mockIssuanceRepo.Object);
            _mockUow.Setup(u => u.Repository<MaterialIssuanceItem>()).Returns(_mockIssuanceItemRepo.Object);
            _mockUow.Setup(u => u.Repository<CurrentInventory>()).Returns(_mockInventoryRepo.Object);
            _mockUow.Setup(u => u.Repository<ProjectMember>()).Returns(_mockMemberRepo.Object);
            _mockUow.Setup(u => u.Repository<User>()).Returns(_mockUserRepo.Object);
            _mockTaskDepRepo.Setup(r => r.Query()).Returns(new List<TaskDependency>().AsQueryable().BuildMock());
            _mockUow.Setup(u => u.BeginTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
            _mockUow.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
            _mockUow.Setup(u => u.CommitTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
            _mockUow.Setup(u => u.RollbackTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
            _mockIssuanceItemRepo.Setup(r => r.AddRangeAsync(It.IsAny<IEnumerable<MaterialIssuanceItem>>(), It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);

            SetupTasks();
            SetupInventories();
            SetupProjectLeader();
            SetupUsers(new User { UserId = CurrentUserId, FullName = "Current User" });
            SetupIssuanceIdGeneration();

            _handler = new CreateMaterialIssuanceCommandHandler(
                _mockUow.Object,
                _mockCurrentUserService.Object,
                ServiceStubFactory.InventoryService(),
                ServiceStubFactory.RealtimeSender(),
                ServiceStubFactory.NotificationService());
        }

        [Fact]
        public async Task UTCID01_Handle_TechnicalManagerWithValidRequest_ShouldReturnCreatedIssuanceId()
        {
            SetupTechnicalManager();
            SetupTasks(ProjectTask());
            SetupInventories(Inventory(CementId, "Cement", quantity: 20));

            var result = await _handler.Handle(Command(items: new[] { Item(CementId, 5) }), CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Data.Should().Be(GeneratedIssuanceId);
            result.Message.Should().Be("Tạo phiếu xuất kho thành công.");
        }

        [Fact]
        public async Task Handle_ClientConversionRateIsSpoofedForBaseUnit_ShouldStoreRateOne()
        {
            SetupTechnicalManager();
            SetupTasks(ProjectTask());
            SetupInventories(Inventory(CementId, "Cement", quantity: 20));
            List<MaterialIssuanceItem>? savedItems = null;
            _mockIssuanceItemRepo
                .Setup(repo => repo.AddRangeAsync(It.IsAny<IEnumerable<MaterialIssuanceItem>>(), It.IsAny<CancellationToken>()))
                .Callback<IEnumerable<MaterialIssuanceItem>, CancellationToken>((items, _) => savedItems = items.ToList())
                .Returns(Task.CompletedTask);

            await _handler.Handle(Command(items: new[] { Item(CementId, 5, conversionRate: 999) }), CancellationToken.None);

            savedItems.Should().ContainSingle().Which.ConversionRate.Should().Be(1);
        }

        [Fact]
        public async Task UTCID02_Handle_EmptyItems_ShouldThrowBusinessException()
        {
            SetupTechnicalManager();

            var act = async () => await _handler.Handle(Command(items: Array.Empty<CreateMaterialIssuanceItemDto>()), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_EMPTY_ITEMS");
            exception.Which.Message.Should().Be("Danh sách vật tư xuất dùng không được để trống.");
        }

        [Fact]
        public async Task UTCID03_Handle_TaskNotFound_ShouldThrowNotFoundException()
        {
            SetupTechnicalManager();
            SetupTasks();

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<NotFoundException>();
            exception.Which.ErrorCode.Should().Be("BIZ_001");
            exception.Which.Message.Should().Be("Công việc với ID [100] không tồn tại.");
        }

        [Fact]
        public async Task UTCID04_Handle_TaskWithoutProject_ShouldThrowBusinessException()
        {
            SetupTechnicalManager();
            SetupTasks(new ProjectTask { TaskId = TaskId, Phase = null!, Assignees = new List<TaskAssignee>() });

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_PROJECT_NOT_FOUND");
            exception.Which.Message.Should().Be("Không tìm thấy dự án liên kết với công việc này.");
        }

        [Fact]
        public async Task UTCID05_Handle_UserIsNotTechnicalManagerOrProjectLeader_ShouldThrowForbiddenException()
        {
            SetupStandardUser();
            SetupTasks(ProjectTask());

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<ForbiddenException>();
            exception.Which.ErrorCode.Should().Be("AUTH_002");
            exception.Which.Message.Should().Be("Chỉ Trưởng dự án mới được tạo phiếu xuất vật tư.");
        }

        [Fact]
        public async Task UTCID06_Handle_ProjectLeaderWithValidRequest_ShouldReturnCreatedIssuanceId()
        {
            SetupProjectLeader();
            SetupTasks(ProjectTask());
            SetupInventories(Inventory(CementId, "Cement", quantity: 20));

            var result = await _handler.Handle(Command(items: new[] { Item(CementId, 5) }), CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Data.Should().Be(GeneratedIssuanceId);
        }

        [Fact]
        public async Task UTCID07_Handle_ProjectNotInProgress_ShouldThrowBusinessException()
        {
            SetupTechnicalManager();
            SetupTasks(ProjectTask(projectStatus: ProjectStatus.Completed));

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_PROJECT_NOT_ACTIVE");
            exception.Which.Message.Should().Be("Dự án liên kết phải ở trạng thái đang tiến hành (InProgress).");
        }

        [Fact]
        public async Task UTCID08_Handle_TaskIsLocked_ShouldThrowBusinessException()
        {
            SetupTechnicalManager();
            SetupTasks(ProjectTask(isLocked: true));

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_TASK_INACTIVE");
            exception.Which.Message.Should().Be("Không thể xuất kho cho công việc đã bị dừng, tạm dừng, hoàn thành hoặc đã bị hủy.");
        }

        [Fact]
        public async Task UTCID09_Handle_MaterialHasNoInventoryEntry_ShouldThrowBusinessException()
        {
            SetupTechnicalManager();
            SetupTasks(ProjectTask());
            SetupInventories();

            var act = async () => await _handler.Handle(Command(items: new[] { Item(99, 10) }), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_NO_INVENTORY");
            exception.Which.Message.Should().Be("Vật tư ID 99 không tồn tại trong kho của dự án.");
        }

        [Fact]
        public async Task UTCID10_Handle_DiscreteMaterialWithFractionalQuantity_ShouldThrowBusinessException()
        {
            SetupTechnicalManager();
            SetupTasks(ProjectTask());
            SetupInventories(Inventory(CementId, "Precast Panel", quantity: 10, isDiscrete: true, unitName: "Panel"));

            var act = async () => await _handler.Handle(Command(items: new[] { Item(CementId, 1.5m) }), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be(ErrorCodes.InvalidUnitQuantity);
            exception.Which.Message.Should().Be("Đơn vị tính 'Panel' của vật tư [Precast Panel] yêu cầu số lượng xuất phải là số nguyên.");
        }

        [Fact]
        public async Task UTCID11_Handle_InsufficientAvailableStock_ShouldThrowBusinessException()
        {
            SetupTechnicalManager();
            SetupTasks(ProjectTask());
            SetupInventories(
                Inventory(CementId, "Cement", quantity: 100),
                Inventory(SandId, "Sand", quantity: 5));

            var act = async () => await _handler.Handle(Command(items: new[] { Item(CementId, 5), Item(SandId, 10) }), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_INSUFFICIENT_STOCK");
            exception.Which.Message.Should().Be("Không đủ tồn kho khả dụng cho vật tư [Sand]. Yêu cầu xuất: 10 Bag, tồn khả dụng còn lại: 5 Bag.");
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

        private static ProjectTask ProjectTask(bool isLocked = false, string projectStatus = ProjectStatus.InProgress)
            => new()
            {
                TaskId = TaskId,
                IsLocked = isLocked,
                Assignees = new List<TaskAssignee>(),
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
                    BaseUnitId = UnitId,
                    BaseUnit = new Unit { UnitId = UnitId, UnitName = unitName, IsDiscrete = isDiscrete }
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
            _mockMemberRepo.Setup(r => r.AnyAsync(It.IsAny<System.Linq.Expressions.Expression<System.Func<ProjectMember, bool>>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync((System.Linq.Expressions.Expression<System.Func<ProjectMember, bool>> predicate, CancellationToken ct) =>
                {
                    return members.AsQueryable().Any(predicate);
                });
        }

        private void SetupUsers(params User[] users)
        {
            _mockUserRepo.Setup(r => r.Query()).Returns(users.AsQueryable().BuildMock());
        }

        private void SetupIssuanceIdGeneration()
        {
            _mockIssuanceRepo.Setup(r => r.AddAsync(It.IsAny<MaterialIssuance>(), It.IsAny<CancellationToken>()))
                .Callback<MaterialIssuance, CancellationToken>((issuance, _) => issuance.MaterialIssuanceId = GeneratedIssuanceId)
                .Returns(System.Threading.Tasks.Task.CompletedTask);
        }
    }
}

