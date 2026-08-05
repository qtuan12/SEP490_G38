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
    public class CreateGoodsReceiptCommandHandlerTests
    {
        private const long CurrentUserId = 10;
        private const long ProjectId = 5;
        private const long POId = 100;
        private const long GeneratedReceiptId = 500;
        private const long CementId = 50;
        private const long SandId = 51;
        private const int UnitId = 1;

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IGenericRepository<PurchaseOrder>> _mockPoRepo;
        private readonly Mock<IGenericRepository<GoodsReceipt>> _mockReceiptRepo;
        private readonly Mock<IGenericRepository<GoodsReceiptItem>> _mockReceiptItemRepo;
        private readonly Mock<IGenericRepository<Attachment>> _mockAttachmentRepo;
        private readonly Mock<IGenericRepository<ProjectMember>> _mockMemberRepo;
        private readonly Mock<IGenericRepository<User>> _mockUserRepo;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly CreateGoodsReceiptCommandHandler _handler;

        public CreateGoodsReceiptCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockPoRepo = new Mock<IGenericRepository<PurchaseOrder>>();
            _mockReceiptRepo = new Mock<IGenericRepository<GoodsReceipt>>();
            _mockReceiptItemRepo = new Mock<IGenericRepository<GoodsReceiptItem>>();
            _mockAttachmentRepo = new Mock<IGenericRepository<Attachment>>();
            _mockMemberRepo = new Mock<IGenericRepository<ProjectMember>>();
            _mockUserRepo = new Mock<IGenericRepository<User>>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();

            _mockUow.Setup(u => u.Repository<PurchaseOrder>()).Returns(_mockPoRepo.Object);
            _mockUow.Setup(u => u.Repository<GoodsReceipt>()).Returns(_mockReceiptRepo.Object);
            _mockUow.Setup(u => u.Repository<GoodsReceiptItem>()).Returns(_mockReceiptItemRepo.Object);
            _mockUow.Setup(u => u.Repository<Attachment>()).Returns(_mockAttachmentRepo.Object);
            _mockUow.Setup(u => u.Repository<ProjectMember>()).Returns(_mockMemberRepo.Object);
            _mockUow.Setup(u => u.Repository<User>()).Returns(_mockUserRepo.Object);
            _mockUow.Setup(u => u.BeginTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
            _mockUow.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
            _mockUow.Setup(u => u.CommitTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
            _mockUow.Setup(u => u.RollbackTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
            _mockReceiptItemRepo.Setup(r => r.AddRangeAsync(It.IsAny<IEnumerable<GoodsReceiptItem>>(), It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);
            _mockAttachmentRepo.Setup(r => r.AddRangeAsync(It.IsAny<IEnumerable<Attachment>>(), It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);

            SetupPurchaseOrders();
            SetupApprovedReceiptItems();
            SetupProjectMembers();
            SetupUsers(new User { UserId = CurrentUserId, FullName = "Current User" });
            SetupReceiptIdGeneration();

            _handler = new CreateGoodsReceiptCommandHandler(
                _mockUow.Object,
                _mockCurrentUserService.Object,
                ServiceStubFactory.InventoryService(),
                ServiceStubFactory.RealtimeSender(),
                ServiceStubFactory.NotificationService());
        }

        [Fact]
        public async Task UTCID08_Handle_InvalidPOStatus_ShouldThrowBusinessException()
        {
            SetupProjectLeader();
            SetupPurchaseOrders(PurchaseOrderWithItems(PurchaseOrderStatus.Closed, POItem(CementId, "Cement", 10)));

            var act = async () => await _handler.Handle(Command(items: new[] { Item(CementId, 5) }), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_INVALID_PO_STATUS");
            exception.Which.Message.Should().Be("Không thể nhập kho cho đơn hàng có trạng thái: Closed. Chỉ chấp nhận đơn hàng ở trạng thái Đã đặt hàng hoặc Nhận một phần.");
        }

        [Fact]
        public async Task UTCID09_Handle_MaterialNotInPO_ShouldThrowBusinessException()
        {
            SetupProjectLeader();
            SetupPurchaseOrders(PurchaseOrderWithItems(PurchaseOrderStatus.Sent, POItem(CementId, "Cement", 10)));

            var act = async () => await _handler.Handle(Command(items: new[] { Item(99, 5) }), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_MATERIAL_NOT_IN_PO");
            exception.Which.Message.Should().Be("Vật tư ID 99 không tồn tại trong đơn hàng này.");
        }

        [Fact]
        public async Task UTCID10_Handle_NegativeQuantity_ShouldThrowBusinessException()
        {
            SetupProjectLeader();
            SetupPurchaseOrders(PurchaseOrderWithItems(PurchaseOrderStatus.Sent, POItem(CementId, "Cement", 10)));

            var act = async () => await _handler.Handle(Command(items: new[] { Item(CementId, -1) }), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_INVALID_QUANTITY");
            exception.Which.Message.Should().Be("Số lượng nhận của vật tư [Cement] phải lớn hơn hoặc bằng 0.");
        }

        [Fact]
        public async Task UTCID11_Handle_DiscreteMaterialWithFractionalQuantity_ShouldThrowBusinessException()
        {
            SetupProjectLeader();
            SetupPurchaseOrders(PurchaseOrderWithItems(PurchaseOrderStatus.Sent, POItem(CementId, "Cement Bag", 10, isDiscrete: true)));

            var act = async () => await _handler.Handle(Command(items: new[] { Item(CementId, 1.5m) }), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be(ErrorCodes.InvalidUnitQuantity);
            exception.Which.Message.Should().Be("Đơn vị tính 'Bag' của vật tư [Cement Bag] yêu cầu số lượng nhận phải là số nguyên.");
        }

        [Fact]
        public async Task UTCID12_Handle_QuantityExceededRemaining_ShouldThrowBusinessException()
        {
            SetupProjectLeader();
            SetupPurchaseOrders(PurchaseOrderWithItems(PurchaseOrderStatus.PartiallyReceived, POItem(CementId, "Cement", 10)));
            SetupApprovedReceiptItems(new GoodsReceiptItem
            {
                MaterialId = CementId,
                Quantity = 6,
                Receipt = new GoodsReceipt { POId = POId, Status = GoodsReceiptStatus.Approved }
            });

            var act = async () => await _handler.Handle(Command(items: new[] { Item(CementId, 5) }), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_QUANTITY_EXCEEDED");
            exception.Which.Message.Should().Be("Số lượng nhận (5) vượt quá số lượng còn lại cần giao của đơn hàng cho vật tư [Cement] (còn thiếu 4).");
        }

        [Fact]
        public async Task UTCID13_Handle_AllItemsHaveZeroQuantity_ShouldThrowBusinessException()
        {
            SetupProjectLeader();
            SetupPurchaseOrders(PurchaseOrderWithItems(PurchaseOrderStatus.Sent, POItem(CementId, "Cement", 10)));

            var act = async () => await _handler.Handle(Command(items: new[] { Item(CementId, 0) }), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_EMPTY_ITEMS");
            exception.Which.Message.Should().Be("Danh sách vật tư nhận thực tế phải chứa ít nhất một vật tư có số lượng lớn hơn 0.");
        }

        private static CreateGoodsReceiptCommand Command(
            long poId = POId,
            IEnumerable<CreateGoodsReceiptItemDto>? items = null,
            IEnumerable<string>? images = null,
            string? deliverer = "John",
            string? deliveryDocNo = "DOC-123")
            => new(
                poId,
                deliverer,
                deliveryDocNo,
                items?.ToList() ?? new List<CreateGoodsReceiptItemDto> { Item(CementId, 5) },
                images?.ToList());

        private static CreateGoodsReceiptItemDto Item(long materialId, decimal quantity)
            => new(materialId, UnitId, quantity);

        private static PurchaseOrder PurchaseOrderWithItems(string status, params PurchaseOrderItem[] items)
            => PurchaseOrderWithItems(status, ProjectStatus.InProgress, items);

        private static PurchaseOrder PurchaseOrderWithItems(string status, string projectStatus, params PurchaseOrderItem[] items)
            => new()
            {
                POId = POId,
                Status = status,
                PONumber = "PO-100",
                Request = new MaterialRequest
                {
                    Phase = new Phase
                    {
                        Project = new Project { ProjectId = ProjectId, Status = projectStatus }
                    }
                },
                Items = items.ToList()
            };

        private static PurchaseOrderItem POItem(long materialId, string name, decimal quantity, decimal conversionRate = 1, bool isDiscrete = false)
            => new()
            {
                MaterialId = materialId,
                UnitId = UnitId,
                Quantity = quantity,
                ConversionRate = conversionRate,
                Material = new MaterialCatalog
                {
                    MaterialId = materialId,
                    Name = name,
                    BaseUnit = new Unit { UnitId = UnitId, UnitName = "Bag", IsDiscrete = isDiscrete }
                }
            };

        private void SetupTechnicalManager()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId);
            _mockCurrentUserService.Setup(s => s.IsInRole(RoleConstants.TechnicalManager)).Returns(true);
        }

        private void SetupProjectLeader()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId);
            _mockCurrentUserService.Setup(s => s.IsInRole(RoleConstants.TechnicalManager)).Returns(false);
            SetupProjectMembers(new ProjectMember { ProjectId = ProjectId, UserId = CurrentUserId, IsLeader = true });
        }

        private void SetupStandardUser()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId);
            _mockCurrentUserService.Setup(s => s.IsInRole(RoleConstants.TechnicalManager)).Returns(false);
            SetupProjectMembers(new ProjectMember { ProjectId = ProjectId, UserId = CurrentUserId, IsLeader = false });
        }

        private void SetupPurchaseOrders(params PurchaseOrder[] purchaseOrders)
        {
            _mockPoRepo.Setup(r => r.Query()).Returns(purchaseOrders.AsQueryable().BuildMock());
        }

        private void SetupApprovedReceiptItems(params GoodsReceiptItem[] items)
        {
            _mockReceiptItemRepo.Setup(r => r.Query()).Returns(items.AsQueryable().BuildMock());
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

        private void SetupReceiptIdGeneration()
        {
            _mockReceiptRepo.Setup(r => r.AddAsync(It.IsAny<GoodsReceipt>(), It.IsAny<CancellationToken>()))
                .Callback<GoodsReceipt, CancellationToken>((receipt, _) => receipt.ReceiptId = GeneratedReceiptId)
                .Returns(Task.CompletedTask);
        }
    }
}

