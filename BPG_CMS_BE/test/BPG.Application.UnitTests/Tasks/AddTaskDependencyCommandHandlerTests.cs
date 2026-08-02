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

public class AddTaskDependencyCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly Mock<IRealtimeNotificationSender> _realtimeSender = new();
    private readonly Mock<IGenericRepository<ProjectTask>> _taskRepository = new();
    private readonly Mock<IGenericRepository<TaskDependency>> _dependencyRepository = new();

    private AddTaskDependencyCommandHandler CreateHandler()
    {
        _unitOfWork.Setup(x => x.Repository<ProjectTask>()).Returns(_taskRepository.Object);
        _unitOfWork.Setup(x => x.Repository<TaskDependency>()).Returns(_dependencyRepository.Object);

        return new AddTaskDependencyCommandHandler(_unitOfWork.Object, _realtimeSender.Object);
    }

    [Fact]
    public async Task Handle_TasksInDifferentPhasesOfSameProject_ShouldRejectDependency()
    {
        var task = CreateTask(taskId: 1, phaseId: 10, projectId: 100);
        var predecessor = CreateTask(taskId: 2, phaseId: 20, projectId: 100);
        _taskRepository.Setup(x => x.Query())
            .Returns(new[] { task, predecessor }.AsQueryable().BuildMock());
        var handler = CreateHandler();

        Func<Task> act = () => handler.Handle(
            new AddTaskDependencyCommand(task.TaskId, predecessor.TaskId),
            CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be("ERR_DEPENDENCY_DIFFERENT_PHASES");
        exception.Which.Message.Should().Be("Hai công việc phải thuộc cùng một giai đoạn.");
        _dependencyRepository.Verify(
            x => x.AddAsync(It.IsAny<TaskDependency>(), It.IsAny<CancellationToken>()),
            Times.Never);
        _unitOfWork.Verify(
            x => x.SaveChangesAsync(It.IsAny<CancellationToken>()),
            Times.Never);
        _realtimeSender.Verify(
            x => x.SendToGroupAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<object>(),
                It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task Handle_TasksInSamePhase_ShouldCreateDependency()
    {
        var task = CreateTask(taskId: 1, phaseId: 10, projectId: 100);
        var predecessor = CreateTask(taskId: 2, phaseId: 10, projectId: 100);
        _taskRepository.Setup(x => x.Query())
            .Returns(new[] { task, predecessor }.AsQueryable().BuildMock());
        _dependencyRepository.Setup(x => x.Query())
            .Returns(Array.Empty<TaskDependency>().AsQueryable().BuildMock());
        _dependencyRepository.Setup(
                x => x.AddAsync(It.IsAny<TaskDependency>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        _unitOfWork.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);
        _realtimeSender.Setup(x => x.SendToGroupAsync(
                "Project_100",
                "WbsTreeUpdated",
                It.IsAny<object>(),
                It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        var handler = CreateHandler();

        var result = await handler.Handle(
            new AddTaskDependencyCommand(task.TaskId, predecessor.TaskId),
            CancellationToken.None);

        result.Success.Should().BeTrue();
        _dependencyRepository.Verify(
            x => x.AddAsync(
                It.Is<TaskDependency>(dependency =>
                    dependency.TaskId == task.TaskId
                    && dependency.PredecessorTaskId == predecessor.TaskId),
                It.IsAny<CancellationToken>()),
            Times.Once);
        _unitOfWork.Verify(
            x => x.SaveChangesAsync(It.IsAny<CancellationToken>()),
            Times.Once);
        _realtimeSender.Verify(
            x => x.SendToGroupAsync(
                "Project_100",
                "WbsTreeUpdated",
                It.IsAny<object>(),
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    private static ProjectTask CreateTask(long taskId, long phaseId, long projectId)
    {
        var phase = new Phase
        {
            PhaseId = phaseId,
            ProjectId = projectId
        };

        return new ProjectTask
        {
            TaskId = taskId,
            PhaseId = phaseId,
            Phase = phase,
            Name = $"Task {taskId}",
            StartDate = new DateOnly(2026, 1, 1),
            EndDate = new DateOnly(2026, 1, 2)
        };
    }
}
