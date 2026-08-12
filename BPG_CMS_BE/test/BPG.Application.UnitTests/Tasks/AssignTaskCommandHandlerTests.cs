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
        var result = await _handler.Handle(new AssignTaskCommand(10, new List<long> { 8 }), CancellationToken.None);
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task UTCID02_Handle_TaskNotFound_ShouldThrowNotFoundException()
    {
        SetupTasks();
        Func<Task> act = () => _handler.Handle(new AssignTaskCommand(10, new List<long>()), CancellationToken.None);
        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task UTCID03_Handle_AssigneeOutsideProject_ShouldThrowExpectedErrorCode()
    {
        Func<Task> act = () => _handler.Handle(new AssignTaskCommand(10, new List<long> { 99 }), CancellationToken.None);
        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_TASK_ASSIGNEE_NOT_PROJECT_MEMBER");
    }

    [Fact]
    public async Task UTCID04_Handle_UserWithoutPermission_ShouldThrowForbiddenException()
    {
        _currentUser.SetupUser(1);
        _memberRepo.Setup(x => x.AnyAsync(It.IsAny<System.Linq.Expressions.Expression<Func<ProjectMember, bool>>>(), It.IsAny<CancellationToken>())).ReturnsAsync(false);
        Func<Task> act = () => _handler.Handle(new AssignTaskCommand(10, new List<long>()), CancellationToken.None);
        await act.Should().ThrowAsync<ForbiddenException>();
    }

    private static ProjectTask TaskEntity() => new()
    {
        TaskId = 10,
        Name = "Foundation",
        Status = BPG.Domain.Constants.TaskStatus.New,
        Phase = new Phase { PhaseId = 2, ProjectId = 3, Project = new Project { ProjectId = 3, Status = ProjectStatus.InProgress } },
        Assignees = new List<TaskAssignee>()
    };

    private void SetupTasks(params ProjectTask[] tasks) => _taskRepo.Setup(x => x.Query()).Returns(tasks.AsQueryable().BuildMock());
    private void SetupMembers(params ProjectMember[] members) => _memberRepo.Setup(x => x.Query()).Returns(members.AsQueryable().BuildMock());
}
