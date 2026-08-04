using BPG.Application.Features.Tasks.Commands;
using BPG.Application.Features.Tasks.Handlers;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using MockQueryable;
using MockQueryable.Moq;
using Moq;

namespace BPG.Application.UnitTests.Tasks;

public class AssignTaskCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _mockUow = new();
    private readonly Mock<INotificationService> _mockNotificationService = new();
    private readonly Mock<IGenericRepository<ProjectTask>> _mockTaskRepo = new();
    private readonly Mock<IGenericRepository<ProjectMember>> _mockProjectMemberRepo = new();
    private readonly Mock<IGenericRepository<TaskAssignee>> _mockTaskAssigneeRepo = new();
    private readonly Mock<ICurrentUserService> _mockCurrentUserService = new();
    private readonly AssignTaskCommandHandler _handler;

    public AssignTaskCommandHandlerTests()
    {
        _mockUow.Setup(uow => uow.Repository<ProjectTask>()).Returns(_mockTaskRepo.Object);
        _mockUow.Setup(uow => uow.Repository<ProjectMember>()).Returns(_mockProjectMemberRepo.Object);
        _mockUow.Setup(uow => uow.Repository<TaskAssignee>()).Returns(_mockTaskAssigneeRepo.Object);

        _mockNotificationService
            .Setup(service => service.SendNotificationAsync(
                It.IsAny<long>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string?>(),
                It.IsAny<long?>(),
                It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        _handler = new AssignTaskCommandHandler(_mockUow.Object, _mockNotificationService.Object, _mockCurrentUserService.Object);
    }

    [Fact]
    public async Task Handle_AllDistinctAssigneesAreProjectMembers_ShouldReplaceAssignments()
    {
        var existingAssignee = new TaskAssignee { TaskId = 1, UserId = 10 };
        var task = CreateTask(existingAssignee);
        SetupTask(task);
        SetupProjectMembers(
            new ProjectMember { ProjectId = 100, UserId = 10 },
            new ProjectMember { ProjectId = 100, UserId = 20 });

        var result = await _handler.Handle(
            new AssignTaskCommand(1, new List<long> { 10, 10, 20 }),
            CancellationToken.None);

        result.Success.Should().BeTrue();
        task.Assignees.Select(assignee => assignee.UserId).Should().BeEquivalentTo(new long[] { 10, 20 });
        _mockTaskAssigneeRepo.Verify(repo => repo.Remove(existingAssignee), Times.Once);
        _mockUow.Verify(uow => uow.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        _mockNotificationService.Verify(service => service.SendNotificationAsync(
            10,
            It.IsAny<string>(),
            It.IsAny<string>(),
            It.IsAny<string>(),
            It.IsAny<string?>(),
            It.IsAny<long?>(),
            It.IsAny<CancellationToken>()), Times.Never);
        _mockNotificationService.Verify(service => service.SendNotificationAsync(
            20,
            It.IsAny<string>(),
            It.IsAny<string>(),
            It.IsAny<string>(),
            It.IsAny<string?>(),
            1,
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_AssigneeDoesNotBelongToTaskProject_ShouldRejectWithoutChangingAssignments()
    {
        var existingAssignee = new TaskAssignee { TaskId = 1, UserId = 10 };
        var task = CreateTask(existingAssignee);
        SetupTask(task);
        SetupProjectMembers(
            new ProjectMember { ProjectId = 100, UserId = 10 },
            new ProjectMember { ProjectId = 999, UserId = 20 });

        Func<Task> act = () => _handler.Handle(
            new AssignTaskCommand(1, new List<long> { 10, 20, 20 }),
            CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_TASK_ASSIGNEE_NOT_PROJECT_MEMBER");
        exception.Which.Message.Should().Contain("[20]");
        task.Assignees.Should().ContainSingle().Which.Should().BeSameAs(existingAssignee);
        _mockTaskAssigneeRepo.Verify(repo => repo.Remove(It.IsAny<TaskAssignee>()), Times.Never);
        _mockUow.Verify(uow => uow.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        _mockNotificationService.Verify(service => service.SendNotificationAsync(
            It.IsAny<long>(),
            It.IsAny<string>(),
            It.IsAny<string>(),
            It.IsAny<string>(),
            It.IsAny<string?>(),
            It.IsAny<long?>(),
            It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_EmptyAssigneeList_ShouldKeepExistingClearAssignmentBehavior()
    {
        var firstAssignee = new TaskAssignee { TaskId = 1, UserId = 10 };
        var secondAssignee = new TaskAssignee { TaskId = 1, UserId = 20 };
        var task = CreateTask(firstAssignee, secondAssignee);
        SetupTask(task);

        var result = await _handler.Handle(
            new AssignTaskCommand(1, new List<long>()),
            CancellationToken.None);

        result.Success.Should().BeTrue();
        task.Assignees.Should().BeEmpty();
        _mockTaskAssigneeRepo.Verify(repo => repo.Remove(firstAssignee), Times.Once);
        _mockTaskAssigneeRepo.Verify(repo => repo.Remove(secondAssignee), Times.Once);
        _mockProjectMemberRepo.Verify(repo => repo.Query(), Times.Never);
        _mockUow.Verify(uow => uow.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        _mockNotificationService.Verify(service => service.SendNotificationAsync(
            It.IsAny<long>(),
            It.IsAny<string>(),
            It.IsAny<string>(),
            It.IsAny<string>(),
            It.IsAny<string?>(),
            It.IsAny<long?>(),
            It.IsAny<CancellationToken>()), Times.Never);
    }

    private static ProjectTask CreateTask(params TaskAssignee[] assignees) => new()
    {
        TaskId = 1,
        Name = "Foundation work",
        Status = BPG.Domain.Constants.TaskStatus.Assigned,
        Phase = new Phase { PhaseId = 5, ProjectId = 100 },
        Assignees = assignees.ToList()
    };

    private void SetupTask(ProjectTask task)
    {
        _mockTaskRepo
            .Setup(repo => repo.Query())
            .Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());
    }

    private void SetupProjectMembers(params ProjectMember[] members)
    {
        _mockProjectMemberRepo
            .Setup(repo => repo.Query())
            .Returns(members.AsQueryable().BuildMock());
    }
}
