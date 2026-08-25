using BPG.Application.Features.Surplus.Handlers;
using BPG.Application.Features.Surplus.Queries;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using MockQueryable;
using Moq;

namespace BPG.Application.UnitTests.Surplus;

public class GetSurplusRequestDetailQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IGenericRepository<SurplusRequest>> _requestRepo = new();
    private readonly Mock<IGenericRepository<CurrentInventory>> _inventoryRepo = new();
    private readonly Mock<IGenericRepository<User>> _userRepo = new();
    private readonly Mock<ISurplusMaterialSupplierService> _supplierService = new();
    private readonly Mock<IProjectAccessService> _projectAccessService = new();
    private readonly GetSurplusRequestDetailQueryHandler _handler;

    public GetSurplusRequestDetailQueryHandlerTests()
    {
        _uow.Setup(x => x.Repository<SurplusRequest>()).Returns(_requestRepo.Object);
        _uow.Setup(x => x.Repository<CurrentInventory>()).Returns(_inventoryRepo.Object);
        _uow.Setup(x => x.Repository<User>()).Returns(_userRepo.Object);
        SetupRequests(Request());
        _inventoryRepo.Setup(x => x.Query()).Returns(new[]
        {
            new CurrentInventory { ProjectId = 3, MaterialId = 4, Quantity = 15, ReservedQuantity = 2 }
        }.AsQueryable().BuildMock());
        _userRepo.Setup(x => x.GetByIdAsync(9, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new User { UserId = 9, FullName = "Project Leader" });
        _supplierService.Setup(x => x.GetLatestApprovedSuppliersAsync(3, It.IsAny<IReadOnlyCollection<long>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<long, SurplusMaterialSupplier>
            {
                [4] = new SurplusMaterialSupplier(8, "Approved Supplier")
            });
        _projectAccessService.Setup(x => x.GetAccessibleProjectIdsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync((IReadOnlySet<long>)new HashSet<long> { 3 });
        _handler = new GetSurplusRequestDetailQueryHandler(_uow.Object, _supplierService.Object, _projectAccessService.Object);
    }

    [Fact]
    public async Task UTCID01_Handle_ExistingRequest_ShouldReturnMappedDetails()
    {
        var result = await _handler.Handle(new GetSurplusRequestDetailQuery(1), CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Data!.SurplusRequestId.Should().Be(1);
        result.Data.ProjectId.Should().Be(3);
        result.Data.ProjectName.Should().Be("Project");
        result.Data.Reason.Should().Be("Project completion surplus");
        result.Data.Status.Should().Be(SurplusRequestStatus.Processing);
        result.Data.CreatedByName.Should().Be("Project Leader");
        result.Data.TotalItems.Should().Be(1);
        result.Data.ProcessedItems.Should().Be(1);

        var item = result.Data.Items.Should().ContainSingle().Which;
        item.SurplusRequestItemId.Should().Be(2);
        item.MaterialCode.Should().Be("MAT-004");
        item.MaterialName.Should().Be("Steel");
        item.UnitName.Should().Be("kg");
        item.SupplierId.Should().Be(8);
        item.SupplierName.Should().Be("Approved Supplier");
        item.Quantity.Should().Be(10);
        item.ProcessedQuantity.Should().Be(10);
        item.CurrentInventoryQuantity.Should().Be(15);
        item.ReservedQuantity.Should().Be(2);
        item.AvailableQuantity.Should().Be(13);
        item.CloseReason.Should().BeNull();
        item.Status.Should().Be(SurplusRequestItemStatus.Completed);
        item.Actions.Should().HaveCount(3);
        item.Actions.Should().ContainEquivalentOf(new
        {
            ActionType = SurplusActionType.ReturnSupplier,
            ActionId = 20L,
            Status = "Completed",
            Quantity = 2m
        });
        item.Actions.Should().ContainEquivalentOf(new
        {
            ActionType = SurplusActionType.Transfer,
            ActionId = 21L,
            Status = SurplusTransferStatus.Received,
            Quantity = 3m
        });
        item.Actions.Should().ContainEquivalentOf(new
        {
            ActionType = SurplusActionType.Liquidate,
            ActionId = 22L,
            Status = "Completed",
            Quantity = 5m
        });
    }

    [Fact]
    public async Task UTCID02_Handle_RequestNotFound_ShouldThrowNotFoundException()
    {
        SetupRequests();
        Func<Task> act = () => _handler.Handle(new GetSurplusRequestDetailQuery(1), CancellationToken.None);
        await act.Should().ThrowAsync<NotFoundException>();
    }

    private static SurplusRequest Request() => new()
    {
        SurplusRequestId = 1,
        ProjectId = 3,
        Status = SurplusRequestStatus.Processing,
        Reason = "Project completion surplus",
        CreatedBy = 9,
        CreatedAt = new DateTime(2026, 8, 1, 7, 0, 0, DateTimeKind.Utc),
        Project = new Project { ProjectId = 3, Name = "Project" },
        Items = new List<SurplusRequestItem>
        {
            new()
            {
                SurplusRequestItemId = 2,
                SurplusRequestId = 1,
                MaterialId = 4,
                Material = new MaterialCatalog { Code = "MAT-004", Name = "Steel" },
                UnitId = 5,
                Unit = new Unit { UnitId = 5, UnitName = "kg" },
                Quantity = 10,
                ProcessedQuantity = 10,
                Status = SurplusRequestItemStatus.Completed,
                ReturnToSuppliers = new List<SurplusReturnSupplier>
                {
                    new() { SurplusReturnSupplierId = 20, ReturnQuantity = 2 }
                },
                Transfers = new List<SurplusTransfer>
                {
                    new() { SurplusTransferId = 21, TransferQuantity = 3, Status = SurplusTransferStatus.Received }
                },
                Liquidations = new List<SurplusLiquidation>
                {
                    new() { SurplusLiquidationId = 22, LiquidationQuantity = 5 }
                }
            }
        }
    };
    private void SetupRequests(params SurplusRequest[] items) => _requestRepo.Setup(x => x.Query()).Returns(items.AsQueryable().BuildMock());
}
