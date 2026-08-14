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
        SetupRequests(
            Request(1, 3, "Accessible Project", "Project completion surplus"),
            Request(2, 7, "Hidden Project", "Hidden request"));
        _access.Setup(x => x.GetAccessibleProjectIdsAsync(It.IsAny<CancellationToken>())).ReturnsAsync(new HashSet<long> { 3 });
        _handler = new GetSurplusRequestListQueryHandler(_uow.Object, _access.Object);
    }

    [Fact]
    public async Task UTCID01_Handle_AccessibleProject_ShouldReturnPagedList()
    {
        var result = await _handler.Handle(new GetSurplusRequestListQuery { ProjectId = 3 }, CancellationToken.None);

        result.Items.Should().ContainSingle(x => x.ProjectId == 3);
        result.TotalCount.Should().Be(1);
        result.PageNumber.Should().Be(1);
        result.PageSize.Should().Be(20);
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

    [Fact]
    public async Task UTCID04_Handle_NoProjectFilter_ShouldReturnOnlyAccessibleProjects()
    {
        var result = await _handler.Handle(new GetSurplusRequestListQuery(), CancellationToken.None);

        result.Items.Should().ContainSingle(x => x.ProjectId == 3);
        result.TotalCount.Should().Be(1);
    }

    [Fact]
    public async Task UTCID05_Handle_SearchMatchesReason_ShouldReturnMatchingRequest()
    {
        var result = await _handler.Handle(new GetSurplusRequestListQuery
        {
            ProjectId = 3,
            Search = "  COMPLETION  "
        }, CancellationToken.None);

        result.Items.Should().ContainSingle(x => x.SurplusRequestId == 1);
    }

    private static SurplusRequest Request(
        long id,
        long projectId,
        string projectName,
        string reason) => new()
    {
        SurplusRequestId = id,
        ProjectId = projectId,
        Project = new Project { ProjectId = projectId, Name = projectName },
        Reason = reason,
        Status = SurplusRequestStatus.Processing,
        CreatedAt = new DateTime(2026, 8, 1, 7, 0, 0, DateTimeKind.Utc),
        Items = new List<SurplusRequestItem>()
    };

    private void SetupRequests(params SurplusRequest[] items) => _requestRepo.Setup(x => x.Query()).Returns(items.AsQueryable().BuildMock());
}
