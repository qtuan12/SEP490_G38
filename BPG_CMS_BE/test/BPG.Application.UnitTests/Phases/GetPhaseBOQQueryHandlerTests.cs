using BPG.Application.Features.Phases.Queries;
using BPG.Application.Features.Phases.Handlers;
using BPG.Application.IRepositories;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using FluentAssertions;
using MockQueryable;
using Moq;

namespace BPG.Application.UnitTests.Phases;

public class GetPhaseBOQQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IGenericRepository<BOQItem>> _boqRepo = new();
    private readonly Mock<IGenericRepository<MaterialRequestItem>> _requestItemRepo = new();
    private readonly Mock<IGenericRepository<DirectPurchaseItem>> _purchaseItemRepo = new();
    private readonly GetPhaseBOQQueryHandler _handler;

    public GetPhaseBOQQueryHandlerTests()
    {
        _uow.Setup(x => x.Repository<BOQItem>()).Returns(_boqRepo.Object);
        _uow.Setup(x => x.Repository<MaterialRequestItem>()).Returns(_requestItemRepo.Object);
        _uow.Setup(x => x.Repository<DirectPurchaseItem>()).Returns(_purchaseItemRepo.Object);
        SetupBoqItems();
        SetupRequestItems();
        SetupPurchaseItems();
        _handler = new GetPhaseBOQQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task UTCID01_Handle_PhaseWithoutBOQ_ShouldReturnEmptyList()
    {
        var result = await _handler.Handle(new GetPhaseBOQQuery(1), CancellationToken.None);
        result.Should().BeEmpty();
    }

    [Fact]
    public async Task UTCID02_Handle_BOQWithoutConsumption_ShouldReturnFullRemainingQuantity()
    {
        SetupBoqItems(new BOQItem
        {
            BOQItemId = 1,
            PhaseId = 1,
            MaterialId = 2,
            Material = new MaterialCatalog { MaterialId = 2, Code = "MAT-2", Name = "Cement", BaseUnit = new Unit() },
            UnitId = 3,
            Unit = new Unit { UnitId = 3, UnitName = "Bag" },
            Quantity = 100,
            ConversionRate = 1
        });

        var result = await _handler.Handle(new GetPhaseBOQQuery(1), CancellationToken.None);

        result.Should().ContainSingle();
        result.Single().AlreadyConsumed.Should().Be(0);
        result.Single().RemainingQuantity.Should().Be(100);
    }

    [Fact]
    public async Task UTCID03_Handle_InternalTransferAndRejectedRequest_ShouldCountOnlyInternalTransfer()
    {
        SetupBoqItems(new BOQItem
        {
            BOQItemId = 1,
            PhaseId = 1,
            MaterialId = 2,
            Material = new MaterialCatalog { MaterialId = 2, Code = "MAT-2", Name = "Cement", BaseUnit = new Unit() },
            UnitId = 3,
            Unit = new Unit { UnitId = 3, UnitName = "Bag" },
            Quantity = 100,
            ConversionRate = 1
        });
        SetupRequestItems(
            RequestItem(1, 60, MaterialRequestProcurementDecision.InternalTransfer),
            RequestItem(2, 30, MaterialRequestProcurementDecision.NotApproved));

        var result = await _handler.Handle(new GetPhaseBOQQuery(1), CancellationToken.None);

        result.Should().ContainSingle();
        result.Single().AlreadyConsumed.Should().Be(60);
        result.Single().RemainingQuantity.Should().Be(40);
    }

    private static MaterialRequestItem RequestItem(long requestId, decimal quantity, string procurementDecision) => new()
    {
        RequestId = requestId,
        MaterialId = 2,
        Quantity = quantity,
        ConversionRate = 1,
        Request = new MaterialRequest
        {
            RequestId = requestId,
            PhaseId = 1,
            Status = MaterialRequestStatus.Rejected,
            ProcurementDecision = procurementDecision,
            IsDeleted = false
        }
    };

    private void SetupBoqItems(params BOQItem[] items) => _boqRepo.Setup(x => x.Query()).Returns(items.AsQueryable().BuildMock());
    private void SetupRequestItems(params MaterialRequestItem[] items) => _requestItemRepo.Setup(x => x.Query()).Returns(items.AsQueryable().BuildMock());
    private void SetupPurchaseItems(params DirectPurchaseItem[] items) => _purchaseItemRepo.Setup(x => x.Query()).Returns(items.AsQueryable().BuildMock());
}
