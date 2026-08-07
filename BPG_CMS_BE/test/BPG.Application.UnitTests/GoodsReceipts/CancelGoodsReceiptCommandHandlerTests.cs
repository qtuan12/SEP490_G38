using BPG.Application.Features.GoodsReceipts.Commands;
using BPG.Application.Features.GoodsReceipts.Handlers;
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

namespace BPG.Application.UnitTests.GoodsReceipts
{
    public class CancelGoodsReceiptCommandHandlerTests
    {
        private const long CurrentUserId = 10;
        private const long ProjectId = 5;
        private const long POId = 100;
        private const long ReceiptId = 500;
        private const long CementId = 50;

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly Mock<IGenericRepository<GoodsReceipt>> _mockReceiptRepo;
        private readonly Mock<IGenericRepository<CurrentInventory>> _mockInventoryRepo;
        private readonly Mock<IGenericRepository<SystemConfig>> _mockConfigRepo;
        private readonly Mock<IGenericRepository<GoodsReceiptItem>> _mockReceiptItemRepo;
        private readonly Mock<IGenericRepository<PurchaseOrder>> _mockPoRepo;
        private readonly Mock<IGenericRepository<ProjectMember>> _mockMemberRepo;
        private readonly CancelGoodsReceiptCommandHandler _handler;

        public CancelGoodsReceiptCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();
            _mockReceiptRepo = new Mock<IGenericRepository<GoodsReceipt>>();
            _mockInventoryRepo = new Mock<IGenericRepository<CurrentInventory>>();
            _mockConfigRepo = new Mock<IGenericRepository<SystemConfig>>();
            _mockReceiptItemRepo = new Mock<IGenericRepository<GoodsReceiptItem>>();
            _mockPoRepo = new Mock<IGenericRepository<PurchaseOrder>>();
            _mockMemberRepo = new Mock<IGenericRepository<ProjectMember>>();

            _mockUow.Setup(uow => uow.Repository<GoodsReceipt>()).Returns(_mockReceiptRepo.Object);
            _mockUow.Setup(uow => uow.Repository<CurrentInventory>()).Returns(_mockInventoryRepo.Object);
            _mockUow.Setup(uow => uow.Repository<SystemConfig>()).Returns(_mockConfigRepo.Object);
            _mockUow.Setup(uow => uow.Repository<GoodsReceiptItem>()).Returns(_mockReceiptItemRepo.Object);
            _mockUow.Setup(uow => uow.Repository<PurchaseOrder>()).Returns(_mockPoRepo.Object);
            _mockUow.Setup(uow => uow.Repository<ProjectMember>()).Returns(_mockMemberRepo.Object);
            _mockUow.Setup(uow => uow.BeginTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
            _mockUow.Setup(uow => uow.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
            _mockUow.Setup(uow => uow.CommitTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
            _mockUow.Setup(uow => uow.RollbackTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

            SetupReceipts();
            SetupInventories();
            SetupSystemConfig("7");
            SetupOtherReceiptItems();
            SetupPurchaseOrders();
            SetupProjectMembers(new ProjectMember { ProjectId = ProjectId, UserId = CurrentUserId, IsLeader = true });

            _handler = new CancelGoodsReceiptCommandHandler(
                _mockUow.Object,
                _mockCurrentUserService.Object,
                ServiceStubFactory.InventoryService(),
                ServiceStubFactory.RealtimeSender());
        }
        [Fact]
        public async Task UTCID03_Handle_ReceiptNotFound_ShouldThrowNotFoundException()
        {
            SetupUser(RoleConstants.TechnicalManager);

            var act = async () => await _handler.Handle(Command(999), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<NotFoundException>();
            exception.Which.ErrorCode.Should().Be("BIZ_001");
            exception.Which.Message.Should().Be("GoodsReceipt với ID [999] không tồn tại.");
        }

        [Fact]
        public async Task UTCID04_Handle_ReceiptAlreadyCancelled_ShouldThrowBusinessException()
        {
            SetupUser(RoleConstants.TechnicalManager);
            SetupReceipts(Receipt(status: GoodsReceiptStatus.Cancelled));

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_RECEIPT_ALREADY_CANCELLED");
            exception.Which.Message.Should().Be("Phiếu nhập kho này đã được hủy từ trước.");
        }

        [Fact]
        public async Task UTCID05_Handle_ReceiptWithoutPurchaseOrder_ShouldThrowBusinessException()
        {
            SetupUser(RoleConstants.TechnicalManager);
            SetupReceipts(new GoodsReceipt
            {
                ReceiptId = ReceiptId,
                Status = GoodsReceiptStatus.Approved,
                PurchaseOrder = null!
            });

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_PO_NOT_FOUND");
            exception.Which.Message.Should().Be("Không tìm thấy đơn mua hàng PO liên kết với phiếu nhập kho này.");
        }

        [Fact]
        public async Task UTCID06_Handle_PurchaseOrderWithoutProject_ShouldThrowBusinessException()
        {
            SetupUser(RoleConstants.TechnicalManager);
            SetupReceipts(Receipt(hasProject: false));

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_PROJECT_NOT_FOUND");
            exception.Which.Message.Should().Be("Không tìm thấy dự án liên kết với phiếu nhập kho này.");
        }

        [Fact]
        public async Task UTCID07_Handle_ProjectNotInProgress_ShouldThrowBusinessException()
        {
            SetupUser(RoleConstants.TechnicalManager);
            SetupReceipts(Receipt(projectStatus: ProjectStatus.Completed));

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_PROJECT_NOT_ACTIVE");
            exception.Which.Message.Should().Be("Dự án liên kết không còn hoạt động, không thể hủy phiếu nhập kho.");
        }

        [Fact]
        public async Task UTCID08_Handle_PurchaseOrderClosed_ShouldThrowBusinessException()
        {
            SetupUser(RoleConstants.TechnicalManager);
            SetupReceipts(Receipt(poStatus: PurchaseOrderStatus.Closed));

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_PO_CLOSED");
            exception.Which.Message.Should().Be("Đơn mua hàng PO liên kết đã đóng, không thể hủy phiếu nhập kho.");
        }

        [Fact]
        public async Task UTCID09_Handle_CancelWindowExceeded_ShouldThrowBusinessException()
        {
            SetupUser(RoleConstants.TechnicalManager);
            SetupReceipts(Receipt(createdAt: DateTime.UtcNow.AddDays(-10)));
            SetupSystemConfig("7");

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_CANCEL_TIME_EXCEEDED");
            exception.Which.Message.Should().Be("Phiếu nhập kho đã được tạo quá 7 ngày (hạn hủy tối đa theo cấu hình hệ thống), không thể thực hiện hủy. Vui lòng lập Phiếu Điều Chỉnh Kho để hiệu chỉnh số liệu.");
        }

        [Fact]
        public async Task UTCID10_Handle_CancelWindowConfigMissing_ShouldUseDefaultLimitAndThrowBusinessException()
        {
            SetupUser(RoleConstants.TechnicalManager);
            SetupReceipts(Receipt(createdAt: DateTime.UtcNow.AddDays(-8)));
            SetupSystemConfig();

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_CANCEL_TIME_EXCEEDED");
            exception.Which.Message.Should().Be("Phiếu nhập kho đã được tạo quá 7 ngày (hạn hủy tối đa theo cấu hình hệ thống), không thể thực hiện hủy. Vui lòng lập Phiếu Điều Chỉnh Kho để hiệu chỉnh số liệu.");
        }

        [Fact]
        public async Task UTCID11_Handle_InsufficientInventory_ShouldThrowBusinessException()
        {
            SetupUser(RoleConstants.TechnicalManager);
            SetupReceipts(Receipt());
            SetupInventories(Inventory(quantity: 8));

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_INSUFFICIENT_INVENTORY");
            exception.Which.Message.Should().Be("Không thể hủy phiếu nhập kho. Vật tư [Cement] đã được xuất dùng hoặc đóng băng cho kế hoạch thi công (tồn kho khả dụng hiện tại chỉ còn 8, yêu cầu hoàn trả 10). Vui lòng lập Phiếu Điều Chỉnh Kho.");
        }

        private static CancelGoodsReceiptCommand Command(long receiptId = ReceiptId)
            => new(receiptId);

        private static GoodsReceipt Receipt(
            string status = GoodsReceiptStatus.Approved,
            string poStatus = PurchaseOrderStatus.FullyReceived,
            string projectStatus = ProjectStatus.InProgress,
            DateTime? createdAt = null,
            bool hasProject = true)
        {
            return new GoodsReceipt
            {
                ReceiptId = ReceiptId,
                POId = POId,
                Status = status,
                CreatedAt = createdAt ?? DateTime.UtcNow.AddDays(-1),
                PurchaseOrder = new PurchaseOrder
                {
                    POId = POId,
                    Status = poStatus,
                    Items = new List<PurchaseOrderItem>
                    {
                        new()
                        {
                            MaterialId = CementId,
                            Quantity = 10,
                            ConversionRate = 1,
                            Material = new MaterialCatalog { MaterialId = CementId, Name = "Cement" }
                        }
                    },
                    Request = new MaterialRequest
                    {
                        Phase = new Phase
                        {
                            Project = hasProject
                                ? new Project { ProjectId = ProjectId, Status = projectStatus }
                                : null!
                        }
                    }
                },
                Items = new List<GoodsReceiptItem>
                {
                    new() { ReceiptId = ReceiptId, MaterialId = CementId, Quantity = 10, ConversionRate = 1 }
                }
            };
        }

        private static CurrentInventory Inventory(decimal quantity, decimal reservedQuantity = 0)
            => new()
            {
                ProjectId = ProjectId,
                MaterialId = CementId,
                Quantity = quantity,
                ReservedQuantity = reservedQuantity
            };

        private void SetupUser(string role, bool hasRole = true)
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, role, hasRole);
        }

        private void SetupReceipts(params GoodsReceipt[] receipts)
        {
            _mockReceiptRepo.Setup(r => r.Query()).Returns(receipts.AsQueryable().BuildMock());
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

        private void SetupInventories(params CurrentInventory[] inventories)
        {
            _mockInventoryRepo.Setup(repository => repository.Query()).Returns(inventories.AsQueryable().BuildMock());
        }

        private void SetupSystemConfig(string? limitDays = null)
        {
            var configs = limitDays == null
                ? new List<SystemConfig>()
                : new List<SystemConfig> { new() { ConfigKey = "HanHuyPhieuNgay", ConfigValue = limitDays } };

            _mockConfigRepo.Setup(repository => repository.Query()).Returns(configs.AsQueryable().BuildMock());
        }

        private void SetupOtherReceiptItems(params GoodsReceiptItem[] items)
        {
            _mockReceiptItemRepo.Setup(repository => repository.Query()).Returns(items.AsQueryable().BuildMock());
        }

        private void SetupPurchaseOrders(params PurchaseOrder[] purchaseOrders)
        {
            _mockPoRepo.Setup(repository => repository.Query()).Returns(purchaseOrders.AsQueryable().BuildMock());
        }
    }
}
