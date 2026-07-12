using BPG.Application.Common.Models;
using BPG.Application.Features.GoodsReceipts.Commands;
using BPG.Application.Features.GoodsReceipts.Handlers;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using MockQueryable;
using MockQueryable.Moq;
using Moq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Xunit;

namespace BPG.Application.UnitTests.GoodsReceipts
{
    public class CancelGoodsReceiptCommandHandlerTests
    {
        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IGenericRepository<GoodsReceipt>> _mockGrRepo;
        private readonly Mock<IGenericRepository<CurrentInventory>> _mockInventoryRepo;
        private readonly Mock<IGenericRepository<SystemConfig>> _mockConfigRepo;
        private readonly Mock<IGenericRepository<GoodsReceiptItem>> _mockGrItemRepo;
        private readonly Mock<IGenericRepository<PurchaseOrder>> _mockPoRepo;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly Mock<IInventoryService> _mockInventoryService;
        private readonly CancelGoodsReceiptCommandHandler _handler;

        public CancelGoodsReceiptCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockGrRepo = new Mock<IGenericRepository<GoodsReceipt>>();
            _mockInventoryRepo = new Mock<IGenericRepository<CurrentInventory>>();
            _mockConfigRepo = new Mock<IGenericRepository<SystemConfig>>();
            _mockGrItemRepo = new Mock<IGenericRepository<GoodsReceiptItem>>();
            _mockPoRepo = new Mock<IGenericRepository<PurchaseOrder>>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();
            _mockInventoryService = new Mock<IInventoryService>();

            _mockUow.Setup(u => u.Repository<GoodsReceipt>()).Returns(_mockGrRepo.Object);
            _mockUow.Setup(u => u.Repository<CurrentInventory>()).Returns(_mockInventoryRepo.Object);
            _mockUow.Setup(u => u.Repository<SystemConfig>()).Returns(_mockConfigRepo.Object);
            _mockUow.Setup(u => u.Repository<GoodsReceiptItem>()).Returns(_mockGrItemRepo.Object);
            _mockUow.Setup(u => u.Repository<PurchaseOrder>()).Returns(_mockPoRepo.Object);

            // Default Query Mock setups
            _mockGrRepo.Setup(r => r.Query()).Returns(new List<GoodsReceipt>().AsQueryable().BuildMock());
            _mockInventoryRepo.Setup(r => r.Query()).Returns(new List<CurrentInventory>().AsQueryable().BuildMock());
            _mockConfigRepo.Setup(r => r.Query()).Returns(new List<SystemConfig>().AsQueryable().BuildMock());
            _mockGrItemRepo.Setup(r => r.Query()).Returns(new List<GoodsReceiptItem>().AsQueryable().BuildMock());
            _mockPoRepo.Setup(r => r.Query()).Returns(new List<PurchaseOrder>().AsQueryable().BuildMock());

            _handler = new CancelGoodsReceiptCommandHandler(
                _mockUow.Object,
                _mockCurrentUserService.Object,
                _mockInventoryService.Object
            );
        }

        private void SetupCurrentUser(long userId, string role, bool hasPermission = true)
        {
            _mockCurrentUserService.Setup(s => s.GetRequiredUserId()).Returns(userId);
            _mockCurrentUserService.Setup(s => s.IsInAnyRole(It.IsAny<string[]>()))
                .Returns((string[] roles) => roles.Contains(role) && hasPermission);
        }

        [Fact]
        public async Task UTCID01_Handle_ValidRequest_AllReversed_ShouldCancelSuccessfully()
        {
            // Arrange
            SetupCurrentUser(10, BPG.Domain.Constants.UserRole.Admin);

            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var po = new PurchaseOrder
            {
                POId = 100,
                Status = PurchaseOrderStatus.FullyReceived,
                Items = new List<PurchaseOrderItem>
                {
                    new PurchaseOrderItem { MaterialId = 50, Quantity = 10, ConversionRate = 1 }
                },
                Request = new MaterialRequest { Phase = new Phase { Project = project } }
            };

            var receipt = new GoodsReceipt
            {
                ReceiptId = 500,
                POId = 100,
                Status = GoodsReceiptStatus.Approved,
                CreatedAt = DateTime.UtcNow.AddDays(-2), // Created 2 days ago (within 7 days limit)
                PurchaseOrder = po,
                Items = new List<GoodsReceiptItem>
                {
                    new GoodsReceiptItem { MaterialId = 50, Quantity = 10, ConversionRate = 1 }
                }
            };
            _mockGrRepo.Setup(r => r.Query()).Returns(new List<GoodsReceipt> { receipt }.AsQueryable().BuildMock());

            // Limit configuration (7 days)
            var config = new SystemConfig { ConfigKey = "HanHuyPhieuNgay", ConfigValue = "7" };
            _mockConfigRepo.Setup(r => r.Query()).Returns(new List<SystemConfig> { config }.AsQueryable().BuildMock());

            // Tồn kho khả dụng (Available Qty = 15 - 2 = 13 >= 10)
            var inventory = new CurrentInventory { ProjectId = 5, MaterialId = 50, Quantity = 15, ReservedQuantity = 2 };
            _mockInventoryRepo.Setup(r => r.Query()).Returns(new List<CurrentInventory> { inventory }.AsQueryable().BuildMock());

            var command = new CancelGoodsReceiptCommand(500);

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.Success.Should().BeTrue();
            result.Data.Should().BeTrue();

            receipt.Status.Should().Be(GoodsReceiptStatus.Cancelled);
            po.Status.Should().Be(PurchaseOrderStatus.Sent); // Restored back to Sent since no other receipts exist

            _mockUow.Verify(u => u.BeginTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
            _mockGrRepo.Verify(r => r.Update(receipt), Times.Once);
            _mockInventoryService.Verify(s => s.UpdateStockAsync(5, 50, -10, InventoryTransactionType.Adjustment, 500, EntityType.GoodsReceiptReversal, 10, It.IsAny<CancellationToken>()), Times.Once);
            _mockPoRepo.Verify(r => r.Update(po), Times.Once);
            _mockUow.Verify(u => u.CommitTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID02_Handle_ValidRequest_PartiallyReversed_ShouldCancelSuccessfully()
        {
            // Arrange
            SetupCurrentUser(10, BPG.Domain.Constants.UserRole.TechnicalManager);

            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var po = new PurchaseOrder
            {
                POId = 100,
                Status = PurchaseOrderStatus.FullyReceived,
                Items = new List<PurchaseOrderItem>
                {
                    new PurchaseOrderItem { MaterialId = 50, Quantity = 10, ConversionRate = 1 }
                },
                Request = new MaterialRequest { Phase = new Phase { Project = project } }
            };

            var receipt = new GoodsReceipt
            {
                ReceiptId = 500,
                POId = 100,
                Status = GoodsReceiptStatus.Approved,
                CreatedAt = DateTime.UtcNow.AddDays(-1),
                PurchaseOrder = po,
                Items = new List<GoodsReceiptItem>
                {
                    new GoodsReceiptItem { MaterialId = 50, Quantity = 4, ConversionRate = 1 }
                }
            };
            _mockGrRepo.Setup(r => r.Query()).Returns(new List<GoodsReceipt> { receipt }.AsQueryable().BuildMock());

            // Tồn kho khả dụng (Available Qty = 10 >= 4)
            var inventory = new CurrentInventory { ProjectId = 5, MaterialId = 50, Quantity = 10, ReservedQuantity = 0 };
            _mockInventoryRepo.Setup(r => r.Query()).Returns(new List<CurrentInventory> { inventory }.AsQueryable().BuildMock());

            // Mock another receipt for this PO that remains Approved (user had received 6 in another receipt)
            var otherReceiptItem = new GoodsReceiptItem
            {
                MaterialId = 50,
                Quantity = 6,
                ReceiptId = 400,
                Receipt = new GoodsReceipt { ReceiptId = 400, POId = 100, Status = GoodsReceiptStatus.Approved }
            };
            _mockGrItemRepo.Setup(r => r.Query()).Returns(new List<GoodsReceiptItem> { otherReceiptItem }.AsQueryable().BuildMock());

            var command = new CancelGoodsReceiptCommand(500);

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            po.Status.Should().Be(PurchaseOrderStatus.PartiallyReceived); // Restored back to PartiallyReceived
        }

        [Fact]
        public async Task UTCID03_Handle_InsufficientPermission_ShouldThrowBusinessException()
        {
            // Arrange
            SetupCurrentUser(10, BPG.Domain.Constants.UserRole.SiteEngineer, hasPermission: false); // Standard worker

            var command = new CancelGoodsReceiptCommand(500);

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Bạn không có quyền hủy phiếu nhập kho đã được ghi nhận.*");
        }

        [Fact]
        public async Task UTCID04_Handle_ReceiptNotFound_ShouldThrowNotFoundException()
        {
            // Arrange
            SetupCurrentUser(10, BPG.Domain.Constants.UserRole.Admin);

            var command = new CancelGoodsReceiptCommand(999);

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<NotFoundException>()
                .WithMessage("GoodsReceipt với ID [999] không tồn tại.");
        }

        [Fact]
        public async Task UTCID05_Handle_AlreadyCancelled_ShouldThrowBusinessException()
        {
            // Arrange
            SetupCurrentUser(10, BPG.Domain.Constants.UserRole.Admin);
            var receipt = new GoodsReceipt { ReceiptId = 500, Status = GoodsReceiptStatus.Cancelled };
            _mockGrRepo.Setup(r => r.Query()).Returns(new List<GoodsReceipt> { receipt }.AsQueryable().BuildMock());

            var command = new CancelGoodsReceiptCommand(500);

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Phiếu nhập kho này đã được hủy từ trước.");
        }

        [Fact]
        public async Task UTCID06_Handle_PONotFound_ShouldThrowBusinessException()
        {
            // Arrange
            SetupCurrentUser(10, BPG.Domain.Constants.UserRole.Admin);
            var receipt = new GoodsReceipt { ReceiptId = 500, Status = GoodsReceiptStatus.Approved, PurchaseOrder = null };
            _mockGrRepo.Setup(r => r.Query()).Returns(new List<GoodsReceipt> { receipt }.AsQueryable().BuildMock());

            var command = new CancelGoodsReceiptCommand(500);

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Không tìm thấy đơn mua hàng PO liên kết với phiếu nhập kho này.");
        }

        [Fact]
        public async Task UTCID07_Handle_ProjectNotFound_ShouldThrowBusinessException()
        {
            // Arrange
            SetupCurrentUser(10, BPG.Domain.Constants.UserRole.Admin);
            var po = new PurchaseOrder { POId = 100, Request = new MaterialRequest { Phase = new Phase { Project = null } } };
            var receipt = new GoodsReceipt { ReceiptId = 500, Status = GoodsReceiptStatus.Approved, PurchaseOrder = po };
            _mockGrRepo.Setup(r => r.Query()).Returns(new List<GoodsReceipt> { receipt }.AsQueryable().BuildMock());

            var command = new CancelGoodsReceiptCommand(500);

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Không tìm thấy dự án liên kết với phiếu nhập kho này.");
        }

        [Fact]
        public async Task UTCID08_Handle_ProjectNotActive_ShouldThrowBusinessException()
        {
            // Arrange
            SetupCurrentUser(10, BPG.Domain.Constants.UserRole.Admin);
            var project = new Project { ProjectId = 5, Status = ProjectStatus.Completed }; // Inactive
            var po = new PurchaseOrder { POId = 100, Request = new MaterialRequest { Phase = new Phase { Project = project } } };
            var receipt = new GoodsReceipt { ReceiptId = 500, Status = GoodsReceiptStatus.Approved, PurchaseOrder = po };
            _mockGrRepo.Setup(r => r.Query()).Returns(new List<GoodsReceipt> { receipt }.AsQueryable().BuildMock());

            var command = new CancelGoodsReceiptCommand(500);

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Dự án liên kết không còn hoạt động, không thể hủy phiếu nhập kho.");
        }

        [Fact]
        public async Task UTCID09_Handle_POClosed_ShouldThrowBusinessException()
        {
            // Arrange
            SetupCurrentUser(10, BPG.Domain.Constants.UserRole.Admin);
            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var po = new PurchaseOrder { POId = 100, Status = PurchaseOrderStatus.Closed, Request = new MaterialRequest { Phase = new Phase { Project = project } } };
            var receipt = new GoodsReceipt { ReceiptId = 500, Status = GoodsReceiptStatus.Approved, PurchaseOrder = po };
            _mockGrRepo.Setup(r => r.Query()).Returns(new List<GoodsReceipt> { receipt }.AsQueryable().BuildMock());

            var command = new CancelGoodsReceiptCommand(500);

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Đơn mua hàng PO liên kết đã đóng, không thể hủy phiếu nhập kho.");
        }

        [Fact]
        public async Task UTCID10_Handle_CancelTimeframeExceeded_ShouldThrowBusinessException()
        {
            // Arrange
            SetupCurrentUser(10, BPG.Domain.Constants.UserRole.Admin);
            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var po = new PurchaseOrder { POId = 100, Status = PurchaseOrderStatus.FullyReceived, Request = new MaterialRequest { Phase = new Phase { Project = project } } };
            
            var receipt = new GoodsReceipt
            {
                ReceiptId = 500,
                Status = GoodsReceiptStatus.Approved,
                CreatedAt = DateTime.UtcNow.AddDays(-10), // Created 10 days ago (exceeds limit)
                PurchaseOrder = po
            };
            _mockGrRepo.Setup(r => r.Query()).Returns(new List<GoodsReceipt> { receipt }.AsQueryable().BuildMock());

            // Limit config set to 7 days
            var config = new SystemConfig { ConfigKey = "HanHuyPhieuNgay", ConfigValue = "7" };
            _mockConfigRepo.Setup(r => r.Query()).Returns(new List<SystemConfig> { config }.AsQueryable().BuildMock());

            var command = new CancelGoodsReceiptCommand(500);

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("*Phiếu nhập kho đã được tạo quá 7 ngày*");
        }

        [Fact]
        public async Task UTCID11_Handle_InsufficientInventory_ShouldThrowBusinessException()
        {
            // Arrange
            SetupCurrentUser(10, BPG.Domain.Constants.UserRole.Admin);
            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var po = new PurchaseOrder
            {
                POId = 100,
                Status = PurchaseOrderStatus.FullyReceived,
                Request = new MaterialRequest { Phase = new Phase { Project = project } },
                Items = new List<PurchaseOrderItem>
                {
                    new PurchaseOrderItem { MaterialId = 50, Material = new MaterialCatalog { Name = "Cement" } }
                }
            };
            var receipt = new GoodsReceipt
            {
                ReceiptId = 500,
                Status = GoodsReceiptStatus.Approved,
                CreatedAt = DateTime.UtcNow.AddDays(-1),
                PurchaseOrder = po,
                Items = new List<GoodsReceiptItem>
                {
                    new GoodsReceiptItem { MaterialId = 50, Quantity = 10, ConversionRate = 1 }
                }
            };
            _mockGrRepo.Setup(r => r.Query()).Returns(new List<GoodsReceipt> { receipt }.AsQueryable().BuildMock());

            // Tồn kho khả dụng không đủ (Available = 8 - 0 = 8 < 10)
            var inventory = new CurrentInventory { ProjectId = 5, MaterialId = 50, Quantity = 8, ReservedQuantity = 0 };
            _mockInventoryRepo.Setup(r => r.Query()).Returns(new List<CurrentInventory> { inventory }.AsQueryable().BuildMock());

            var command = new CancelGoodsReceiptCommand(500);

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("*Không thể hủy phiếu nhập kho. Vật tư [Cement] đã được xuất dùng hoặc đóng băng*");
        }
    }
}
