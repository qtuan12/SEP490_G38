using BPG.Application.Features.Tasks.Commands;
using BPG.Application.Features.Tasks.Handlers;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Application.UnitTests.Helpers;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using MockQueryable;
using Moq;

namespace BPG.Application.UnitTests.Tasks;

public class RemoveTaskDependencyCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IGenericRepository<TaskDependency>> _dependencyRepo = new();
    private readonly Mock<IGenericRepository<ProjectMember>> _memberRepo = new();
    private readonly Mock<ICurrentUserService> _currentUser = new();
    private readonly RemoveTaskDependencyCommandHandler _handler;

    public RemoveTaskDependencyCommandHandlerTests()
    {
        _uow.Setup(x => x.Repository<TaskDependency>()).Returns(_dependencyRepo.Object);
        _uow.Setup(x => x.Repository<ProjectMember>()).Returns(_memberRepo.Object);
        _uow.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        _currentUser.SetupUser(1, BPG.Domain.Constants.UserRole.TechnicalManager);
        SetupDependencies(Dependency());
        _handler = new RemoveTaskDependencyCommandHandler(_uow.Object, ServiceStubFactory.RealtimeSender(), _currentUser.Object);
    }

    [Fact]
    public async Task UTCID01_Handle_ExistingDependency_ShouldReturnSuccess()
    {
        var result = await _handler.Handle(new RemoveTaskDependencyCommand(10, 11), CancellationToken.None);
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task UTCID02_Handle_DependencyNotFound_ShouldThrowNotFoundException()
    {
        SetupDependencies();
        Func<Task> act = () => _handler.Handle(new RemoveTaskDependencyCommand(10, 11), CancellationToken.None);
        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task UTCID03_Handle_InactiveProject_ShouldThrowInvalidTransition()
    {
        SetupDependencies(Dependency(ProjectStatus.Completed));
        Func<Task> act = () => _handler.Handle(new RemoveTaskDependencyCommand(10, 11), CancellationToken.None);
        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be(ErrorCodes.InvalidTransition);
    }

    private static TaskDependency Dependency(string projectStatus = ProjectStatus.InProgress) => new()
    {
        TaskId = 10,
        PredecessorTaskId = 11,
        Task = new ProjectTask
        {
            TaskId = 10,
            Phase = new Phase { PhaseId = 2, ProjectId = 3, Project = new Project { ProjectId = 3, Status = projectStatus } }
        }
    };

    private void SetupDependencies(params TaskDependency[] dependencies) => _dependencyRepo.Setup(x => x.Query()).Returns(dependencies.AsQueryable().BuildMock());
}
