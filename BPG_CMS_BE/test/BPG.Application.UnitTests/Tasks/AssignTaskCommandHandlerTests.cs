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

public class AssignTaskCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IGenericRepository<ProjectTask>> _taskRepo = new();
    private readonly Mock<IGenericRepository<ProjectMember>> _memberRepo = new();
    private readonly Mock<IGenericRepository<TaskAssignee>> _assigneeRepo = new();
    private readonly Mock<ICurrentUserService> _currentUser = new();
    private readonly AssignTaskCommandHandler _handler;

    public AssignTaskCommandHandlerTests()
    {
        _uow.Setup(x => x.Repository<ProjectTask>()).Returns(_taskRepo.Object);
        _uow.Setup(x => x.Repository<ProjectMember>()).Returns(_memberRepo.Object);
        _uow.Setup(x => x.Repository<TaskAssignee>()).Returns(_assigneeRepo.Object);
        _uow.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        _currentUser.SetupUser(1, BPG.Domain.Constants.UserRole.TechnicalManager);
        SetupTasks(TaskEntity());
        SetupMembers(new ProjectMember { ProjectId = 3, UserId = 8 });
        _handler = new AssignTaskCommandHandler(_uow.Object, ServiceStubFactory.NotificationService(), _currentUser.Object);
    }

    [Fact]
    public async Task UTCID01_Handle_ProjectMemberAssignee_ShouldReturnSuccess()
    {
        var result = await _handler.Handle(Command(8), CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Message.Should().Be("Giao việc thành công.");
    }

    [Fact]
    public async Task UTCID02_Handle_TaskNotFound_ShouldThrowNotFoundException()
    {
        SetupTasks();
        Func<Task> act = () => _handler.Handle(Command(8), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<NotFoundException>();
        exception.Which.ErrorCode.Should().Be(ErrorCodes.NotFound);
    }

    [Fact]
    public async Task UTCID03_Handle_ProjectNotInProgress_ShouldThrowInvalidTransition()
    {
        SetupTasks(TaskEntity(projectStatus: ProjectStatus.Completed));

        Func<Task> act = () => _handler.Handle(Command(8), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be(ErrorCodes.InvalidTransition);
    }

    [Fact]
    public async Task UTCID04_Handle_ProjectLeader_ShouldReturnSuccess()
    {
        _currentUser.SetupUser(1);
        SetupProjectLeaderAccess(true);

        var result = await _handler.Handle(Command(8), CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Message.Should().Be("Giao việc thành công.");
    }

    [Fact]
    public async Task UTCID05_Handle_UserWithoutPermission_ShouldThrowForbiddenException()
    {
        _currentUser.SetupUser(1);
        SetupProjectLeaderAccess(false);

        Func<Task> act = () => _handler.Handle(Command(8), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<ForbiddenException>();
        exception.Which.ErrorCode.Should().Be(ErrorCodes.Forbidden);
    }

    [Fact]
    public async Task UTCID06_Handle_AssigneeOutsideProject_ShouldThrowExpectedErrorCode()
    {
        Func<Task> act = () => _handler.Handle(Command(99), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_TASK_ASSIGNEE_NOT_PROJECT_MEMBER");
    }

    [Fact]
    public async Task UTCID07_Handle_NullAssigneeList_ShouldReturnSuccess()
    {
        var result = await _handler.Handle(new AssignTaskCommand(10, null!), CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Message.Should().Be("Giao việc thành công.");
    }

    private static AssignTaskCommand Command(params long[] assigneeIds) => new(10, assigneeIds.ToList());

    private static ProjectTask TaskEntity(string projectStatus = ProjectStatus.InProgress) => new()
    {
        TaskId = 10,
        Name = "Foundation",
        Status = BPG.Domain.Constants.TaskStatus.New,
        Phase = new Phase { PhaseId = 2, ProjectId = 3, Project = new Project { ProjectId = 3, Status = projectStatus } },
        Assignees = new List<TaskAssignee>()
    };

    private void SetupTasks(params ProjectTask[] tasks) => _taskRepo.Setup(x => x.Query()).Returns(tasks.AsQueryable().BuildMock());
    private void SetupMembers(params ProjectMember[] members) => _memberRepo.Setup(x => x.Query()).Returns(members.AsQueryable().BuildMock());

    private void SetupProjectLeaderAccess(bool isLeader) =>
        _memberRepo.Setup(x => x.AnyAsync(
                It.IsAny<System.Linq.Expressions.Expression<Func<ProjectMember, bool>>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(isLeader);
}
