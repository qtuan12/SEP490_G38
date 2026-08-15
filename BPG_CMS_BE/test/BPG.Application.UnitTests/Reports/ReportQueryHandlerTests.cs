using BPG.Application.Features.Reports.Queries.GetBoqVsActualReport;
using BPG.Application.Features.Reports.Queries.GetIncidentReport;
using BPG.Application.Features.Reports.Queries.GetProcurementReport;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using FluentAssertions;
using MockQueryable;
using MockQueryable.Moq;
using Moq;

namespace BPG.Application.UnitTests.Reports;

public class ReportQueryHandlerTests
{
    private const long ProjectId = 10;
    private const long MaterialId = 20;

    [Fact]
    public async Task BoqReport_ShouldNormalizeQuantityAndUnitPriceToBaseUnit()
    {
        var unit = new Unit { UnitId = 1, UnitName = "kg" };
        var material = new MaterialCatalog
        {
            MaterialId = MaterialId,
            Code = "STEEL",
            Name = "Steel",
            BaseUnitId = unit.UnitId,
            BaseUnit = unit
        };
        var phase = new Phase { PhaseId = 30, ProjectId = ProjectId, Name = "Foundation" };
        var boqItem = new BOQItem
        {
            BOQItemId = 40,
            PhaseId = phase.PhaseId,
            Phase = phase,
            MaterialId = MaterialId,
            Material = material,
            UnitId = unit.UnitId,
            Unit = unit,
            Quantity = 1m,
            ConversionRate = 0.001m
        };

        var task = new ProjectTask { TaskId = 50, PhaseId = phase.PhaseId, Phase = phase };
        var issuance = new MaterialIssuance
        {
            MaterialIssuanceId = 60,
            TaskId = task.TaskId,
            Task = task,
            CreatedAt = new DateTime(2026, 1, 15)
        };
        var issuanceItem = new MaterialIssuanceItem
        {
            IssuanceItemId = 70,
            MaterialIssuanceId = issuance.MaterialIssuanceId,
            Issuance = issuance,
            MaterialId = MaterialId,
            Material = material,
            UnitId = unit.UnitId,
            Unit = unit,
            Quantity = 1_000m,
            ConversionRate = 1m
        };

        var purchaseOrder = new PurchaseOrder
        {
            POId = 80,
            ProjectId = ProjectId,
            Status = PurchaseOrderStatus.FullyReceived,
            Request = new MaterialRequest { PhaseId = phase.PhaseId, Phase = phase }
        };
        var purchaseOrderItem = new PurchaseOrderItem
        {
            POItemId = 90,
            POId = purchaseOrder.POId,
            PurchaseOrder = purchaseOrder,
            MaterialId = MaterialId,
            Material = material,
            UnitId = unit.UnitId,
            Unit = unit,
            Quantity = 1m,
            ConversionRate = 0.001m,
            UnitPrice = 2_000_000m
        };
        purchaseOrder.Items.Add(purchaseOrderItem);

        var unitOfWork = new Mock<IUnitOfWork>();
        SetupRepository(unitOfWork, boqItem);
        SetupRepository<CurrentInventory>(unitOfWork);
        SetupRepository(unitOfWork, issuanceItem);
        SetupRepository<MaterialReturnItem>(unitOfWork);
        SetupRepository(unitOfWork, purchaseOrderItem);
        SetupRepository<GoodsReceiptItem>(unitOfWork);
        SetupRepository<MaterialRequestItem>(unitOfWork);
        SetupRepository<ProjectTask>(unitOfWork);
        SetupRepository<InventoryTransaction>(unitOfWork);

        var handler = new GetBoqVsActualReportQueryHandler(unitOfWork.Object, AccessibleProjects());

        var result = await handler.Handle(new GetBoqVsActualReportQuery(ProjectId), CancellationToken.None);

        var item = result.Data!.Items.Should().ContainSingle().Subject;
        item.BoqLimit.Should().Be(1_000m);
        item.TotalIssued.Should().Be(1_000m);
        item.UnitPrice.Should().Be(2_000m);
        item.ConsumptionValue.Should().Be(2_000_000m);
        item.IsExceeding.Should().BeFalse();
    }

    [Fact]
    public async Task ProcurementReport_ShouldUseBaseUnitPriceForIssuanceValue()
    {
        var phase = new Phase { PhaseId = 30, ProjectId = ProjectId, Name = "Foundation" };
        var purchaseOrder = new PurchaseOrder
        {
            POId = 80,
            ProjectId = ProjectId,
            PONumber = "PO-0080",
            Status = PurchaseOrderStatus.FullyReceived,
            OrderDate = new DateTime(2026, 1, 10),
            TotalAmount = 2_000_000m,
            Request = new MaterialRequest { PhaseId = phase.PhaseId, Phase = phase }
        };
        var purchaseOrderItem = new PurchaseOrderItem
        {
            POItemId = 90,
            POId = purchaseOrder.POId,
            PurchaseOrder = purchaseOrder,
            MaterialId = MaterialId,
            Quantity = 1m,
            ConversionRate = 0.001m,
            UnitPrice = 2_000_000m
        };
        purchaseOrder.Items.Add(purchaseOrderItem);

        var task = new ProjectTask { TaskId = 50, PhaseId = phase.PhaseId, Phase = phase };
        var issuance = new MaterialIssuance
        {
            MaterialIssuanceId = 60,
            TaskId = task.TaskId,
            Task = task,
            CreatedAt = new DateTime(2026, 1, 15)
        };
        var issuanceItem = new MaterialIssuanceItem
        {
            IssuanceItemId = 70,
            MaterialIssuanceId = issuance.MaterialIssuanceId,
            Issuance = issuance,
            MaterialId = MaterialId,
            Quantity = 1_000m,
            ConversionRate = 1m
        };

        var unitOfWork = new Mock<IUnitOfWork>();
        SetupRepository(unitOfWork, purchaseOrder);
        SetupRepository<DirectPurchaseRequest>(unitOfWork);
        SetupRepository<Supplier>(unitOfWork);
        SetupRepository(unitOfWork, issuanceItem);
        SetupRepository(unitOfWork, purchaseOrderItem);

        var handler = new GetProcurementReportQueryHandler(unitOfWork.Object, AccessibleProjects());

        var result = await handler.Handle(new GetProcurementReportQuery(ProjectId), CancellationToken.None);

        result.Data!.TotalMaterialIssuanceValue.Should().Be(2_000_000m);
    }

    [Fact]
    public async Task ProcurementReport_ShouldNotCountDirectPurchaseAutoPoTwice()
    {
        var autoPo = new PurchaseOrder
        {
            POId = 81,
            ProjectId = ProjectId,
            PONumber = "DP-PO-000001",
            Status = PurchaseOrderStatus.FullyReceived,
            OrderDate = new DateTime(2026, 1, 10),
            TotalAmount = 500_000m
        };
        var requester = new User { UserId = 7, FullName = "Buyer" };
        var directPurchase = new DirectPurchaseRequest
        {
            DirectPurchaseId = 1,
            ProjectId = ProjectId,
            AutoPOId = autoPo.POId,
            Status = DirectPurchaseStatus.Approved,
            PurchaseDate = autoPo.OrderDate,
            TotalAmount = autoPo.TotalAmount,
            RequestedBy = requester.UserId,
            Requester = requester
        };

        var unitOfWork = new Mock<IUnitOfWork>();
        SetupRepository(unitOfWork, autoPo);
        SetupRepository(unitOfWork, directPurchase);
        SetupRepository<Supplier>(unitOfWork);
        SetupRepository<MaterialIssuanceItem>(unitOfWork);
        SetupRepository<PurchaseOrderItem>(unitOfWork);

        var handler = new GetProcurementReportQueryHandler(unitOfWork.Object, AccessibleProjects());

        var result = await handler.Handle(new GetProcurementReportQuery(ProjectId), CancellationToken.None);

        result.Data!.TotalPoCost.Should().Be(0m);
        result.Data.TotalDirectPurchaseCost.Should().Be(500_000m);
        result.Data.PurchaseOrders.Should().BeEmpty();
        result.Data.DirectPurchases.Should().ContainSingle();
    }

    [Fact]
    public async Task ProcurementReport_ShouldUseQuantityWeightedHistoricalBasePrice()
    {
        var cutoff = new DateTime(2026, 1, 31);
        var phase = new Phase { PhaseId = 30, ProjectId = ProjectId };
        var task = new ProjectTask { TaskId = 50, PhaseId = phase.PhaseId, Phase = phase };
        var issuance = new MaterialIssuance
        {
            MaterialIssuanceId = 60,
            TaskId = task.TaskId,
            Task = task,
            CreatedAt = new DateTime(2026, 1, 15)
        };
        var issuanceItem = new MaterialIssuanceItem
        {
            IssuanceItemId = 70,
            MaterialIssuanceId = issuance.MaterialIssuanceId,
            Issuance = issuance,
            MaterialId = MaterialId,
            Quantity = 1m,
            ConversionRate = 1m
        };

        var cheapPo = new PurchaseOrder
        {
            POId = 1,
            ProjectId = ProjectId,
            PONumber = "PO-1",
            Status = PurchaseOrderStatus.FullyReceived,
            OrderDate = new DateTime(2026, 1, 1)
        };
        var expensivePo = new PurchaseOrder
        {
            POId = 2,
            ProjectId = ProjectId,
            PONumber = "PO-2",
            Status = PurchaseOrderStatus.FullyReceived,
            OrderDate = new DateTime(2026, 1, 2)
        };
        var futurePo = new PurchaseOrder
        {
            POId = 3,
            ProjectId = ProjectId,
            PONumber = "PO-3",
            Status = PurchaseOrderStatus.FullyReceived,
            OrderDate = new DateTime(2026, 2, 1)
        };
        var priceItems = new[]
        {
            new PurchaseOrderItem { POItemId = 1, POId = 1, PurchaseOrder = cheapPo, MaterialId = MaterialId, Quantity = 9m, ConversionRate = 1m, UnitPrice = 100m },
            new PurchaseOrderItem { POItemId = 2, POId = 2, PurchaseOrder = expensivePo, MaterialId = MaterialId, Quantity = 1m, ConversionRate = 1m, UnitPrice = 1_000m },
            new PurchaseOrderItem { POItemId = 3, POId = 3, PurchaseOrder = futurePo, MaterialId = MaterialId, Quantity = 100m, ConversionRate = 1m, UnitPrice = 9_999m }
        };

        var unitOfWork = new Mock<IUnitOfWork>();
        SetupRepository(unitOfWork, cheapPo, expensivePo, futurePo);
        SetupRepository<DirectPurchaseRequest>(unitOfWork);
        SetupRepository<Supplier>(unitOfWork);
        SetupRepository(unitOfWork, issuanceItem);
        SetupRepository(unitOfWork, priceItems);

        var handler = new GetProcurementReportQueryHandler(unitOfWork.Object, AccessibleProjects());

        var result = await handler.Handle(
            new GetProcurementReportQuery(ProjectId, null, cutoff),
            CancellationToken.None);

        result.Data!.TotalMaterialIssuanceValue.Should().Be(190m);
    }

    [Fact]
    public async Task IncidentReport_ShouldNotCountRejectedIncidentAsOpenOrResolved()
    {
        var reporter = new User { UserId = 1, FullName = "Reporter" };
        var createdAt = new DateTime(2026, 1, 15);
        var incidents = new[]
        {
            Incident(1, "Reported", reporter, createdAt),
            Incident(2, "Approved", reporter, createdAt),
            Incident(3, "Rejected", reporter, createdAt)
        };

        var unitOfWork = new Mock<IUnitOfWork>();
        SetupRepository(unitOfWork, incidents);
        var handler = new GetIncidentReportQueryHandler(unitOfWork.Object, AccessibleProjects());

        var result = await handler.Handle(new GetIncidentReportQuery(ProjectId), CancellationToken.None);

        result.Data!.TotalIncidents.Should().Be(3);
        result.Data.OpenIncidents.Should().Be(1);
        result.Data.ResolvedIncidents.Should().Be(1);
    }

    private static Incident Incident(long id, string status, User reporter, DateTime createdAt)
        => new()
        {
            IncidentId = id,
            ProjectId = ProjectId,
            ReportedBy = reporter.UserId,
            Reporter = reporter,
            IncidentType = "Construction",
            Description = $"Incident {id}",
            Status = status,
            CreatedAt = createdAt
        };

    private static IProjectAccessService AccessibleProjects()
    {
        var service = new Mock<IProjectAccessService>();
        service.Setup(s => s.GetAccessibleProjectIdsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new HashSet<long> { ProjectId });
        return service.Object;
    }

    private static void SetupRepository<T>(Mock<IUnitOfWork> unitOfWork, params T[] data)
        where T : class
    {
        var repository = new Mock<IGenericRepository<T>>();
        repository.Setup(r => r.Query()).Returns(data.AsQueryable().BuildMock());
        unitOfWork.Setup(u => u.Repository<T>()).Returns(repository.Object);
    }
}
