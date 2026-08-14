using BPG.Application.DTOs.Surplus;
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

public class GetIncomingTransfersQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IGenericRepository<SurplusTransfer>> _repo = new();
    private readonly Mock<IProjectAccessService> _access = new();
    private readonly GetIncomingTransfersQueryHandler _handler;

    public GetIncomingTransfersQueryHandlerTests()
    {
        _uow.Setup(x => x.Repository<SurplusTransfer>()).Returns(_repo.Object);
        _repo.Setup(x => x.Query()).Returns(new[] { Transfer() }.AsQueryable().BuildMock());
        _access.Setup(x => x.GetAccessibleProjectIdsAsync(It.IsAny<CancellationToken>())).ReturnsAsync(new HashSet<long> { 1 });
        _handler = new GetIncomingTransfersQueryHandler(_uow.Object, _access.Object);
    }

    [Fact]
    public async Task UTCID01_Handle_AccessibleProject_ShouldReturnMappedTransfer()
    {
        var result = await _handler.Handle(new GetIncomingTransfersQuery(1), CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Data.Should().ContainSingle().Which.Should().BeEquivalentTo(new IncomingSurplusTransferDto
        {
            SurplusTransferId = 10,
            SurplusRequestItemId = 11,
            FromProjectId = 2,
            FromProjectName = "Source Project",
            ToProjectId = 1,
            ToProjectName = "Target Project",
            TransferQuantity = 4,
            Status = SurplusTransferStatus.Approved,
            ApproverName = "Technical Manager",
            ApprovedAt = new DateTime(2026, 8, 1, 8, 0, 0, DateTimeKind.Utc),
            CreatedAt = new DateTime(2026, 8, 1, 7, 0, 0, DateTimeKind.Utc),
            MaterialId = 20,
            MaterialCode = "MAT-020",
            MaterialName = "Steel",
            UnitId = 3,
            UnitName = "kg"
        });
    }

    [Fact]
    public async Task UTCID02_Handle_InaccessibleProject_ShouldThrowForbiddenException()
    {
        Func<Task> act = () => _handler.Handle(new GetIncomingTransfersQuery(2), CancellationToken.None);
        await act.Should().ThrowAsync<ForbiddenException>();
    }

    private static SurplusTransfer Transfer() => new()
    {
        SurplusTransferId = 10,
        SurplusRequestItemId = 11,
        FromProjectId = 2,
        ToProjectId = 1,
        TransferQuantity = 4,
        Status = SurplusTransferStatus.Approved,
        ApprovedAt = new DateTime(2026, 8, 1, 8, 0, 0, DateTimeKind.Utc),
        CreatedAt = new DateTime(2026, 8, 1, 7, 0, 0, DateTimeKind.Utc),
        FromProject = new Project { ProjectId = 2, Name = "Source Project" },
        ToProject = new Project { ProjectId = 1, Name = "Target Project" },
        Approver = new User { FullName = "Technical Manager" },
        SurplusRequestItem = new SurplusRequestItem
        {
            SurplusRequestItemId = 11,
            MaterialId = 20,
            UnitId = 3,
            Material = new MaterialCatalog { Code = "MAT-020", Name = "Steel" },
            Unit = new Unit { UnitId = 3, UnitName = "kg" }
        }
    };
}
