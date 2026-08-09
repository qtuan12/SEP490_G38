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

public class MarkTaskObsoleteCommandHandlerTests
{
    private const long TaskId = 10;
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IGenericRepository<ProjectTask>> _taskRepo = new();
    private readonly Mock<IGenericRepository<ProjectMember>> _memberRepo = new();
    private readonly Mock<IGenericRepository<TaskDependency>> _dependencyRepo = new();
    private readonly Mock<IGenericRepository<User>> _userRepo = new();
    private readonly Mock<ICurrentUserService> _currentUser = new();
    private readonly MarkTaskObsoleteCommandHandler _handler;

    public MarkTaskObsoleteCommandHandlerTests()
    {
        _uow.Setup(x => x.Repository<ProjectTask>()).Returns(_taskRepo.Object);
        _uow.Setup(x => x.Repository<ProjectMember>()).Returns(_memberRepo.Object);
        _uow.Setup(x => x.Repository<TaskDependency>()).Returns(_dependencyRepo.Object);
        _uow.Setup(x => x.Repository<User>()).Returns(_userRepo.Object);
        _uow.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        _currentUser.SetupUser(1, BPG.Domain.Constants.UserRole.TechnicalManager);
        SetupTasks(TaskEntity());
        SetupMembers();
        SetupDependencies();
        _userRepo.Setup(x => x.GetByIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new User { UserId = 1, FullName = "Manager" });

        _handler = new MarkTaskObsoleteCommandHandler(
            _uow.Object,
            ServiceStubFactory.ProgressRollupService(),
            ServiceStubFactory.NotificationService(),
            ServiceStubFactory.RealtimeSender(),
            _currentUser.Object);
    }

    [Fact]
    public async Task UTCID01_Handle_ValidTask_ShouldReturnSuccess()
    {
        var result = await _handler.Handle(Command(), CancellationToken.None);
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task UTCID02_Handle_TaskNotFound_ShouldThrowNotFoundException()
    {
        SetupTasks();
        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);
        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task UTCID03_Handle_InactiveProject_ShouldThrowInvalidTransition()
    {
        SetupTasks(TaskEntity(projectStatus: ProjectStatus.Paused));
        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);
        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be(ErrorCodes.InvalidTransition);
    }

    [Fact]
    public async Task UTCID04_Handle_UserWithoutPermission_ShouldThrowForbiddenException()
    {
        _currentUser.SetupUser(1);
        SetupMembers();
        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);
        await act.Should().ThrowAsync<ForbiddenException>();
    }

    [Fact]
    public async Task UTCID05_Handle_AlreadyObsolete_ShouldReturnIdempotentSuccess()
    {
        SetupTasks(TaskEntity(BPG.Domain.Constants.TaskStatus.Obsolete));
        var result = await _handler.Handle(Command(), CancellationToken.None);
        result.Success.Should().BeTrue();
    }

    private static MarkTaskObsoleteCommand Command() => new(TaskId, "No longer part of the plan");

    private static ProjectTask TaskEntity(string status = BPG.Domain.Constants.TaskStatus.InProgress, string projectStatus = ProjectStatus.InProgress) => new()
    {
        TaskId = TaskId,
        Name = "Foundation",
        Status = status,
        ProgressPercent = 20,
        Phase = new Phase { PhaseId = 2, ProjectId = 3, Project = new Project { ProjectId = 3, Status = projectStatus } },
        Assignees = new List<TaskAssignee>(),
        ProgressLogs = new List<TaskProgressLog>()
    };

    private void SetupTasks(params ProjectTask[] tasks) => _taskRepo.Setup(x => x.Query()).Returns(tasks.AsQueryable().BuildMock());
    private void SetupMembers(params ProjectMember[] members) => _memberRepo.Setup(x => x.Query()).Returns(members.AsQueryable().BuildMock());
    private void SetupDependencies(params TaskDependency[] dependencies) => _dependencyRepo.Setup(x => x.Query()).Returns(dependencies.AsQueryable().BuildMock());
}
