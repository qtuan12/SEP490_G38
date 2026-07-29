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
            _mockIssuanceRepo = new Mock<IGenericRepository<MaterialIssuance>>();
            _mockIssuanceItemRepo = new Mock<IGenericRepository<MaterialIssuanceItem>>();
            _mockInventoryRepo = new Mock<IGenericRepository<CurrentInventory>>();
            _mockMemberRepo = new Mock<IGenericRepository<ProjectMember>>();
            _mockUserRepo = new Mock<IGenericRepository<User>>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();

            _mockUow.Setup(u => u.Repository<ProjectTask>()).Returns(_mockTaskRepo.Object);
            _mockUow.Setup(u => u.Repository<MaterialIssuance>()).Returns(_mockIssuanceRepo.Object);
            _mockUow.Setup(u => u.Repository<MaterialIssuanceItem>()).Returns(_mockIssuanceItemRepo.Object);
            _mockUow.Setup(u => u.Repository<CurrentInventory>()).Returns(_mockInventoryRepo.Object);
            _mockUow.Setup(u => u.Repository<ProjectMember>()).Returns(_mockMemberRepo.Object);
            _mockUow.Setup(u => u.Repository<User>()).Returns(_mockUserRepo.Object);
            _mockUow.Setup(u => u.BeginTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
            _mockUow.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
            _mockUow.Setup(u => u.CommitTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
            _mockUow.Setup(u => u.RollbackTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
            _mockIssuanceItemRepo.Setup(r => r.AddRangeAsync(It.IsAny<IEnumerable<MaterialIssuanceItem>>(), It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);

            SetupTasks();
            SetupInventories();
            SetupProjectMembers();
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
        public async Task UTCID01_Handle_TechnicalManagerWithValidRequest_ShouldReturnSuccessResponse()
        {
            SetupTechnicalManager();
            SetupTasks(ProjectTask());
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
        }

        [Fact]
        public async Task UTCID02_Handle_ProjectLeaderWithValidRequest_ShouldReturnSuccessResponse()
        {
            SetupProjectLeader();
            SetupTasks(ProjectTask());
            SetupInventories(Inventory(CementId, "Cement", quantity: 10));

            var result = await _handler.Handle(Command(items: new[] { Item(CementId, 10) }), CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Data.Should().Be(GeneratedIssuanceId);
        }

        [Fact]
        public async Task UTCID03_Handle_EmptyItems_ShouldThrowBusinessException()
        {
            SetupTechnicalManager();

            var act = async () => await _handler.Handle(Command(items: Array.Empty<CreateMaterialIssuanceItemDto>()), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_EMPTY_ITEMS");
        }

        [Fact]
        public async Task UTCID04_Handle_TaskNotFound_ShouldThrowNotFoundException()
        {
            SetupTechnicalManager();
            SetupTasks();

            var act = async () => await _handler.Handle(Command(taskId: 999), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<NotFoundException>();
            exception.Which.ErrorCode.Should().Be("BIZ_001");
        }

        [Fact]
        public async Task UTCID05_Handle_TaskWithoutProject_ShouldThrowBusinessException()
        {
            SetupTechnicalManager();
            SetupTasks(new ProjectTask { TaskId = TaskId, Phase = null! });

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_PROJECT_NOT_FOUND");
        }

        [Fact]
        public void UTCID06_Command_ShouldDeclareExecutionPermissionForTaskResource()
        {
            var command = Command();

            command.RequiredPermission.Should().Be(ProjectPermission.ExecutionManage);
            command.ProjectResource.Id.Should().Be(TaskId);
            command.ProjectResource.Type.ToString().Should().Be("Task");
        }
        [Fact]
        public async Task UTCID07_Handle_ProjectNotInProgress_ShouldThrowBusinessException()
        {
            SetupTechnicalManager();
            SetupTasks(ProjectTask(projectStatus: ProjectStatus.Completed));

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_PROJECT_NOT_ACTIVE");
        }

        [Fact]
        public async Task UTCID08_Handle_TaskIsLocked_ShouldThrowBusinessException()
        {
            SetupTechnicalManager();
            SetupTasks(ProjectTask(isLocked: true));

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_TASK_LOCKED");
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

