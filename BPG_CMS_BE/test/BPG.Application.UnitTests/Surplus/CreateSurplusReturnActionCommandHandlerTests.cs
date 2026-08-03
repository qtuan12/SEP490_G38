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
    public class CreateSurplusReturnActionCommandHandlerTests
    {
        private const long CurrentUserId = 10;
        private const long ProjectId = 5;
        private const long SurplusRequestId = 100;
        private const long SurplusRequestItemId = 200;
        private const long MaterialId = 50;
        private const long SupplierId = 123;

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly Mock<IGenericRepository<SurplusRequestItem>> _mockRequestItemRepo;
        private readonly Mock<IGenericRepository<SurplusTransfer>> _mockTransferRepo;
        private readonly Mock<IGenericRepository<CurrentInventory>> _mockInventoryRepo;
        private readonly Mock<IGenericRepository<SurplusReturnSupplier>> _mockReturnRepo;
        private readonly Mock<IGenericRepository<ProjectMember>> _mockMemberRepo;
        private readonly Mock<IGenericRepository<SurplusRequest>> _mockRequestRepo;
        private readonly Mock<IInventoryService> _mockInventoryService;
        private readonly Mock<ISurplusMaterialSupplierService> _mockSupplierService;
        private readonly Mock<IFileStorageService> _mockFileStorageService;
        private readonly CreateSurplusReturnActionCommandHandler _handler;

        public CreateSurplusReturnActionCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();
            _mockRequestItemRepo = new Mock<IGenericRepository<SurplusRequestItem>>();
            _mockTransferRepo = new Mock<IGenericRepository<SurplusTransfer>>();
            _mockInventoryRepo = new Mock<IGenericRepository<CurrentInventory>>();
            _mockReturnRepo = new Mock<IGenericRepository<SurplusReturnSupplier>>();
            _mockMemberRepo = new Mock<IGenericRepository<ProjectMember>>();
            _mockRequestRepo = new Mock<IGenericRepository<SurplusRequest>>();
            _mockInventoryService = new Mock<IInventoryService>();
            _mockSupplierService = new Mock<ISurplusMaterialSupplierService>();
            _mockFileStorageService = new Mock<IFileStorageService>();

            _mockUow.Setup(u => u.Repository<SurplusRequestItem>()).Returns(_mockRequestItemRepo.Object);
            _mockUow.Setup(u => u.Repository<SurplusTransfer>()).Returns(_mockTransferRepo.Object);
            _mockUow.Setup(u => u.Repository<CurrentInventory>()).Returns(_mockInventoryRepo.Object);
            _mockUow.Setup(u => u.Repository<SurplusReturnSupplier>()).Returns(_mockReturnRepo.Object);
            _mockUow.Setup(u => u.Repository<ProjectMember>()).Returns(_mockMemberRepo.Object);
            _mockUow.Setup(u => u.Repository<SurplusRequest>()).Returns(_mockRequestRepo.Object);
            
            _mockUow.Setup(u => u.BeginTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
            _mockUow.Setup(u => u.CommitTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
            _mockUow.Setup(u => u.RollbackTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
            _mockUow.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

            SetupRequestItems(DefaultItem());
            SetupTransfers();
            SetupInventories(new CurrentInventory { ProjectId = ProjectId, MaterialId = MaterialId, Quantity = 100, ReservedQuantity = 0 });
            SetupProjectMembers();
            SetupRequests(new SurplusRequest { SurplusRequestId = SurplusRequestId, Status = SurplusRequestStatus.Processing });
            
            _mockSupplierService.Setup(s => s.GetApprovedSuppliersAsync(ProjectId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new List<SurplusMaterialSupplier> { new SurplusMaterialSupplier(SupplierId, "Supplier A") });

            _handler = new CreateSurplusReturnActionCommandHandler(
                _mockUow.Object,
                _mockCurrentUserService.Object,
                _mockInventoryService.Object,
                _mockFileStorageService.Object,
                ServiceStubFactory.NotificationService(),
                _mockSupplierService.Object);
        }

        [Fact]
        public async Task UTCID01_Handle_ValidReturn_ShouldReturnSuccess()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.Accountant);

            var result = await _handler.Handle(Command(), CancellationToken.None);

            result.Success.Should().BeTrue();
            _mockReturnRepo.Verify(r => r.AddAsync(It.IsAny<SurplusReturnSupplier>(), It.IsAny<CancellationToken>()), Times.Once);
            _mockInventoryService.Verify(s => s.UpdateStockAsync(
                ProjectId, MaterialId, -10m, InventoryTransactionType.ReturnToSupplier, It.IsAny<long>(), EntityType.SurplusRequest, CurrentUserId, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID02_Handle_BatchAlreadyProcessed_ShouldThrowBusinessException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.Accountant);
            SetupRequestItems(DefaultItem(batchStatus: SurplusRequestStatus.Processed));

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("BIZ_006");
        }

        [Fact]
        public async Task UTCID03_Handle_DiscreteUnitWithDecimalQuantity_ShouldThrowBusinessException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.Accountant);
            var item = DefaultItem();
            item.Unit = new Unit { UnitName = "Cái", IsDiscrete = true };
            SetupRequestItems(item);

            var act = async () => await _handler.Handle(Command(qty: 5.5m), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("BIZ_008");
        }

        [Fact]
        public async Task UTCID04_Handle_ExceedsUncommittedQuantity_ShouldThrowBusinessException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.Accountant);
            var item = DefaultItem(quantity: 20, processedQuantity: 5);
            SetupRequestItems(item);
            SetupTransfers(new SurplusTransfer { SurplusRequestItemId = SurplusRequestItemId, Status = SurplusTransferStatus.Pending, TransferQuantity = 10 });
            
            // Uncommitted = 20 - 5 - 10 = 5. Trying to return 6.
            var act = async () => await _handler.Handle(Command(qty: 6m), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("BIZ_002");
        }

        [Fact]
        public async Task UTCID05_Handle_ExceedsAvailableInventory_ShouldThrowBusinessException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.Accountant);
            SetupInventories(new CurrentInventory { ProjectId = ProjectId, MaterialId = MaterialId, Quantity = 10, ReservedQuantity = 5 });
            
            // Available = 5. Trying to return 10.
            var act = async () => await _handler.Handle(Command(qty: 10m), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("BIZ_002");
        }

        [Fact]
        public async Task UTCID06_Handle_InvalidSupplier_ShouldThrowBusinessException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.Accountant);
            _mockSupplierService.Setup(s => s.GetApprovedSuppliersAsync(ProjectId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new List<SurplusMaterialSupplier>()); // No valid suppliers

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("BIZ_001");
        }

        // ==================== Factory Methods ====================

        private static CreateSurplusReturnActionCommand Command(decimal qty = 10m)
            => new(SurplusRequestItemId, SupplierId, qty, 1000000, "Trả hàng", null);

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
                SurplusRequest = new SurplusRequest
                {
                    SurplusRequestId = SurplusRequestId,
                    ProjectId = ProjectId,
                    Status = batchStatus,
                    Project = new Project { Name = "Test Project" }
                }
            };

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
