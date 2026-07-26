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
        private const string ProjectGroup = "Project_5";
        private const string GlobalInventoryGroup = "Project_0";

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IGenericRepository<MaterialIssuance>> _mockIssuanceRepo;
        private readonly Mock<IGenericRepository<MaterialReturn>> _mockReturnRepo;
        private readonly Mock<IGenericRepository<MaterialReturnItem>> _mockReturnItemRepo;
        private readonly Mock<IGenericRepository<ProjectMember>> _mockMemberRepo;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly Mock<IInventoryService> _mockInventoryService;
        private readonly Mock<IRealtimeNotificationSender> _mockRealtimeSender;
        private readonly CreateMaterialReturnCommandHandler _handler;

        public CreateMaterialReturnCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockIssuanceRepo = new Mock<IGenericRepository<MaterialIssuance>>();
            _mockReturnRepo = new Mock<IGenericRepository<MaterialReturn>>();
            _mockReturnItemRepo = new Mock<IGenericRepository<MaterialReturnItem>>();
            _mockMemberRepo = new Mock<IGenericRepository<ProjectMember>>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();
            _mockInventoryService = new Mock<IInventoryService>();
            _mockRealtimeSender = new Mock<IRealtimeNotificationSender>();

            _mockUow.Setup(u => u.Repository<MaterialIssuance>()).Returns(_mockIssuanceRepo.Object);
            _mockUow.Setup(u => u.Repository<ProjectMember>()).Returns(_mockMemberRepo.Object);
            _mockUow.Setup(u => u.Repository<MaterialReturn>()).Returns(_mockReturnRepo.Object);
            _mockUow.Setup(u => u.Repository<MaterialReturnItem>()).Returns(_mockReturnItemRepo.Object);

            SetupIssuances();
            SetupPreviousReturnItems();
            SetupProjectMembers();
            SetupReturnIdGeneration();

            _handler = new CreateMaterialReturnCommandHandler(
                _mockUow.Object,
                _mockCurrentUserService.Object,
                _mockInventoryService.Object,
                _mockRealtimeSender.Object);
        }

        [Fact]
        public async Task UTCID01_Handle_TechnicalManagerReturnsMaterialsWithConversion_ShouldCreateReturn()
        {
            SetupTechnicalManager();
            SetupIssuances(Issuance(
                IssuanceItem(CementId, quantity: 30, conversionRate: 1),
                IssuanceItem(SandId, quantity: 10, conversionRate: 0.5m)));

            var command = Command(
                reason: "Excess materials",
                items: new[]
                {
                    Item(CementId, quantity: 10, conversionRate: 1),
                    Item(SandId, quantity: 5, conversionRate: 0.5m)
                });

            var result = await _handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Data.Should().Be(GeneratedReturnId);
            result.Message.Should().Contain("Tạo phiếu hoàn trả");
            VerifyReturnSaved("Excess materials");
            VerifyReturnItemsSaved(CementId, SandId);
            VerifyStockUpdated(CementId, 10);
            VerifyStockUpdated(SandId, 10);
            VerifyCommittedAndRealtimeSent();
        }

        [Fact]
        public async Task UTCID02_Handle_ProjectLeaderReturnsExactlyRemainingQuantity_ShouldCreateReturn()
        {
            SetupProjectLeader();
            SetupIssuances(Issuance(IssuanceItem(CementId, quantity: 10)));
            SetupPreviousReturnItems(PreviousReturnItem(CementId, quantity: 4));

            var result = await _handler.Handle(Command(items: new[] { Item(CementId, 6) }), CancellationToken.None);

            result.Success.Should().BeTrue();
            VerifyStockUpdated(CementId, 6);
            VerifyCommittedAndRealtimeSent();
        }

        [Fact]
        public async Task UTCID03_Handle_EmptyItems_ShouldThrowBusinessException()
        {
            SetupTechnicalManager();

            var act = async () => await _handler.Handle(Command(items: Array.Empty<ReturnItemDto>()), CancellationToken.None);

            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Danh sách vật tư hoàn trả không được để trống.");
            VerifyTransactionNeverStarted();
        }

        [Fact]
        public async Task UTCID04_Handle_OriginalIssuanceNotFound_ShouldThrowNotFoundException()
        {
            SetupTechnicalManager();
            SetupIssuances();

            var act = async () => await _handler.Handle(Command(originalIssuanceId: 999), CancellationToken.None);

            await act.Should().ThrowAsync<NotFoundException>()
                .WithMessage("MaterialIssuance với ID [999] không tồn tại.");
            VerifyTransactionNeverStarted();
        }

        [Fact]
        public async Task UTCID05_Handle_IssuanceWithoutProject_ShouldThrowBusinessException()
        {
            SetupTechnicalManager();
            SetupIssuances(new MaterialIssuance
            {
                MaterialIssuanceId = OriginalIssuanceId,
                Task = new ProjectTask { Phase = null! },
                Items = new List<MaterialIssuanceItem> { IssuanceItem(CementId, 10) }
            });

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Không tìm thấy dự án liên kết với phiếu xuất kho này.");
            VerifyTransactionNeverStarted();
        }

        [Fact]
        public async Task UTCID06_Handle_ProjectNotInProgress_ShouldThrowBusinessException()
        {
            SetupTechnicalManager();
            SetupIssuances(Issuance(ProjectStatus.Completed, IssuanceItem(CementId, 10)));

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Dự án phải ở trạng thái đang tiến hành để hoàn trả vật tư.");
            VerifyTransactionNeverStarted();
        }

        [Fact]
        public async Task UTCID07_Handle_UserIsNeitherTechnicalManagerNorProjectLeader_ShouldThrowForbiddenException()
        {
            SetupStandardUser();
            SetupIssuances(Issuance(IssuanceItem(CementId, 10)));

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            await act.Should().ThrowAsync<ForbiddenException>()
                .WithMessage("Chỉ Quản lý Kỹ thuật hoặc Trưởng dự án mới có quyền tạo yêu cầu xuất dùng vật tư.");
            VerifyTransactionNeverStarted();
        }

        [Fact]
        public async Task UTCID08_Handle_MaterialNotInOriginalIssuance_ShouldThrowBusinessException()
        {
            SetupTechnicalManager();
            SetupIssuances(Issuance(IssuanceItem(CementId, 30)));

            var act = async () => await _handler.Handle(Command(items: new[] { Item(99, 5) }), CancellationToken.None);

            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Vật tư ID 99 không có trong phiếu xuất kho gốc #PXK-500. Chỉ được hoàn trả vật tư đã xuất.");
            VerifyTransactionNeverStarted();
        }

        [Fact]
        public async Task UTCID09_Handle_ReturnQuantityIsZero_ShouldThrowBusinessException()
        {
            SetupTechnicalManager();
            SetupIssuances(Issuance(IssuanceItem(CementId, 30)));

            var act = async () => await _handler.Handle(Command(items: new[] { Item(CementId, 0) }), CancellationToken.None);

            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Số lượng hoàn trả phải lớn hơn 0.");
            VerifyTransactionNeverStarted();
        }

        [Fact]
        public async Task UTCID10_Handle_ReturnQuantityExceedsIssuedQuantity_ShouldThrowBusinessException()
        {
            SetupTechnicalManager();
            SetupIssuances(Issuance(IssuanceItem(CementId, 10)));

            var act = async () => await _handler.Handle(Command(items: new[] { Item(CementId, 15) }), CancellationToken.None);

            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("*Số lượng hoàn trả (15*) vượt quá giới hạn còn lại có thể trả (10*) cho vật tư ID 50*");
            VerifyTransactionNeverStarted();
        }

        [Fact]
        public async Task UTCID11_Handle_CumulativeReturnExceedsRemainingQuantity_ShouldThrowBusinessException()
        {
            SetupTechnicalManager();
            SetupIssuances(Issuance(IssuanceItem(CementId, 10)));
            SetupPreviousReturnItems(PreviousReturnItem(CementId, quantity: 6));

            var act = async () => await _handler.Handle(Command(items: new[] { Item(CementId, 5) }), CancellationToken.None);

            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("*Số lượng hoàn trả (5*) vượt quá giới hạn còn lại có thể trả (4*) cho vật tư ID 50*");
            VerifyTransactionNeverStarted();
        }

        [Fact]
        public async Task UTCID12_Handle_StockUpdateFails_ShouldRollbackTransactionAndRethrow()
        {
            SetupTechnicalManager();
            SetupIssuances(Issuance(IssuanceItem(CementId, 10)));
            _mockInventoryService.Setup(s => s.UpdateStockAsync(
                    It.IsAny<long>(),
                    It.IsAny<long>(),
                    It.IsAny<decimal>(),
                    It.IsAny<byte>(),
                    It.IsAny<long>(),
                    It.IsAny<string>(),
                    It.IsAny<long>(),
                    It.IsAny<CancellationToken>()))
                .ThrowsAsync(new Exception("DB Connection Timeout"));

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            await act.Should().ThrowAsync<Exception>().WithMessage("DB Connection Timeout");
            _mockUow.Verify(u => u.RollbackTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
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
        }

        private void SetupReturnIdGeneration()
        {
            _mockReturnRepo.Setup(r => r.AddAsync(It.IsAny<MaterialReturn>(), It.IsAny<CancellationToken>()))
                .Callback<MaterialReturn, CancellationToken>((materialReturn, _) => materialReturn.MaterialReturnId = GeneratedReturnId)
                .Returns(System.Threading.Tasks.Task.CompletedTask);
        }

        private void VerifyReturnSaved(string reason)
        {
            _mockReturnRepo.Verify(r => r.AddAsync(It.Is<MaterialReturn>(materialReturn =>
                materialReturn.OriginalIssuanceId == OriginalIssuanceId &&
                materialReturn.Reason == reason &&
                materialReturn.CreatedBy == CurrentUserId), It.IsAny<CancellationToken>()), Times.Once);
        }

        private void VerifyReturnItemsSaved(params long[] materialIds)
        {
            _mockReturnItemRepo.Verify(r => r.AddRangeAsync(It.Is<IEnumerable<MaterialReturnItem>>(items =>
                materialIds.All(materialId => items.Any(item => item.MaterialId == materialId)) &&
                items.Count() == materialIds.Length), It.IsAny<CancellationToken>()), Times.Once);
        }

        private void VerifyStockUpdated(long materialId, decimal baseQuantityChange)
        {
            _mockInventoryService.Verify(s => s.UpdateStockAsync(
                ProjectId,
                materialId,
                baseQuantityChange,
                InventoryTransactionType.IssuanceReturn,
                GeneratedReturnId,
                EntityType.MaterialReturn,
                CurrentUserId,
                It.IsAny<CancellationToken>()), Times.Once);
        }

        private void VerifyCommittedAndRealtimeSent()
        {
            _mockUow.Verify(u => u.BeginTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
            _mockUow.Verify(u => u.CommitTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
            _mockRealtimeSender.Verify(s => s.SendToGroupAsync(
                ProjectGroup, HubMethodNames.MaterialReturnChanged, GeneratedReturnId, It.IsAny<CancellationToken>()), Times.Once);
            _mockRealtimeSender.Verify(s => s.SendToGroupAsync(
                GlobalInventoryGroup, HubMethodNames.MaterialReturnChanged, GeneratedReturnId, It.IsAny<CancellationToken>()), Times.Once);
        }

        private void VerifyTransactionNeverStarted()
        {
            _mockUow.Verify(u => u.BeginTransactionAsync(It.IsAny<CancellationToken>()), Times.Never);
            _mockReturnRepo.Verify(r => r.AddAsync(It.IsAny<MaterialReturn>(), It.IsAny<CancellationToken>()), Times.Never);
        }
    }
}
