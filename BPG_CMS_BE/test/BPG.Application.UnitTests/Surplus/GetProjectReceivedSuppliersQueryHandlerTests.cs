using BPG.Application.Features.Surplus.Handlers;
using BPG.Application.Features.Surplus.Queries;
using BPG.Application.IServices;
using BPG.Domain.Exceptions;
using FluentAssertions;
using Moq;

namespace BPG.Application.UnitTests.Surplus;

public class GetProjectReceivedSuppliersQueryHandlerTests
{
    private readonly Mock<ISurplusMaterialSupplierService> _supplierService = new();
    private readonly Mock<IProjectAccessService> _access = new();
    private readonly GetProjectReceivedSuppliersQueryHandler _handler;

    public GetProjectReceivedSuppliersQueryHandlerTests()
    {
        _access.Setup(x => x.GetAccessibleProjectIdsAsync(It.IsAny<CancellationToken>())).ReturnsAsync(new HashSet<long> { 1 });
        _supplierService.Setup(x => x.GetApprovedSuppliersAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<SurplusMaterialSupplier> { new(2, "Supplier") });
        _handler = new GetProjectReceivedSuppliersQueryHandler(_supplierService.Object, _access.Object);
    }

    [Fact]
    public async Task UTCID01_Handle_AccessibleProject_ShouldReturnSuppliers()
    {
        var result = await _handler.Handle(new GetProjectReceivedSuppliersQuery(1), CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Data.Should().Equal(new SurplusMaterialSupplier(2, "Supplier"));
    }

    [Fact]
    public async Task UTCID02_Handle_InaccessibleProject_ShouldThrowForbiddenException()
    {
        Func<Task> act = () => _handler.Handle(new GetProjectReceivedSuppliersQuery(9), CancellationToken.None);
        await act.Should().ThrowAsync<ForbiddenException>();
    }
}
