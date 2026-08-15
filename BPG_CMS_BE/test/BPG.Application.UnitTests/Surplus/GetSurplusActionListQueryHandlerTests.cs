using BPG.Application.Features.Surplus.Handlers;
using BPG.Application.Features.Surplus.Queries;
using BPG.Application.IRepositories;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using MockQueryable;
using Moq;

namespace BPG.Application.UnitTests.Surplus;

public class GetSurplusActionListQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IGenericRepository<SurplusRequestItem>> _itemRepo = new();
    private readonly GetSurplusActionListQueryHandler _handler;

    public GetSurplusActionListQueryHandlerTests()
    {
        _uow.Setup(x => x.Repository<SurplusRequestItem>()).Returns(_itemRepo.Object);
        SetupItems(new SurplusRequestItem { SurplusRequestItemId = 1 });
        SetupRepository(new SurplusReturnSupplier
        {
            SurplusReturnSupplierId = 21,
            SurplusRequestItemId = 1,
            SupplierId = 3,
            Supplier = new Supplier { SupplierId = 3, SupplierName = "Approved Supplier" },
            ReturnQuantity = 2,
            RefundAmount = 100,
            Note = "Returned",
            CreatedAt = new DateTime(2026, 8, 1, 8, 0, 0, DateTimeKind.Utc)
        });
        SetupRepository(new SurplusTransfer
        {
            SurplusTransferId = 22,
            SurplusRequestItemId = 1,
            FromProjectId = 4,
            FromProject = new Project { ProjectId = 4, Name = "Source" },
            ToProjectId = 5,
            ToProject = new Project { ProjectId = 5, Name = "Target" },
            TransferQuantity = 3,
            Status = SurplusTransferStatus.Dispatched,
            Approver = new User { FullName = "Manager" },
            CreatedAt = new DateTime(2026, 8, 1, 9, 0, 0, DateTimeKind.Utc)
        });
        SetupRepository(new SurplusLiquidation
        {
            SurplusLiquidationId = 23,
            SurplusRequestItemId = 1,
            BuyerName = "Buyer",
            LiquidationQuantity = 4,
            TotalAmount = 500,
            CreatedAt = new DateTime(2026, 8, 1, 10, 0, 0, DateTimeKind.Utc)
        });
        SetupRepository(
            Attachment(31, EntityType.SurplusReturnSupplier, 21, "return.jpg"),
            Attachment(32, EntityType.SurplusTransferDispatch, 22, "dispatch.jpg"),
            Attachment(33, EntityType.SurplusTransferReceive, 22, "receive.jpg"),
            Attachment(34, EntityType.SurplusLiquidation, 23, "liquidation.jpg"));
        _handler = new GetSurplusActionListQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task UTCID01_Handle_ExistingItem_ShouldReturnMappedActionGroups()
    {
        var result = await _handler.Handle(new GetSurplusActionListQuery(1), CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Data!.SurplusRequestItemId.Should().Be(1);

        var returned = result.Data.Returns.Should().ContainSingle().Which;
        returned.SurplusReturnSupplierId.Should().Be(21);
        returned.SupplierName.Should().Be("Approved Supplier");
        returned.ReturnQuantity.Should().Be(2);
        returned.RefundAmount.Should().Be(100);
        returned.Attachments.Should().ContainSingle(x => x.FileName == "return.jpg");

        var transferred = result.Data.Transfers.Should().ContainSingle().Which;
        transferred.SurplusTransferId.Should().Be(22);
        transferred.FromProjectName.Should().Be("Source");
        transferred.ToProjectName.Should().Be("Target");
        transferred.TransferQuantity.Should().Be(3);
        transferred.Status.Should().Be(SurplusTransferStatus.Dispatched);
        transferred.Attachments.Select(x => x.FileName).Should().BeEquivalentTo("dispatch.jpg", "receive.jpg");

        var liquidated = result.Data.Liquidations.Should().ContainSingle().Which;
        liquidated.SurplusLiquidationId.Should().Be(23);
        liquidated.BuyerName.Should().Be("Buyer");
        liquidated.LiquidationQuantity.Should().Be(4);
        liquidated.TotalAmount.Should().Be(500);
        liquidated.Attachments.Should().ContainSingle(x => x.FileName == "liquidation.jpg");
    }

    [Fact]
    public async Task UTCID02_Handle_ItemNotFound_ShouldThrowNotFoundException()
    {
        SetupItems();
        Func<Task> act = () => _handler.Handle(new GetSurplusActionListQuery(1), CancellationToken.None);
        await act.Should().ThrowAsync<NotFoundException>();
    }

    private void SetupItems(params SurplusRequestItem[] items) => _itemRepo.Setup(x => x.Query()).Returns(items.AsQueryable().BuildMock());

    private void SetupRepository<T>(params T[] items) where T : class
    {
        var repo = new Mock<IGenericRepository<T>>();
        repo.Setup(x => x.Query()).Returns(items.AsQueryable().BuildMock());
        _uow.Setup(x => x.Repository<T>()).Returns(repo.Object);
    }

    private static Attachment Attachment(long id, string entityType, long entityId, string fileName) => new()
    {
        AttachmentId = id,
        EntityType = entityType,
        EntityId = entityId,
        FileName = fileName,
        FileUrl = $"/{fileName}",
        ContentType = "image/jpeg",
        FileSizeBytes = 128
    };
}
