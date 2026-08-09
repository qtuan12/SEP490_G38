using BPG.Application.Features.Surplus.Handlers;
using BPG.Application.Features.Surplus.Queries;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using MockQueryable;
using Moq;

namespace BPG.Application.UnitTests.Surplus;

public class GetIncomingTransfersQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IGenericRepository<SurplusTransfer>> _repo = new();
    private readonly Mock<IProjectAccessService> _access = new();
    private readonly GetIncomingTransfersQueryHandler _handler;

    public GetIncomingTransfersQueryHandlerTests()
    {
        _uow.Setup(x => x.Repository<SurplusTransfer>()).Returns(_repo.Object);
        _repo.Setup(x => x.Query()).Returns(Array.Empty<SurplusTransfer>().AsQueryable().BuildMock());
        _access.Setup(x => x.GetAccessibleProjectIdsAsync(It.IsAny<CancellationToken>())).ReturnsAsync(new HashSet<long> { 1 });
        _handler = new GetIncomingTransfersQueryHandler(_uow.Object, _access.Object);
    }

    [Fact]
    public async Task UTCID01_Handle_AccessibleProject_ShouldReturnList()
    {
        var result = await _handler.Handle(new GetIncomingTransfersQuery(1), CancellationToken.None);
        result.Success.Should().BeTrue();
        result.Data.Should().BeEmpty();
    }

    [Fact]
    public async Task UTCID02_Handle_InaccessibleProject_ShouldThrowForbiddenException()
    {
        Func<Task> act = () => _handler.Handle(new GetIncomingTransfersQuery(2), CancellationToken.None);
        await act.Should().ThrowAsync<ForbiddenException>();
    }
}
