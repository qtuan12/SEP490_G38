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
    private readonly Mock<ISurplusMaterialSupplierService> _supplierService = new();
    private readonly GetSurplusRequestDetailQueryHandler _handler;

    public GetSurplusRequestDetailQueryHandlerTests()
    {
        _uow.Setup(x => x.Repository<SurplusRequest>()).Returns(_requestRepo.Object);
        _uow.Setup(x => x.Repository<CurrentInventory>()).Returns(_inventoryRepo.Object);
        SetupRequests(Request());
        _inventoryRepo.Setup(x => x.Query()).Returns(Array.Empty<CurrentInventory>().AsQueryable().BuildMock());
        _supplierService.Setup(x => x.GetLatestApprovedSuppliersAsync(3, It.IsAny<IReadOnlyCollection<long>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<long, SurplusMaterialSupplier>());
        _handler = new GetSurplusRequestDetailQueryHandler(_uow.Object, _supplierService.Object);
    }

    [Fact]
    public async Task UTCID01_Handle_ExistingRequest_ShouldReturnDetails()
    {
        var result = await _handler.Handle(new GetSurplusRequestDetailQuery(1), CancellationToken.None);
        result.Success.Should().BeTrue();
        result.Data!.ProjectName.Should().Be("Project");
        result.Data.TotalItems.Should().Be(0);
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
        Project = new Project { ProjectId = 3, Name = "Project" },
        Items = new List<SurplusRequestItem>()
    };
    private void SetupRequests(params SurplusRequest[] items) => _requestRepo.Setup(x => x.Query()).Returns(items.AsQueryable().BuildMock());
}
