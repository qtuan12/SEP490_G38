using BPG.Application.Features.Surplus.Commands;
using BPG.Application.Features.Surplus.Handlers;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Application.UnitTests.Helpers;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using MockQueryable;
using Moq;

namespace BPG.Application.UnitTests.Surplus;

public class CreateSurplusRequestCommandHandlerTests
{
    private const long ProjectId = 10;
    private const long UserId = 20;
    private const long GeneratedRequestId = 30;

    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IGenericRepository<Project>> _projectRepo = new();
    private readonly Mock<IGenericRepository<ProjectMember>> _memberRepo = new();
    private readonly Mock<IGenericRepository<SurplusRequest>> _requestRepo = new();
    private readonly Mock<IGenericRepository<CurrentInventory>> _inventoryRepo = new();
    private readonly Mock<IGenericRepository<User>> _userRepo = new();
    private readonly Mock<ICurrentUserService> _currentUser = new();
    private readonly CreateSurplusRequestCommandHandler _handler;

    public CreateSurplusRequestCommandHandlerTests()
    {
        _uow.Setup(x => x.Repository<Project>()).Returns(_projectRepo.Object);
        _uow.Setup(x => x.Repository<ProjectMember>()).Returns(_memberRepo.Object);
        _uow.Setup(x => x.Repository<SurplusRequest>()).Returns(_requestRepo.Object);
        _uow.Setup(x => x.Repository<CurrentInventory>()).Returns(_inventoryRepo.Object);
        _uow.Setup(x => x.Repository<User>()).Returns(_userRepo.Object);
        _uow.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        _currentUser.SetupUser(UserId);
        SetupProjects(Project());
        SetupMembers(new ProjectMember { ProjectId = ProjectId, UserId = UserId, IsLeader = true });
        SetupRequests();
        SetupInventory(new CurrentInventory { ProjectId = ProjectId, MaterialId = 1, UnitId = 1, Quantity = 10 });
        SetupUsers(new User { UserId = UserId, FullName = "Project Leader" });

        _requestRepo.Setup(x => x.AddAsync(It.IsAny<SurplusRequest>(), It.IsAny<CancellationToken>()))
            .Callback<SurplusRequest, CancellationToken>((request, _) => request.SurplusRequestId = GeneratedRequestId)
            .Returns(Task.CompletedTask);

        _handler = new CreateSurplusRequestCommandHandler(
            _uow.Object,
            _currentUser.Object,
            ServiceStubFactory.NotificationService(),
            ServiceStubFactory.RealtimeSender());
    }

    [Fact]
    public async Task UTCID01_Handle_ActiveProjectWithInventory_ShouldReturnCreatedRequestId()
    {
        var result = await _handler.Handle(Command(), CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Data.Should().Be(GeneratedRequestId);
    }

    [Fact]
    public async Task UTCID02_Handle_ProjectNotFound_ShouldThrowNotFoundException()
    {
        SetupProjects();

        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task UTCID03_Handle_ProjectInactive_ShouldThrowInvalidTransition()
    {
        SetupProjects(Project(ProjectStatus.Completed));

        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be(ErrorCodes.InvalidTransition);
    }

    [Fact]
    public async Task UTCID04_Handle_ActiveBatchExists_ShouldThrowDuplicateEntry()
    {
        SetupRequests(new SurplusRequest { ProjectId = ProjectId, Status = SurplusRequestStatus.Processing });

        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be(ErrorCodes.DuplicateEntry);
    }

    [Fact]
    public async Task UTCID05_Handle_NoPositiveInventory_ShouldThrowNotFoundBusinessException()
    {
        SetupInventory(new CurrentInventory { ProjectId = ProjectId, MaterialId = 1, Quantity = 0 });

        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be(ErrorCodes.NotFound);
    }

    private static CreateSurplusRequestCommand Command() => new(ProjectId, "Project completion surplus");

    private static Project Project(string status = ProjectStatus.InProgress) => new()
    {
        ProjectId = ProjectId,
        Name = "Construction Project",
        Status = status
    };

    private void SetupProjects(params Project[] projects) =>
        _projectRepo.Setup(x => x.Query()).Returns(projects.AsQueryable().BuildMock());

    private void SetupMembers(params ProjectMember[] members) =>
        _memberRepo.Setup(x => x.Query()).Returns(members.AsQueryable().BuildMock());

    private void SetupRequests(params SurplusRequest[] requests) =>
        _requestRepo.Setup(x => x.Query()).Returns(requests.AsQueryable().BuildMock());

    private void SetupInventory(params CurrentInventory[] items) =>
        _inventoryRepo.Setup(x => x.Query()).Returns(items.AsQueryable().BuildMock());

    private void SetupUsers(params User[] users) =>
        _userRepo.Setup(x => x.Query()).Returns(users.AsQueryable().BuildMock());
}
