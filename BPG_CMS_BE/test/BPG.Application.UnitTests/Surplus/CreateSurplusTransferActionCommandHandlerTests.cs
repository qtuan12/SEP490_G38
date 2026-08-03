using BPG.Application.Common.Models;
using BPG.Application.Features.Surplus.Commands;
using BPG.Application.Features.Surplus.Handlers;
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

namespace BPG.Application.UnitTests.Surplus
{
    public class CreateSurplusTransferActionCommandHandlerTests
    {
        private const long CurrentUserId = 10;
        private const long FromProjectId = 5;
        private const long ToProjectId = 6;
        private const long SurplusRequestId = 100;
        private const long SurplusRequestItemId = 200;
        private const long MaterialId = 50;

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly Mock<IGenericRepository<SurplusRequestItem>> _mockRequestItemRepo;
        private readonly Mock<IGenericRepository<SurplusTransfer>> _mockTransferRepo;
        private readonly Mock<IGenericRepository<CurrentInventory>> _mockInventoryRepo;
        private readonly Mock<IGenericRepository<Project>> _mockProjectRepo;
        private readonly Mock<IGenericRepository<ProjectMember>> _mockMemberRepo;
        private readonly Mock<IGenericRepository<SurplusRequest>> _mockRequestRepo;
        private readonly CreateSurplusTransferActionCommandHandler _handler;

        public CreateSurplusTransferActionCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();
            _mockRequestItemRepo = new Mock<IGenericRepository<SurplusRequestItem>>();
            _mockTransferRepo = new Mock<IGenericRepository<SurplusTransfer>>();
            _mockInventoryRepo = new Mock<IGenericRepository<CurrentInventory>>();
            _mockProjectRepo = new Mock<IGenericRepository<Project>>();
            _mockMemberRepo = new Mock<IGenericRepository<ProjectMember>>();
            _mockRequestRepo = new Mock<IGenericRepository<SurplusRequest>>();

            _mockUow.Setup(u => u.Repository<SurplusRequestItem>()).Returns(_mockRequestItemRepo.Object);
            _mockUow.Setup(u => u.Repository<SurplusTransfer>()).Returns(_mockTransferRepo.Object);
            _mockUow.Setup(u => u.Repository<CurrentInventory>()).Returns(_mockInventoryRepo.Object);
            _mockUow.Setup(u => u.Repository<Project>()).Returns(_mockProjectRepo.Object);
            _mockUow.Setup(u => u.Repository<ProjectMember>()).Returns(_mockMemberRepo.Object);
            _mockUow.Setup(u => u.Repository<SurplusRequest>()).Returns(_mockRequestRepo.Object);
            _mockUow.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

            SetupRequestItems(DefaultItem());
            SetupTransfers();
            SetupInventories(new CurrentInventory { ProjectId = FromProjectId, MaterialId = MaterialId, Quantity = 100, ReservedQuantity = 0 });
            SetupProjects(DefaultProject(ToProjectId), DefaultProject(FromProjectId));
            SetupProjectMembers();
            SetupRequests(new SurplusRequest { SurplusRequestId = SurplusRequestId, Status = SurplusRequestStatus.Processing });

            _handler = new CreateSurplusTransferActionCommandHandler(
                _mockUow.Object,
                _mockCurrentUserService.Object,
                ServiceStubFactory.NotificationService());
        }

        [Fact]
        public async Task UTCID01_Handle_ValidTransfer_ShouldReturnSuccess()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.TechnicalManager);
            var inventory = new CurrentInventory { ProjectId = FromProjectId, MaterialId = MaterialId, Quantity = 100, ReservedQuantity = 0 };
            SetupInventories(inventory);

            var result = await _handler.Handle(Command(), CancellationToken.None);

            result.Success.Should().BeTrue();
            _mockTransferRepo.Verify(r => r.AddAsync(It.IsAny<SurplusTransfer>(), It.IsAny<CancellationToken>()), Times.Once);
            inventory.ReservedQuantity.Should().Be(10m); // 10 transferred
        }

        [Fact]
        public async Task UTCID02_Handle_BatchAlreadyProcessed_ShouldThrowBusinessException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.TechnicalManager);
            SetupRequestItems(DefaultItem(batchStatus: SurplusRequestStatus.Processed));

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("BIZ_006");
        }

        [Fact]
        public async Task UTCID03_Handle_SourceAndTargetProjectSame_ShouldThrowBusinessException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.TechnicalManager);

            var act = async () => await _handler.Handle(Command(toProjectId: FromProjectId), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("BIZ_005");
        }

        [Fact]
        public async Task UTCID04_Handle_TargetProjectNotFound_ShouldThrowNotFoundException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.TechnicalManager);
            SetupProjects(DefaultProject(FromProjectId));

            var act = async () => await _handler.Handle(Command(toProjectId: 999), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<NotFoundException>();
            exception.Which.ErrorCode.Should().Be("BIZ_001");
        }

        [Fact]
        public async Task UTCID05_Handle_TargetProjectNotInProgress_ShouldThrowBusinessException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.TechnicalManager);
            SetupProjects(DefaultProject(FromProjectId), DefaultProject(ToProjectId, ProjectStatus.Completed));

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("BIZ_005");
        }

        [Fact]
        public async Task UTCID06_Handle_DiscreteUnitWithDecimalQuantity_ShouldThrowBusinessException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.TechnicalManager);
            var item = DefaultItem();
            item.Unit = new Unit { UnitName = "Cái", IsDiscrete = true };
            SetupRequestItems(item);

            var act = async () => await _handler.Handle(Command(qty: 5.5m), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("BIZ_008");
        }

        [Fact]
        public async Task UTCID07_Handle_ExceedsUncommittedQuantity_ShouldThrowBusinessException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.TechnicalManager);
            var item = DefaultItem(quantity: 20, processedQuantity: 5);
            SetupRequestItems(item);
            SetupTransfers(new SurplusTransfer { SurplusRequestItemId = SurplusRequestItemId, Status = SurplusTransferStatus.Pending, TransferQuantity = 10 });
            
            // Uncommitted = 20 - 5 - 10 = 5. Trying to transfer 6.
            var act = async () => await _handler.Handle(Command(qty: 6m), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("BIZ_002");
        }

        [Fact]
        public async Task UTCID08_Handle_ExceedsAvailableInventory_ShouldThrowBusinessException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.TechnicalManager);
            SetupInventories(new CurrentInventory { ProjectId = FromProjectId, MaterialId = MaterialId, Quantity = 10, ReservedQuantity = 5 });
            
            // Available = 5. Trying to transfer 10.
            var act = async () => await _handler.Handle(Command(qty: 10m), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("BIZ_002");
        }

        // ==================== Factory Methods ====================

        private static CreateSurplusTransferActionCommand Command(long toProjectId = ToProjectId, decimal qty = 10m)
            => new(SurplusRequestItemId, toProjectId, qty);

        private static SurplusRequestItem DefaultItem(
            decimal quantity = 50m,
            decimal processedQuantity = 0m,
            string batchStatus = SurplusRequestStatus.Processing)
            => new()
            {
                SurplusRequestItemId = SurplusRequestItemId,
                SurplusRequestId = SurplusRequestId,
                MaterialId = MaterialId,
                Quantity = quantity,
                ProcessedQuantity = processedQuantity,
                Status = SurplusRequestItemStatus.Processing,
                ConversionRate = 1,
                SurplusRequest = new SurplusRequest
                {
                    SurplusRequestId = SurplusRequestId,
                    ProjectId = FromProjectId,
                    Status = batchStatus,
                    Project = new Project { Name = "From Project" }
                }
            };

        private static Project DefaultProject(long projectId, string status = ProjectStatus.InProgress)
            => new() { ProjectId = projectId, Name = $"Project {projectId}", Status = status };

        // ==================== Setup Methods ====================

        private void SetupRequestItems(params SurplusRequestItem[] items)
        {
            _mockRequestItemRepo.Setup(r => r.Query()).Returns(items.AsQueryable().BuildMock());
        }

        private void SetupTransfers(params SurplusTransfer[] transfers)
        {
            _mockTransferRepo.Setup(r => r.Query()).Returns(transfers.AsQueryable().BuildMock());
        }

        private void SetupInventories(params CurrentInventory[] inventories)
        {
            _mockInventoryRepo.Setup(r => r.Query()).Returns(inventories.AsQueryable().BuildMock());
        }

        private void SetupProjects(params Project[] projects)
        {
            _mockProjectRepo.Setup(r => r.Query()).Returns(projects.AsQueryable().BuildMock());
        }

        private void SetupProjectMembers(params ProjectMember[] members)
        {
            _mockMemberRepo.Setup(r => r.Query()).Returns(members.AsQueryable().BuildMock());
        }

        private void SetupRequests(params SurplusRequest[] requests)
        {
            _mockRequestRepo.Setup(r => r.GetByIdAsync(It.IsAny<long>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync((long id, CancellationToken _) => requests.FirstOrDefault(req => req.SurplusRequestId == id));
        }
    }
}
