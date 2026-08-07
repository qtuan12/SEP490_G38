using BPG.Application.DTOs.PurchaseOrders;
using BPG.Application.Features.PurchaseOrders.Commands;
using BPG.Application.Features.PurchaseOrders.Handlers;
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

namespace BPG.Application.UnitTests.PurchaseOrders
{
    public class CreatePurchaseOrderCommandHandlerTests
    {
        private const long CurrentUserId = 10;
        private const long ProjectId = 5;
        private const long PhaseId = 7;
        private const long RequestId = 20;
        private const long GeneratedPOId = 300;
        private const long CementId = 50;
        private const int UnitId = 1;
        private const decimal RequestedCementQty = 100m;

        private static readonly DateOnly OrderDate = new(2026, 3, 10);
        private static readonly DateOnly ProjectStart = new(2026, 1, 1);
        private static readonly DateOnly PhaseEnd = new(2026, 12, 31);

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IGenericRepository<MaterialRequest>> _mockRequestRepo;
        private readonly Mock<IGenericRepository<Project>> _mockProjectRepo;
        private readonly Mock<IGenericRepository<PurchaseOrder>> _mockPoRepo;
        private readonly Mock<IGenericRepository<PurchaseOrderItem>> _mockPoItemRepo;
        private readonly Mock<IGenericRepository<GoodsReceiptItem>> _mockReceiptItemRepo;
        private readonly Mock<IGenericRepository<ProjectMember>> _mockMemberRepo;
        private readonly CreatePurchaseOrderCommandHandler _handler;

        public CreatePurchaseOrderCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockRequestRepo = new Mock<IGenericRepository<MaterialRequest>>();
            _mockProjectRepo = new Mock<IGenericRepository<Project>>();
            _mockPoRepo = new Mock<IGenericRepository<PurchaseOrder>>();
            _mockPoItemRepo = new Mock<IGenericRepository<PurchaseOrderItem>>();
            _mockReceiptItemRepo = new Mock<IGenericRepository<GoodsReceiptItem>>();
            _mockMemberRepo = new Mock<IGenericRepository<ProjectMember>>();
            var mockCurrentUserService = new Mock<ICurrentUserService>();

            _mockUow.Setup(u => u.Repository<MaterialRequest>()).Returns(_mockRequestRepo.Object);
            _mockUow.Setup(u => u.Repository<Project>()).Returns(_mockProjectRepo.Object);
            _mockUow.Setup(u => u.Repository<PurchaseOrder>()).Returns(_mockPoRepo.Object);
            _mockUow.Setup(u => u.Repository<PurchaseOrderItem>()).Returns(_mockPoItemRepo.Object);
            _mockUow.Setup(u => u.Repository<GoodsReceiptItem>()).Returns(_mockReceiptItemRepo.Object);
            _mockUow.Setup(u => u.Repository<ProjectMember>()).Returns(_mockMemberRepo.Object);
            _mockUow.Setup(u => u.BeginTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
            _mockUow.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
            _mockUow.Setup(u => u.CommitTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
            _mockUow.Setup(u => u.RollbackTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
            _mockUow.Setup(u => u.ExecuteSqlAsync(It.IsAny<FormattableString>(), It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);

            _mockPoItemRepo.Setup(r => r.AddRangeAsync(It.IsAny<IEnumerable<PurchaseOrderItem>>(), It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);
            _mockPoRepo.Setup(r => r.AddAsync(It.IsAny<PurchaseOrder>(), It.IsAny<CancellationToken>()))
                .Callback<PurchaseOrder, CancellationToken>((po, _) => po.POId = GeneratedPOId)
                .Returns(Task.CompletedTask);

            mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.Accountant);

            SetupMaterialRequests(ApprovedRequest());
            SetupProjects(ProjectEntity());
            SetupExistingPOItems();
            SetupApprovedReceiptItems();
            SetupProjectMembers();
            SetupExistingPurchaseOrders();

            _handler = new CreatePurchaseOrderCommandHandler(
                _mockUow.Object,
                ServiceStubFactory.RealtimeSender(),
                ServiceStubFactory.NotificationService(),
                mockCurrentUserService.Object);
        }

        [Fact]
        public async Task UTCID01_Handle_ValidRequestWithAutoNumber_ShouldReturnCreatedPOId()
        {
            var result = await _handler.Handle(Command(), CancellationToken.None);

            result.Should().Be(GeneratedPOId);
        }

        [Fact]
        public async Task UTCID02_Handle_MaterialRequestNotFound_ShouldThrowNotFoundException()
        {
            SetupMaterialRequests();

            Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<NotFoundException>();
            exception.Which.ErrorCode.Should().Be("BIZ_001");
        }

        [Fact]
        public async Task UTCID03_Handle_MaterialRequestNotApproved_ShouldThrowBusinessException()
        {
            SetupMaterialRequests(ApprovedRequest(status: MaterialRequestStatus.Pending));

            Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be(ErrorCodes.PoRequestNotApproved);
        }

        [Fact]
        public async Task UTCID04_Handle_ProjectNotFound_ShouldThrowNotFoundException()
        {
            SetupProjects();

            Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<NotFoundException>();
            exception.Which.ErrorCode.Should().Be("BIZ_001");
        }

        [Fact]
        public async Task UTCID05_Handle_OrderDateBeforeProjectStart_ShouldThrowBusinessException()
        {
            var command = Command(orderDate: ProjectStart.AddDays(-1));

            Func<Task> act = () => _handler.Handle(command, CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be(ErrorCodes.PoOrderDateBeforeProject);
        }

        [Fact]
        public async Task UTCID06_Handle_OrderDateAfterPhaseEnd_ShouldThrowBusinessException()
        {
            var command = Command(orderDate: PhaseEnd.AddDays(1));

            Func<Task> act = () => _handler.Handle(command, CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be(ErrorCodes.PoOrderDateAfterPhase);
        }

        [Fact]
        public async Task UTCID07_Handle_DeliveryDateBeforeProjectStart_ShouldThrowBusinessException()
        {
            var command = Command(expectedDeliveryDate: ProjectStart.AddDays(-1));

            Func<Task> act = () => _handler.Handle(command, CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be(ErrorCodes.PoDeliveryDateBeforeProject);
        }

        [Fact]
        public async Task UTCID08_Handle_DeliveryDateAfterPhaseEnd_ShouldThrowBusinessException()
        {
            var command = Command(expectedDeliveryDate: PhaseEnd.AddDays(1));

            Func<Task> act = () => _handler.Handle(command, CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be(ErrorCodes.PoDeliveryDateAfterPhase);
        }

        [Fact]
        public async Task UTCID09_Handle_MaterialNotInLinkedRequest_ShouldThrowBusinessException()
        {
            var command = Command(items: [Item(materialId: 99, quantity: 5)]);

            Func<Task> act = () => _handler.Handle(command, CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be(ErrorCodes.PoMaterialNotInRequest);
        }

        [Fact]
        public async Task UTCID10_Handle_QuantityExceedsRemainingOfRequest_ShouldThrowBusinessException()
        {
            SetupExistingPOItems(ExistingPOItem(poId: 200, PurchaseOrderStatus.Sent, quantity: 60));

            var command = Command(items: [Item(CementId, quantity: 41)]);

            Func<Task> act = () => _handler.Handle(command, CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be(ErrorCodes.PoQtyExceedsRequest);
        }

        [Fact]
        public async Task UTCID11_Handle_QuantityEqualsRemainingOfRequest_ShouldReturnCreatedPOId()
        {
            SetupExistingPOItems(ExistingPOItem(poId: 200, PurchaseOrderStatus.Sent, quantity: 60));

            var result = await _handler.Handle(Command(items: [Item(CementId, quantity: 40)]), CancellationToken.None);

            result.Should().Be(GeneratedPOId);
        }

        [Fact]
        public async Task UTCID12_Handle_CancelledAndRejectedPOsDoNotHoldQuantity_ShouldReturnCreatedPOId()
        {
            SetupExistingPOItems(
                ExistingPOItem(poId: 200, PurchaseOrderStatus.Cancelled, quantity: 60),
                ExistingPOItem(poId: 201, PurchaseOrderStatus.Rejected, quantity: 40));

            var result = await _handler.Handle(Command(items: [Item(CementId, RequestedCementQty)]), CancellationToken.None);

            result.Should().Be(GeneratedPOId);
        }

        [Fact]
        public async Task UTCID13_Handle_ClosedPOOnlyHoldsReceivedQuantity_ShouldThrowWhenExceedingReleasedRemainder()
        {
            // PO đã đóng đặt 60 nhưng chỉ nhận 20 → chỉ 20 còn giữ chỗ, còn được đặt tối đa 80.
            SetupExistingPOItems(ExistingPOItem(poId: 200, PurchaseOrderStatus.Closed, quantity: 60));
            SetupApprovedReceiptItems(ApprovedReceiptItem(poId: 200, quantity: 20));

            Func<Task> act = () => _handler.Handle(Command(items: [Item(CementId, quantity: 81)]), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be(ErrorCodes.PoQtyExceedsRequest);
        }

        [Fact]
        public async Task UTCID14_Handle_FractionalQuantityForDiscreteUnit_ShouldThrowBusinessException()
        {
            SetupMaterialRequests(ApprovedRequest(isDiscreteUnit: true));

            var command = Command(items: [Item(CementId, quantity: 1.5m)]);

            Func<Task> act = () => _handler.Handle(command, CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be(ErrorCodes.InvalidUnitQuantity);
        }

        [Fact]
        public async Task UTCID15_Handle_ManualPONumberAlreadyExists_ShouldThrowBusinessException()
        {
            SetupExistingPurchaseOrders(new PurchaseOrder { POId = 200, PONumber = "PO-20260310-0001" });

            var command = Command(poNumber: "PO-20260310-0001");

            Func<Task> act = () => _handler.Handle(command, CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be(ErrorCodes.PoNumberExists);
        }

        [Fact]
        public async Task UTCID16_Handle_ManualPONumberNotUsed_ShouldReturnCreatedPOId()
        {
            var result = await _handler.Handle(Command(poNumber: "PO-CUSTOM-01"), CancellationToken.None);

            result.Should().Be(GeneratedPOId);
        }

        private static CreatePurchaseOrderCommand Command(
            string? poNumber = null,
            DateOnly? orderDate = null,
            DateOnly? expectedDeliveryDate = null,
            long requestId = RequestId,
            IEnumerable<CreatePOItemDto>? items = null)
            => new()
            {
                PONumber = poNumber,
                OrderDate = orderDate ?? OrderDate,
                SupplierId = 30,
                ProjectId = ProjectId,
                ExpectedDeliveryDate = expectedDeliveryDate,
                DeliveryAddress = "Công trường Long Biên",
                Notes = "Giao trong giờ hành chính",
                RequestId = requestId,
                Items = items?.ToList() ?? [Item(CementId, quantity: 10)]
            };

        private static CreatePOItemDto Item(long materialId, decimal quantity)
            => new()
            {
                MaterialId = materialId,
                UnitId = UnitId,
                Quantity = quantity,
                UnitPrice = 1_500_000m
            };

        private static MaterialRequest ApprovedRequest(
            string status = MaterialRequestStatus.Approved,
            bool isDiscreteUnit = false)
            => new()
            {
                RequestId = RequestId,
                PhaseId = PhaseId,
                Status = status,
                Reason = "Đổ bê tông sàn tầng 2",
                Phase = new Phase
                {
                    PhaseId = PhaseId,
                    ProjectId = ProjectId,
                    Name = "Phần thô",
                    EndDate = PhaseEnd
                },
                Items =
                [
                    new MaterialRequestItem
                    {
                        RequestItemId = 1,
                        RequestId = RequestId,
                        MaterialId = CementId,
                        UnitId = UnitId,
                        Quantity = RequestedCementQty,
                        Material = new MaterialCatalog
                        {
                            MaterialId = CementId,
                            Code = "XM-01",
                            Name = "Xi măng PCB40",
                            BaseUnit = new Unit { UnitId = UnitId, UnitName = "Bao", IsDiscrete = isDiscreteUnit }
                        }
                    }
                ]
            };

        private static Project ProjectEntity()
            => new()
            {
                ProjectId = ProjectId,
                Name = "Nhà máy Bắc Ninh",
                Status = ProjectStatus.InProgress,
                PlannedStart = ProjectStart,
                PlannedEnd = new DateOnly(2027, 1, 1)
            };

        private static PurchaseOrderItem ExistingPOItem(long poId, string poStatus, decimal quantity)
            => new()
            {
                POId = poId,
                MaterialId = CementId,
                UnitId = UnitId,
                Quantity = quantity,
                PurchaseOrder = new PurchaseOrder
                {
                    POId = poId,
                    RequestId = RequestId,
                    ProjectId = ProjectId,
                    Status = poStatus
                }
            };

        private static GoodsReceiptItem ApprovedReceiptItem(long poId, decimal quantity)
            => new()
            {
                MaterialId = CementId,
                Quantity = quantity,
                Receipt = new GoodsReceipt { POId = poId, Status = GoodsReceiptStatus.Approved }
            };

        private void SetupMaterialRequests(params MaterialRequest[] requests)
            => _mockRequestRepo.Setup(r => r.Query()).Returns(requests.AsQueryable().BuildMock());

        private void SetupProjects(params Project[] projects)
            => _mockProjectRepo.Setup(r => r.Query()).Returns(projects.AsQueryable().BuildMock());

        private void SetupExistingPOItems(params PurchaseOrderItem[] items)
            => _mockPoItemRepo.Setup(r => r.Query()).Returns(items.AsQueryable().BuildMock());

        private void SetupApprovedReceiptItems(params GoodsReceiptItem[] items)
            => _mockReceiptItemRepo.Setup(r => r.Query()).Returns(items.AsQueryable().BuildMock());

        private void SetupProjectMembers(params ProjectMember[] members)
            => _mockMemberRepo.Setup(r => r.Query()).Returns(members.AsQueryable().BuildMock());

        private void SetupExistingPurchaseOrders(params PurchaseOrder[] purchaseOrders)
            => _mockPoRepo.Setup(r => r.Query()).Returns(purchaseOrders.AsQueryable().BuildMock());
    }
}
