using BPG.Application.Features.MaterialReturns.Commands;
using BPG.Application.Features.MaterialReturns.Handlers;
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

namespace BPG.Application.UnitTests.MaterialReturns
{
    public class CreateMaterialReturnCommandHandlerTests
    {
        private const long CurrentUserId = 10;
        private const long ProjectId = 5;
        private const long OriginalIssuanceId = 500;
        private const long GeneratedReturnId = 700;
        private const long CementId = 50;
        private const long SandId = 51;
        private const int UnitId = 1;

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IGenericRepository<MaterialIssuance>> _mockIssuanceRepo;
        private readonly Mock<IGenericRepository<MaterialReturn>> _mockReturnRepo;
        private readonly Mock<IGenericRepository<MaterialReturnItem>> _mockReturnItemRepo;
        private readonly Mock<IGenericRepository<ProjectMember>> _mockMemberRepo;
        private readonly Mock<IGenericRepository<User>> _mockUserRepo;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly CreateMaterialReturnCommandHandler _handler;

        public CreateMaterialReturnCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockIssuanceRepo = new Mock<IGenericRepository<MaterialIssuance>>();
            _mockReturnRepo = new Mock<IGenericRepository<MaterialReturn>>();
            _mockReturnItemRepo = new Mock<IGenericRepository<MaterialReturnItem>>();
            _mockMemberRepo = new Mock<IGenericRepository<ProjectMember>>();
            _mockUserRepo = new Mock<IGenericRepository<User>>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();

            _mockUow.Setup(u => u.Repository<MaterialIssuance>()).Returns(_mockIssuanceRepo.Object);
            _mockUow.Setup(u => u.Repository<ProjectMember>()).Returns(_mockMemberRepo.Object);
            _mockUow.Setup(u => u.Repository<User>()).Returns(_mockUserRepo.Object);
            _mockUow.Setup(u => u.Repository<MaterialReturn>()).Returns(_mockReturnRepo.Object);
            _mockUow.Setup(u => u.Repository<MaterialReturnItem>()).Returns(_mockReturnItemRepo.Object);
            _mockUow.Setup(u => u.BeginTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
            _mockUow.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
            _mockUow.Setup(u => u.CommitTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
            _mockUow.Setup(u => u.RollbackTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
            _mockReturnItemRepo.Setup(r => r.AddRangeAsync(It.IsAny<IEnumerable<MaterialReturnItem>>(), It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);

            SetupIssuances();
            SetupPreviousReturnItems();
            SetupProjectMembers();
            SetupUsers(new User { UserId = CurrentUserId, FullName = "Current User" });
            SetupReturnIdGeneration();

            _handler = new CreateMaterialReturnCommandHandler(
                _mockUow.Object,
                _mockCurrentUserService.Object,
                ServiceStubFactory.InventoryService(),
                ServiceStubFactory.RealtimeSender(),
                ServiceStubFactory.NotificationService());
        }

        [Fact]
        public async Task UTCID01_Handle_TechnicalManagerWithValidRequest_ShouldReturnCreatedReturnId()
        {
            SetupTechnicalManager();
            SetupIssuances(Issuance(IssuanceItem(CementId, 30)));

            var result = await _handler.Handle(Command(items: new[] { Item(CementId, 5) }), CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Data.Should().Be(GeneratedReturnId);
            result.Message.Should().StartWith("Tạo phiếu hoàn trả PTra-");
            result.Message.Should().EndWith("thành công. Tồn kho đã được cập nhật.");
        }

        [Fact]
        public async Task UTCID02_Handle_EmptyItems_ShouldThrowBusinessException()
        {
            SetupTechnicalManager();

            var act = async () => await _handler.Handle(Command(items: Array.Empty<ReturnItemDto>()), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_EMPTY_ITEMS");
            exception.Which.Message.Should().Be("Danh sách vật tư hoàn trả không được để trống.");
        }

        [Fact]
        public async Task UTCID03_Handle_OriginalIssuanceNotFound_ShouldThrowNotFoundException()
        {
            SetupTechnicalManager();
            SetupIssuances();

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<NotFoundException>();
            exception.Which.ErrorCode.Should().Be("BIZ_001");
            exception.Which.Message.Should().Be("MaterialIssuance với ID [500] không tồn tại.");
        }

        [Fact]
        public async Task UTCID04_Handle_IssuanceWithoutProject_ShouldThrowBusinessException()
        {
            SetupTechnicalManager();
            SetupIssuances(new MaterialIssuance
            {
                MaterialIssuanceId = OriginalIssuanceId,
                IssuanceNo = "PXK-500",
                Task = new ProjectTask
                {
                    TaskId = 100,
                    Phase = null!,
                    Assignees = new List<TaskAssignee>()
                },
                Items = new List<MaterialIssuanceItem> { IssuanceItem(CementId, 30) }
            });

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_PROJECT_NOT_FOUND");
            exception.Which.Message.Should().Be("Không tìm thấy dự án liên kết với phiếu xuất kho này.");
        }

        [Fact]
        public async Task UTCID05_Handle_UserIsNotTechnicalManagerOrProjectLeader_ShouldThrowForbiddenException()
        {
            SetupStandardUser();
            SetupIssuances(Issuance(IssuanceItem(CementId, 30)));

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<ForbiddenException>();
            exception.Which.ErrorCode.Should().Be("AUTH_002");
            exception.Which.Message.Should().Be("Chỉ Trưởng dự án mới được tạo phiếu hoàn trả vật tư.");
        }

        [Fact]
        public async Task UTCID06_Handle_ProjectNotInProgress_ShouldThrowBusinessException()
        {
            SetupTechnicalManager();
            SetupIssuances(Issuance(ProjectStatus.Completed, IssuanceItem(CementId, 30)));

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_PROJECT_NOT_ACTIVE");
            exception.Which.Message.Should().Be("Dự án phải ở trạng thái đang tiến hành để hoàn trả vật tư.");
        }

        [Fact]
        public async Task UTCID07_Handle_ProjectLeaderWithValidRequest_ShouldReturnCreatedReturnId()
        {
            SetupProjectLeader();
            SetupIssuances(Issuance(IssuanceItem(CementId, 30)));

            var result = await _handler.Handle(Command(items: new[] { Item(CementId, 5) }), CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Data.Should().Be(GeneratedReturnId);
        }

        [Fact]
        public async Task UTCID08_Handle_MaterialNotInOriginalIssuance_ShouldThrowBusinessException()
        {
            SetupTechnicalManager();
            SetupIssuances(Issuance(IssuanceItem(CementId, 30)));

            var act = async () => await _handler.Handle(Command(items: new[] { Item(99, 5) }), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_MATERIAL_NOT_IN_ISSUANCE");
            exception.Which.Message.Should().Be("Vật tư ID 99 không có trong phiếu xuất kho gốc #PXK-500. Chỉ được hoàn trả vật tư đã xuất.");
        }

        [Fact]
        public async Task UTCID09_Handle_ReturnQuantityIsZero_ShouldThrowBusinessException()
        {
            SetupTechnicalManager();
            SetupIssuances(Issuance(IssuanceItem(CementId, 30)));

            var act = async () => await _handler.Handle(Command(items: new[] { Item(CementId, 0) }), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_INVALID_QUANTITY");
            exception.Which.Message.Should().Be("Số lượng hoàn trả phải lớn hơn 0.");
        }

        [Fact]
        public async Task UTCID10_Handle_ReturnQuantityExceedsIssuedQuantity_ShouldThrowBusinessException()
        {
            SetupTechnicalManager();
            SetupIssuances(Issuance(IssuanceItem(CementId, 10)));

            var act = async () => await _handler.Handle(Command(items: new[] { Item(CementId, 15) }), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_RETURN_EXCEEDS_ISSUED");
            exception.Which.Message.Should().Be("Số lượng hoàn trả (15) vượt quá giới hạn còn lại có thể trả (10) cho vật tư ID 50 (Tổng xuất: 10, Đã trả trước đó: 0) trong phiếu xuất #PXK-500.");
        }

        [Fact]
        public async Task UTCID11_Handle_CumulativeReturnExceedsRemainingQuantity_ShouldThrowBusinessException()
        {
            SetupTechnicalManager();
            SetupIssuances(Issuance(IssuanceItem(CementId, 10)));
            SetupPreviousReturnItems(PreviousReturnItem(CementId, quantity: 6));

            var act = async () => await _handler.Handle(Command(items: new[] { Item(CementId, 5) }), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_RETURN_EXCEEDS_ISSUED");
            exception.Which.Message.Should().Be("Số lượng hoàn trả (5) vượt quá giới hạn còn lại có thể trả (4) cho vật tư ID 50 (Tổng xuất: 10, Đã trả trước đó: 6) trong phiếu xuất #PXK-500.");
        }

        private static CreateMaterialReturnCommand Command(
            long originalIssuanceId = OriginalIssuanceId,
            string reason = "Reason",
            IEnumerable<ReturnItemDto>? items = null)
            => new(
                originalIssuanceId,
                reason,
                items?.ToList() ?? new List<ReturnItemDto> { Item(CementId, 5) });

        private static ReturnItemDto Item(long materialId, decimal quantity, decimal conversionRate = 1)
            => new(materialId, UnitId, quantity, conversionRate);

        private static MaterialIssuance Issuance(params MaterialIssuanceItem[] items)
            => Issuance(ProjectStatus.InProgress, items);

        private static MaterialIssuance Issuance(string projectStatus, params MaterialIssuanceItem[] items)
            => new()
            {
                MaterialIssuanceId = OriginalIssuanceId,
                IssuanceNo = "PXK-500",
                Task = new ProjectTask
                {
                    TaskId = 100,
                    Assignees = new List<TaskAssignee>(),
                    Phase = new Phase
                    {
                        Project = new Project { ProjectId = ProjectId, Status = projectStatus }
                    }
                },
                Items = items.ToList()
            };

        private static MaterialIssuanceItem IssuanceItem(long materialId, decimal quantity, decimal conversionRate = 1)
            => new()
            {
                MaterialId = materialId,
                UnitId = UnitId,
                Quantity = quantity,
                ConversionRate = conversionRate
            };

        private static MaterialReturnItem PreviousReturnItem(long materialId, decimal quantity, decimal conversionRate = 1)
            => new()
            {
                MaterialId = materialId,
                Quantity = quantity,
                ConversionRate = conversionRate,
                Return = new MaterialReturn { OriginalIssuanceId = OriginalIssuanceId, IsDeleted = false }
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

        private void SetupIssuances(params MaterialIssuance[] issuances)
        {
            _mockIssuanceRepo.Setup(r => r.Query()).Returns(issuances.AsQueryable().BuildMock());
        }

        private void SetupPreviousReturnItems(params MaterialReturnItem[] returnItems)
        {
            _mockReturnItemRepo.Setup(r => r.Query()).Returns(returnItems.AsQueryable().BuildMock());
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

        private void SetupReturnIdGeneration()
        {
            _mockReturnRepo.Setup(r => r.AddAsync(It.IsAny<MaterialReturn>(), It.IsAny<CancellationToken>()))
                .Callback<MaterialReturn, CancellationToken>((materialReturn, _) => materialReturn.MaterialReturnId = GeneratedReturnId)
                .Returns(System.Threading.Tasks.Task.CompletedTask);
        }
    }
}

