using BPG.Application.Features.Surplus.Handlers;
using BPG.Application.Features.Surplus.Queries;
using BPG.Application.IRepositories;
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
        SetupEmpty<SurplusReturnSupplier>();
        SetupEmpty<SurplusTransfer>();
        SetupEmpty<SurplusLiquidation>();
        SetupEmpty<Attachment>();
        _handler = new GetSurplusActionListQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task UTCID01_Handle_ExistingItemWithoutActions_ShouldReturnEmptyActionGroups()
    {
        var result = await _handler.Handle(new GetSurplusActionListQuery(1), CancellationToken.None);
        result.Success.Should().BeTrue();
        result.Data!.Returns.Should().BeEmpty();
        result.Data.Transfers.Should().BeEmpty();
        result.Data.Liquidations.Should().BeEmpty();
    }

    [Fact]
    public async Task UTCID02_Handle_ItemNotFound_ShouldThrowNotFoundException()
    {
        SetupItems();
        Func<Task> act = () => _handler.Handle(new GetSurplusActionListQuery(1), CancellationToken.None);
        await act.Should().ThrowAsync<NotFoundException>();
    }

    private void SetupItems(params SurplusRequestItem[] items) => _itemRepo.Setup(x => x.Query()).Returns(items.AsQueryable().BuildMock());
    private void SetupEmpty<T>() where T : class
    {
        var repo = new Mock<IGenericRepository<T>>();
        repo.Setup(x => x.Query()).Returns(Array.Empty<T>().AsQueryable().BuildMock());
        _uow.Setup(x => x.Repository<T>()).Returns(repo.Object);
    }
}
