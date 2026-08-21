using BPG.Application.Features.MaterialRequests.Handlers;
using BPG.Application.Features.MaterialRequests.Queries;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Application.UnitTests.Helpers;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using MockQueryable;
using MockQueryable.Moq;
using Moq;
using RoleConstants = BPG.Domain.Constants.UserRole;

namespace BPG.Application.UnitTests.MaterialRequests;

public sealed class GetMaterialRequestAssessmentQueryHandlerTests
{
    private const long RequestId = 100;
    private const long ProjectId = 10;
    private const long MaterialId = 50;

    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<ICurrentUserService> _currentUser = new();
    private readonly Mock<IProjectAccessService> _projectAccess = new();
    private readonly Mock<IGenericRepository<MaterialRequest>> _requestRepository = new();
    private readonly Mock<IGenericRepository<CurrentInventory>> _inventoryRepository = new();
    private readonly Mock<IGenericRepository<PurchaseOrderItem>> _poItemRepository = new();
    private readonly Mock<IGenericRepository<GoodsReceiptItem>> _receiptItemRepository = new();
    private readonly Mock<IGenericRepository<SurplusRequestItem>> _surplusItemRepository = new();
    private readonly GetMaterialRequestAssessmentQueryHandler _handler;

    public GetMaterialRequestAssessmentQueryHandlerTests()
    {
        _uow.Setup(unit => unit.Repository<MaterialRequest>()).Returns(_requestRepository.Object);
        _uow.Setup(unit => unit.Repository<CurrentInventory>()).Returns(_inventoryRepository.Object);
        _uow.Setup(unit => unit.Repository<PurchaseOrderItem>()).Returns(_poItemRepository.Object);
        _uow.Setup(unit => unit.Repository<GoodsReceiptItem>()).Returns(_receiptItemRepository.Object);
        _uow.Setup(unit => unit.Repository<SurplusRequestItem>()).Returns(_surplusItemRepository.Object);

        _currentUser.SetupUser(20, RoleConstants.Accountant);
        _projectAccess.Setup(service => service.GetAccessibleProjectIdsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new HashSet<long> { ProjectId, 20, 30 });

        SetQuery(_requestRepository, new[] { ValidRequest() });
        SetQuery(_inventoryRepository, Array.Empty<CurrentInventory>());
        SetQuery(_poItemRepository, Array.Empty<PurchaseOrderItem>());
        SetQuery(_receiptItemRepository, Array.Empty<GoodsReceiptItem>());
        SetQuery(_surplusItemRepository, Array.Empty<SurplusRequestItem>());

        _handler = new GetMaterialRequestAssessmentQueryHandler(
            _uow.Object,
            _currentUser.Object,
            _projectAccess.Object);
    }

    [Fact]
    public async Task UTCID01_Handle_AccountantWithValidData_ShouldReturnConvertedAssessment()
    {
        var activePO = PurchaseOrder(1, "PO-2026-018", PurchaseOrderStatus.PartiallyReceived, ProjectId, new DateTime(2026, 8, 1));
        var activePOItem = POItem(activePO, quantity: 20, conversionRate: 0.02m, unitPrice: 198_000m);
        var approvedReceipt = ReceiptItem(activePO, quantity: 5, conversionRate: 0.02m, GoodsReceiptStatus.Approved);
        var cancelledReceipt = ReceiptItem(activePO, quantity: 4, conversionRate: 0.02m, GoodsReceiptStatus.Cancelled);
        var sourceProject = new Project { ProjectId = 20, Name = "Biệt thự An Khánh", Status = ProjectStatus.InProgress };

        SetQuery(_inventoryRepository, new[]
        {
            new CurrentInventory { ProjectId = ProjectId, MaterialId = MaterialId, Quantity = 150 },
            new CurrentInventory { ProjectId = 20, MaterialId = MaterialId, Quantity = 1_000, ReservedQuantity = 250 }
        });
        SetQuery(_poItemRepository, new[] { activePOItem });
        SetQuery(_receiptItemRepository, new[] { approvedReceipt, cancelledReceipt });
        SetQuery(_surplusItemRepository, new[]
        {
            SurplusItem(sourceProject, quantity: 1_000, processedQuantity: 100)
        });

        var result = await _handler.Handle(new GetMaterialRequestAssessmentQuery(RequestId), CancellationToken.None);

        var item = result.Items.Should().ContainSingle().Subject;
        item.ProjectInventoryQuantity.Should().Be(3);
        item.ActiveSupplies.Should().ContainSingle().Which.Should().BeEquivalentTo(new
        {
            POId = 1L,
            PONumber = "PO-2026-018",
            RemainingQuantity = 15m
        });
        item.InternalSources.Should().ContainSingle().Which.Should().BeEquivalentTo(new
        {
            ProjectId = 20L,
            ProjectName = "Biệt thự An Khánh",
            AvailableQuantity = 15m
        });
        item.LastPurchasePrice.Should().NotBeNull();
        item.LastPurchasePrice!.UnitPrice.Should().Be(198_000m);
        item.LastPurchasePrice.OrderDate.Should().Be(new DateOnly(2026, 8, 1));
    }

    [Fact]
    public async Task UTCID02_Handle_MultiplePOStatuses_ShouldReturnOnlyPositiveSentOrPartialRemainders()
    {
        var sent = PurchaseOrder(1, "PO-SENT", PurchaseOrderStatus.Sent, ProjectId, new DateTime(2026, 8, 1));
        var partial = PurchaseOrder(2, "PO-PARTIAL", PurchaseOrderStatus.PartiallyReceived, ProjectId, new DateTime(2026, 8, 2));
        var pending = PurchaseOrder(3, "PO-PENDING", PurchaseOrderStatus.PendingApproval, ProjectId, new DateTime(2026, 8, 3));
        var fullyReceived = PurchaseOrder(4, "PO-FULL", PurchaseOrderStatus.FullyReceived, ProjectId, new DateTime(2026, 8, 4));
        var overReceived = PurchaseOrder(5, "PO-OVER-RECEIVED", PurchaseOrderStatus.Sent, ProjectId, new DateTime(2026, 8, 2));
        SetQuery(_poItemRepository, new[]
        {
            POItem(sent, 20, 0.02m, 190_000),
            POItem(partial, 10, 0.02m, 195_000),
            POItem(pending, 30, 0.02m, 200_000),
            POItem(fullyReceived, 40, 0.02m, 210_000),
            POItem(overReceived, 2, 0.02m, 180_000)
        });
        SetQuery(_receiptItemRepository, new[]
        {
            ReceiptItem(sent, 5, 0.02m, GoodsReceiptStatus.Approved),
            ReceiptItem(partial, 4, 0.02m, GoodsReceiptStatus.Approved),
            ReceiptItem(overReceived, 3, 0.02m, GoodsReceiptStatus.Approved)
        });

        var result = await _handler.Handle(new GetMaterialRequestAssessmentQuery(RequestId), CancellationToken.None);

        var item = result.Items.Single();
        item.ActiveSupplies.Should().BeEquivalentTo(new[]
        {
            new { POId = 2L, PONumber = "PO-PARTIAL", RemainingQuantity = 6m },
            new { POId = 1L, PONumber = "PO-SENT", RemainingQuantity = 15m }
        });
        item.ActiveSupplies.Should().NotContain(supply => supply.PONumber == "PO-OVER-RECEIVED");
        item.LastPurchasePrice!.PONumber.Should().Be("PO-FULL");
        item.LastPurchasePrice.UnitPrice.Should().Be(210_000m);
    }

    [Fact]
    public async Task UTCID03_Handle_InternalSources_ShouldIncludeOnlyConfirmedAccessibleActiveAvailability()
    {
        var validProject = new Project { ProjectId = 20, Name = "Nguồn hợp lệ", Status = ProjectStatus.InProgress };
        var pausedProject = new Project { ProjectId = 30, Name = "Đã tạm dừng", Status = ProjectStatus.Paused };
        var inaccessibleProject = new Project { ProjectId = 40, Name = "Không có quyền", Status = ProjectStatus.InProgress };
        SetQuery(_surplusItemRepository, new[]
        {
            SurplusItem(validProject, 1_000, 100),
            SurplusItem(pausedProject, 1_000, 0),
            SurplusItem(inaccessibleProject, 1_000, 0),
            SurplusItem(validProject, 500, 0, SurplusRequestItemStatus.Completed)
        });
        SetQuery(_inventoryRepository, new[]
        {
            new CurrentInventory { ProjectId = 20, MaterialId = MaterialId, Quantity = 700, ReservedQuantity = 200 },
            new CurrentInventory { ProjectId = 30, MaterialId = MaterialId, Quantity = 900 },
            new CurrentInventory { ProjectId = 40, MaterialId = MaterialId, Quantity = 900 }
        });

        var result = await _handler.Handle(new GetMaterialRequestAssessmentQuery(RequestId), CancellationToken.None);

        result.Items.Single().InternalSources.Should().ContainSingle().Which.Should().BeEquivalentTo(new
        {
            ProjectId = 20L,
            ProjectName = "Nguồn hợp lệ",
            AvailableQuantity = 10m
        });
    }

    [Fact]
    public async Task UTCID04_Handle_NoReferenceData_ShouldReturnZeroAndEmptyReferences()
    {
        var result = await _handler.Handle(new GetMaterialRequestAssessmentQuery(RequestId), CancellationToken.None);

        var item = result.Items.Single();
        item.ProjectInventoryQuantity.Should().Be(0);
        item.ActiveSupplies.Should().BeEmpty();
        item.InternalSources.Should().BeEmpty();
        item.LastPurchasePrice.Should().BeNull();
    }

    [Fact]
    public async Task UTCID05_Handle_LegacyZeroConversionRates_ShouldUseSafeFallback()
    {
        SetQuery(_requestRepository, new[] { ValidRequest(conversionRate: 0) });
        var po = PurchaseOrder(1, "PO-ZERO-RATE", PurchaseOrderStatus.Sent, ProjectId, new DateTime(2026, 8, 1));
        SetQuery(_poItemRepository, new[] { POItem(po, 10, 0, 100) });
        SetQuery(_inventoryRepository, new[]
        {
            new CurrentInventory { ProjectId = ProjectId, MaterialId = MaterialId, Quantity = 4 }
        });

        var result = await _handler.Handle(new GetMaterialRequestAssessmentQuery(RequestId), CancellationToken.None);

        var item = result.Items.Single();
        item.ProjectInventoryQuantity.Should().Be(4);
        item.ActiveSupplies.Single().RemainingQuantity.Should().Be(10);
        item.LastPurchasePrice!.UnitPrice.Should().Be(100);
    }

    [Fact]
    public async Task UTCID06_Handle_SiteEngineer_ShouldThrowForbiddenException()
    {
        _currentUser.SetupUser(21, RoleConstants.SiteEngineer);

        Func<Task> act = () => _handler.Handle(
            new GetMaterialRequestAssessmentQuery(RequestId),
            CancellationToken.None);

        await act.Should().ThrowAsync<ForbiddenException>();
    }

    [Fact]
    public async Task UTCID07_Handle_InaccessibleProject_ShouldThrowForbiddenException()
    {
        _projectAccess.Setup(service => service.GetAccessibleProjectIdsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new HashSet<long> { 20 });

        Func<Task> act = () => _handler.Handle(
            new GetMaterialRequestAssessmentQuery(RequestId),
            CancellationToken.None);

        await act.Should().ThrowAsync<ForbiddenException>();
    }

    [Fact]
    public async Task UTCID08_Handle_RequestDoesNotExist_ShouldThrowNotFoundException()
    {
        SetQuery(_requestRepository, Array.Empty<MaterialRequest>());

        Func<Task> act = () => _handler.Handle(
            new GetMaterialRequestAssessmentQuery(999),
            CancellationToken.None);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    private static MaterialRequest ValidRequest(decimal conversionRate = 0.02m)
    {
        var unit = new Unit { UnitId = 2, UnitName = "Bao (50kg)" };
        var request = new MaterialRequest
        {
            RequestId = RequestId,
            Phase = new Phase { PhaseId = 5, ProjectId = ProjectId },
            Items = new List<MaterialRequestItem>()
        };
        request.Items.Add(new MaterialRequestItem
        {
            RequestItemId = 101,
            RequestId = RequestId,
            Request = request,
            MaterialId = MaterialId,
            UnitId = unit.UnitId,
            Unit = unit,
            Quantity = 20,
            ConversionRate = conversionRate
        });
        return request;
    }

    private static PurchaseOrder PurchaseOrder(
        long poId,
        string poNumber,
        string status,
        long projectId,
        DateTime orderDate) => new()
        {
            POId = poId,
            PONumber = poNumber,
            Status = status,
            ProjectId = projectId,
            OrderDate = orderDate
        };

    private static PurchaseOrderItem POItem(
        PurchaseOrder po,
        decimal quantity,
        decimal conversionRate,
        decimal unitPrice) => new()
        {
            POItemId = po.POId * 10,
            POId = po.POId,
            PurchaseOrder = po,
            MaterialId = MaterialId,
            Quantity = quantity,
            ConversionRate = conversionRate,
            UnitPrice = unitPrice
        };

    private static GoodsReceiptItem ReceiptItem(
        PurchaseOrder po,
        decimal quantity,
        decimal conversionRate,
        string status) => new()
        {
            MaterialId = MaterialId,
            Quantity = quantity,
            ConversionRate = conversionRate,
            Receipt = new GoodsReceipt { POId = po.POId, PurchaseOrder = po, Status = status }
        };

    private static SurplusRequestItem SurplusItem(
        Project project,
        decimal quantity,
        decimal processedQuantity,
        string itemStatus = SurplusRequestItemStatus.Pending) => new()
        {
            MaterialId = MaterialId,
            Quantity = quantity,
            ProcessedQuantity = processedQuantity,
            ConversionRate = 1,
            Status = itemStatus,
            SurplusRequest = new SurplusRequest
            {
                ProjectId = project.ProjectId,
                Project = project,
                Status = SurplusRequestStatus.Processing
            }
        };

    private static void SetQuery<T>(Mock<IGenericRepository<T>> repository, IEnumerable<T> data)
        where T : class =>
        repository.Setup(item => item.Query()).Returns(data.AsQueryable().BuildMock());
}
