using BPG.Application.Features.Reports.Queries.GetBoqVsActualReport;
using BPG.Application.Features.Reports.Queries.GetCostReferenceReport;
using BPG.Application.Features.Reports.Queries.GetConstructionProgressReport;
using BPG.Application.Features.Reports.Queries.GetExecutiveDashboard;
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
        SetupRepository<DirectPurchaseRequest>(unitOfWork);

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
    public async Task ProcurementReport_ShouldExcludeRejectedDirectPurchaseAutoPoFromEveryMoneyValue()
    {
        var autoPo = new PurchaseOrder
        {
            POId = 82,
            ProjectId = ProjectId,
            PONumber = "DP-PO-000002",
            Status = PurchaseOrderStatus.FullyReceived,
            OrderDate = new DateTime(2026, 1, 10),
            TotalAmount = 900_000m
        };
        var autoPoItem = new PurchaseOrderItem
        {
            POItemId = 92,
            POId = autoPo.POId,
            PurchaseOrder = autoPo,
            MaterialId = MaterialId,
            Quantity = 1m,
            ConversionRate = 1m,
            UnitPrice = 900_000m
        };
        autoPo.Items.Add(autoPoItem);

        var rejectedDirectPurchase = new DirectPurchaseRequest
        {
            DirectPurchaseId = 2,
            ProjectId = ProjectId,
            AutoPOId = autoPo.POId,
            Status = DirectPurchaseStatus.Rejected,
            PurchaseDate = autoPo.OrderDate,
            TotalAmount = autoPo.TotalAmount
        };

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

        var unitOfWork = new Mock<IUnitOfWork>();
        SetupRepository(unitOfWork, autoPo);
        SetupRepository(unitOfWork, rejectedDirectPurchase);
        SetupRepository<Supplier>(unitOfWork);
        SetupRepository(unitOfWork, issuanceItem);
        SetupRepository(unitOfWork, autoPoItem);

        var handler = new GetProcurementReportQueryHandler(unitOfWork.Object, AccessibleProjects());
        var result = await handler.Handle(new GetProcurementReportQuery(ProjectId), CancellationToken.None);

        result.Data!.TotalPoCost.Should().Be(0m);
        result.Data.TotalDirectPurchaseCost.Should().Be(0m);
        result.Data.TotalMaterialIssuanceValue.Should().Be(0m);
        result.Data.PurchaseOrders.Should().BeEmpty();
        result.Data.DirectPurchases.Should().BeEmpty();
    }

    [Fact]
    public async Task CostReferenceReport_ShouldOnlyCountNormalPoAndApprovedDirectPurchase()
    {
        var normalPo = PurchaseOrderWithItem(1, "PO-1", 100_000m);
        var approvedAutoPo = PurchaseOrderWithItem(2, "DP-PO-000010", 200_000m);
        var rejectedAutoPo = PurchaseOrderWithItem(3, "DP-PO-000011", 300_000m);

        var approvedDirectPurchase = DirectPurchase(10, approvedAutoPo, DirectPurchaseStatus.Approved);
        var rejectedDirectPurchase = DirectPurchase(11, rejectedAutoPo, DirectPurchaseStatus.Rejected);

        var unitOfWork = new Mock<IUnitOfWork>();
        SetupRepository(unitOfWork, normalPo, approvedAutoPo, rejectedAutoPo);
        SetupRepository(unitOfWork, approvedDirectPurchase, rejectedDirectPurchase);

        var handler = new GetCostReferenceReportQueryHandler(unitOfWork.Object, AccessibleProjects());
        var result = await handler.Handle(new GetCostReferenceReportQuery(ProjectId), CancellationToken.None);

        result.Data!.TotalPoCost.Should().Be(100_000m);
        result.Data.TotalDirectPurchaseCost.Should().Be(200_000m);
        result.Data.TotalCost.Should().Be(300_000m);
    }

    [Fact]
    public async Task ExecutiveDashboard_ShouldExcludeRejectedAutoPoAndIncludeApprovedDirectPurchaseOnce()
    {
        var reportFrom = new DateTime(2026, 1, 1);
        var reportTo = new DateTime(2026, 1, 31);
        var normalPo = PurchaseOrderWithItem(1, "PO-1", 100_000m, reportFrom.AddDays(2));
        var approvedAutoPo = PurchaseOrderWithItem(2, "DP-PO-000020", 200_000m, reportFrom.AddDays(3));
        var rejectedAutoPo = PurchaseOrderWithItem(3, "DP-PO-000021", 300_000m, reportFrom.AddDays(4));
        var approvedDirectPurchase = DirectPurchase(20, approvedAutoPo, DirectPurchaseStatus.Approved);
        var rejectedDirectPurchase = DirectPurchase(21, rejectedAutoPo, DirectPurchaseStatus.Rejected);

        var unitOfWork = new Mock<IUnitOfWork>();
        SetupRepository<Phase>(unitOfWork);
        SetupRepository<Incident>(unitOfWork);
        SetupRepository<MaterialRequest>(unitOfWork);
        SetupRepository<Project>(unitOfWork);
        SetupRepository(unitOfWork, normalPo, approvedAutoPo, rejectedAutoPo);
        SetupRepository(unitOfWork, approvedDirectPurchase, rejectedDirectPurchase);

        var handler = new GetExecutiveDashboardQueryHandler(unitOfWork.Object, AccessibleProjects());
        var result = await handler.Handle(
            new GetExecutiveDashboardQuery(ProjectId, reportFrom, reportTo),
            CancellationToken.None);

        result.Data!.PeriodComparison!.CurrentProcurementCost.Should().Be(300_000m);
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
    public async Task ConstructionProgressReport_ShouldMatchWbsLeafTaskDurationWeighting()
    {
        var project = new Project
        {
            ProjectId = ProjectId,
            PlannedStart = new DateOnly(2026, 1, 1),
            PlannedEnd = new DateOnly(2026, 12, 31),
            Status = ProjectStatus.InProgress
        };
        var phase = new Phase
        {
            PhaseId = 30,
            ProjectId = ProjectId,
            Project = project,
            Name = "Execution",
            Status = PhaseStatus.InProgress,
            StartDate = new DateOnly(2026, 8, 1),
            EndDate = new DateOnly(2026, 8, 10)
        };
        var parent = ProgressTask(50, phase, "Parent summary", 100, new DateOnly(2026, 8, 1), new DateOnly(2026, 8, 10));
        var shortLeaf = ProgressTask(51, phase, "Short leaf", 100, new DateOnly(2026, 8, 1), new DateOnly(2026, 8, 1), parent.TaskId, 2m);
        var longLeaf = ProgressTask(52, phase, "Long leaf", 0, new DateOnly(2026, 8, 1), new DateOnly(2026, 8, 3), parent.TaskId, 1m);
        phase.Tasks.Add(parent);
        phase.Tasks.Add(shortLeaf);
        phase.Tasks.Add(longLeaf);

        var unitOfWork = new Mock<IUnitOfWork>();
        SetupRepository(unitOfWork, phase);
        SetupRepository<SystemConfig>(unitOfWork);

        var projectRepository = new Mock<IGenericRepository<Project>>();
        projectRepository.Setup(r => r.Query()).Returns(new[] { project }.AsQueryable().BuildMock());
        projectRepository.Setup(r => r.GetByIdAsync(ProjectId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(project);
        unitOfWork.Setup(u => u.Repository<Project>()).Returns(projectRepository.Object);

        var handler = new GetConstructionProgressReportQueryHandler(unitOfWork.Object, AccessibleProjects());

        var result = await handler.Handle(
            new GetConstructionProgressReportQuery(ProjectId),
            CancellationToken.None);

        var report = result.Data!;
        report.TotalTasks.Should().Be(2);
        report.DoneTasks.Should().Be(1);
        report.OverallProgressPercent.Should().Be(40m);
        var phaseReport = report.Phases.Should().ContainSingle().Which;
        phaseReport.TotalTasks.Should().Be(2);
        phaseReport.CompletedTasks.Should().Be(1);
        phaseReport.ProgressPercent.Should().Be(40m);
        phaseReport.AllTasks.Select(t => t.TaskId).Should().BeEquivalentTo(new[] { shortLeaf.TaskId, longLeaf.TaskId });

        var historicalResult = await handler.Handle(
            new GetConstructionProgressReportQuery(
                ProjectId,
                new DateTime(2026, 8, 2),
                new DateTime(2026, 8, 3)),
            CancellationToken.None);

        historicalResult.Data!.TotalTasks.Should().Be(2, "the report period must not change the WBS progress denominator");
        historicalResult.Data.ScheduleVarianceDays.Should().Be(0, "a leaf task is not overdue until the day after its deadline");
        historicalResult.Data.Phases.SelectMany(p => p.DelayedTasks).Should().BeEmpty();
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

    private static ProjectTask ProgressTask(
        long id,
        Phase phase,
        string name,
        byte progress,
        DateOnly start,
        DateOnly end,
        long? parentTaskId = null,
        decimal? weight = 1m)
        => new()
        {
            TaskId = id,
            PhaseId = phase.PhaseId,
            Phase = phase,
            ParentTaskId = parentTaskId,
            Name = name,
            StartDate = start,
            EndDate = end,
            ProgressPercent = progress,
            Weight = weight,
            Status = progress >= 100 ? BPG.Domain.Constants.TaskStatus.Completed : BPG.Domain.Constants.TaskStatus.Assigned,
            CreatedAt = DateTime.UtcNow.AddYears(-1)
        };

    private static PurchaseOrder PurchaseOrderWithItem(
        long id,
        string number,
        decimal amount,
        DateTime? orderDate = null)
    {
        var po = new PurchaseOrder
        {
            POId = id,
            ProjectId = ProjectId,
            PONumber = number,
            Status = PurchaseOrderStatus.FullyReceived,
            OrderDate = orderDate ?? new DateTime(2026, 1, 10),
            TotalAmount = amount
        };
        po.Items.Add(new PurchaseOrderItem
        {
            POItemId = id,
            POId = id,
            PurchaseOrder = po,
            MaterialId = MaterialId,
            Quantity = 1m,
            ConversionRate = 1m,
            UnitPrice = amount,
            LineTotal = amount
        });
        return po;
    }

    private static DirectPurchaseRequest DirectPurchase(
        long id,
        PurchaseOrder autoPo,
        string status)
    {
        var directPurchase = new DirectPurchaseRequest
        {
            DirectPurchaseId = id,
            ProjectId = ProjectId,
            AutoPOId = autoPo.POId,
            Status = status,
            PurchaseDate = autoPo.OrderDate,
            TotalAmount = autoPo.TotalAmount
        };
        directPurchase.Items.Add(new DirectPurchaseItem
        {
            DirectPurchaseItemId = id,
            DirectPurchaseId = id,
            MaterialId = MaterialId,
            Quantity = 1m,
            ConversionRate = 1m,
            UnitPrice = autoPo.TotalAmount,
            LineTotal = autoPo.TotalAmount
        });
        return directPurchase;
    }

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
