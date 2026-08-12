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

public class GetSurplusRequestListQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IGenericRepository<SurplusRequest>> _requestRepo = new();
    private readonly Mock<IProjectAccessService> _access = new();
    private readonly GetSurplusRequestListQueryHandler _handler;

    public GetSurplusRequestListQueryHandlerTests()
    {
        _uow.Setup(x => x.Repository<SurplusRequest>()).Returns(_requestRepo.Object);
        SetupRequests(new SurplusRequest
        {
            SurplusRequestId = 1,
            ProjectId = 3,
            Project = new Project { ProjectId = 3, Name = "Project" },
            Status = SurplusRequestStatus.Processing,
            Items = new List<SurplusRequestItem>()
        });
        _access.Setup(x => x.GetAccessibleProjectIdsAsync(It.IsAny<CancellationToken>())).ReturnsAsync(new HashSet<long> { 3 });
        _handler = new GetSurplusRequestListQueryHandler(_uow.Object, _access.Object);
    }

    [Fact]
    public async Task UTCID01_Handle_AccessibleProject_ShouldReturnPagedList()
    {
        var result = await _handler.Handle(new GetSurplusRequestListQuery { ProjectId = 3 }, CancellationToken.None);
        result.Items.Should().ContainSingle(x => x.ProjectId == 3);
    }

    [Fact]
    public async Task UTCID02_Handle_InaccessibleProject_ShouldThrowForbiddenException()
    {
        Func<Task> act = () => _handler.Handle(new GetSurplusRequestListQuery { ProjectId = 9 }, CancellationToken.None);
        await act.Should().ThrowAsync<ForbiddenException>();
    }

    [Fact]
    public async Task UTCID03_Handle_StatusFilterWithoutMatch_ShouldReturnEmptyList()
    {
        var result = await _handler.Handle(new GetSurplusRequestListQuery { ProjectId = 3, Status = SurplusRequestStatus.Processed }, CancellationToken.None);
        result.Items.Should().BeEmpty();
    }

    private void SetupRequests(params SurplusRequest[] items) => _requestRepo.Setup(x => x.Query()).Returns(items.AsQueryable().BuildMock());
}
