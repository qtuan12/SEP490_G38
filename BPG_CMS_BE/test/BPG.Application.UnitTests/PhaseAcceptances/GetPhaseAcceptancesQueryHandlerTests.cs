using AutoMapper;
using BPG.Application.DTOs.PhaseAcceptances;
using BPG.Application.Features.PhaseAcceptances.Queries.GetPhaseAcceptances;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Application.UnitTests.Helpers;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using MockQueryable;
using Moq;

namespace BPG.Application.UnitTests.PhaseAcceptances;

public class GetPhaseAcceptancesQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IGenericRepository<PhaseAcceptance>> _repo = new();
    private readonly Mock<ICurrentUserService> _currentUser = new();
    private readonly Mock<IProjectAccessService> _access = new();
    private readonly GetPhaseAcceptancesQueryHandler _handler;

    public GetPhaseAcceptancesQueryHandlerTests()
    {
        _uow.Setup(x => x.Repository<PhaseAcceptance>()).Returns(_repo.Object);
        _repo.Setup(x => x.Query()).Returns(Array.Empty<PhaseAcceptance>().AsQueryable().BuildMock());
        _currentUser.SetupUser(1, BPG.Domain.Constants.UserRole.TechnicalManager);
        _access.Setup(x => x.GetAccessibleProjectIdsAsync(It.IsAny<CancellationToken>())).ReturnsAsync(new HashSet<long> { 3 });
        var mapper = new Mock<IMapper>();
        mapper.Setup(x => x.Map<List<PhaseAcceptanceDto>>(It.IsAny<object>())).Returns(new List<PhaseAcceptanceDto>());
        _handler = new GetPhaseAcceptancesQueryHandler(_uow.Object, mapper.Object, _currentUser.Object, _access.Object);
    }

    [Fact]
    public async Task UTCID01_Handle_ProjectFilter_ShouldReturnPagedList()
    {
        var result = await _handler.Handle(new GetPhaseAcceptancesQuery { ProjectId = 3 }, CancellationToken.None);
        result.Items.Should().BeEmpty();
    }

    [Fact]
    public async Task UTCID02_Handle_GlobalQueryWithoutManagementRole_ShouldThrowForbiddenException()
    {
        _currentUser.SetupUser(1);
        Func<Task> act = () => _handler.Handle(new GetPhaseAcceptancesQuery(), CancellationToken.None);
        await act.Should().ThrowAsync<ForbiddenException>();
    }

    [Fact]
    public async Task UTCID03_Handle_GlobalQueryBySiteEngineer_ShouldReturnAccessibleProjects()
    {
        _currentUser.SetupUser(1, BPG.Domain.Constants.UserRole.SiteEngineer);

        var result = await _handler.Handle(new GetPhaseAcceptancesQuery(), CancellationToken.None);

        result.Items.Should().BeEmpty();
        _access.Verify(x => x.GetAccessibleProjectIdsAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
}
