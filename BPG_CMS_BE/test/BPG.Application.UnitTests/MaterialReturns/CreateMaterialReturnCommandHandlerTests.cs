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
        private readonly Mock<IInventoryService> _mockInventoryService;
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
            _mockInventoryService = new Mock<IInventoryService>();

            _mockUow.Setup(u => u.Repository<MaterialIssuance>()).Returns(_mockIssuanceRepo.Object);
            _mockUow.Setup(u => u.Repository<ProjectMember>()).Returns(_mockMemberRepo.Object);
            _mockUow.Setup(u => u.Repository<User>()).Returns(_mockUserRepo.Object);
            _mockUow.Setup(u => u.Repository<MaterialReturn>()).Returns(_mockReturnRepo.Object);
            _mockUow.Setup(u => u.Repository<MaterialReturnItem>()).Returns(_mockReturnItemRepo.Object);

            SetupIssuances();
            SetupPreviousReturnItems();
            SetupProjectMembers();
            SetupUsers(new User { UserId = CurrentUserId, FullName = "Current User" });
            SetupReturnIdGeneration();

            _handler = new CreateMaterialReturnCommandHandler(
                _mockUow.Object,
                _mockCurrentUserService.Object,
                _mockInventoryService.Object,
                ServiceStubFactory.RealtimeSender(),
                ServiceStubFactory.NotificationService());
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
        }

        [Fact]
        public async Task UTCID02_Handle_ProjectLeaderReturnsExactlyRemainingQuantity_ShouldCreateReturn()
        {
            SetupProjectLeader();
            SetupIssuances(Issuance(IssuanceItem(CementId, quantity: 10)));
            SetupPreviousReturnItems(PreviousReturnItem(CementId, quantity: 4));

            var result = await _handler.Handle(Command(items: new[] { Item(CementId, 6) }), CancellationToken.None);

            result.Success.Should().BeTrue();
            result.Data.Should().Be(GeneratedReturnId);
            result.Message.Should().Contain("Tạo phiếu hoàn trả");
        }

        [Fact]
        public async Task UTCID03_Handle_EmptyItems_ShouldThrowBusinessException()
        {
            SetupTechnicalManager();

            var act = async () => await _handler.Handle(Command(items: Array.Empty<ReturnItemDto>()), CancellationToken.None);

            await act.Should().ThrowAsync<BusinessException>();
        }

        [Fact]
        public async Task UTCID04_Handle_OriginalIssuanceNotFound_ShouldThrowNotFoundException()
        {
            SetupTechnicalManager();
            SetupIssuances();

            var act = async () => await _handler.Handle(Command(originalIssuanceId: 999), CancellationToken.None);

            await act.Should().ThrowAsync<NotFoundException>();
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

            await act.Should().ThrowAsync<BusinessException>();
        }

        [Fact]
        public async Task UTCID06_Handle_ProjectNotInProgress_ShouldThrowBusinessException()
        {
            SetupTechnicalManager();
            SetupIssuances(Issuance(ProjectStatus.Completed, IssuanceItem(CementId, 10)));

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            await act.Should().ThrowAsync<BusinessException>();
        }

        [Fact]
        public async Task UTCID07_Handle_UserIsNeitherTechnicalManagerNorProjectLeader_ShouldThrowForbiddenException()
        {
            SetupStandardUser();
            SetupIssuances(Issuance(IssuanceItem(CementId, 10)));

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            await act.Should().ThrowAsync<ForbiddenException>();
        }

        [Fact]
        public async Task UTCID08_Handle_MaterialNotInOriginalIssuance_ShouldThrowBusinessException()
        {
            SetupTechnicalManager();
            SetupIssuances(Issuance(IssuanceItem(CementId, 30)));

            var act = async () => await _handler.Handle(Command(items: new[] { Item(99, 5) }), CancellationToken.None);

            await act.Should().ThrowAsync<BusinessException>();
        }

        [Fact]
        public async Task UTCID09_Handle_ReturnQuantityIsZero_ShouldThrowBusinessException()
        {
            SetupTechnicalManager();
            SetupIssuances(Issuance(IssuanceItem(CementId, 30)));

            var act = async () => await _handler.Handle(Command(items: new[] { Item(CementId, 0) }), CancellationToken.None);

            await act.Should().ThrowAsync<BusinessException>();
        }

        [Fact]
        public async Task UTCID10_Handle_ReturnQuantityExceedsIssuedQuantity_ShouldThrowBusinessException()
        {
            SetupTechnicalManager();
            SetupIssuances(Issuance(IssuanceItem(CementId, 10)));

            var act = async () => await _handler.Handle(Command(items: new[] { Item(CementId, 15) }), CancellationToken.None);

            await act.Should().ThrowAsync<BusinessException>();
        }

        [Fact]
        public async Task UTCID11_Handle_CumulativeReturnExceedsRemainingQuantity_ShouldThrowBusinessException()
        {
            SetupTechnicalManager();
            SetupIssuances(Issuance(IssuanceItem(CementId, 10)));
            SetupPreviousReturnItems(PreviousReturnItem(CementId, quantity: 6));

            var act = async () => await _handler.Handle(Command(items: new[] { Item(CementId, 5) }), CancellationToken.None);

            await act.Should().ThrowAsync<BusinessException>();
        }

        [Fact]
        public async Task UTCID12_Handle_StockUpdateFails_ShouldThrowException()
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

            await act.Should().ThrowAsync<Exception>();
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

