using BPG.Application.Common.Models;
using BPG.Application.Features.Tasks.Commands;
using BPG.Application.Features.Tasks.Handlers;
using BPG.Application.IRepositories;
using BPG.Application.UnitTests.Helpers;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using MockQueryable;
using Moq;

namespace BPG.Application.UnitTests.Tasks
{
    public class DeleteTaskCommandHandlerTests
    {
        private const long ProjectId = 5;
        private const long PhaseId = 10;
        private const long TaskId = 100;

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IGenericRepository<ProjectTask>> _mockTaskRepo;
        private readonly DeleteTaskCommandHandler _handler;

        public DeleteTaskCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockTaskRepo = new Mock<IGenericRepository<ProjectTask>>();

            _mockUow.Setup(u => u.Repository<ProjectTask>()).Returns(_mockTaskRepo.Object);
            _mockUow.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

            SetupTasks(DefaultTask());

            _handler = new DeleteTaskCommandHandler(
                _mockUow.Object,
                ServiceStubFactory.RealtimeSender());
        }

        [Fact]
        public async Task UTCID01_Handle_TaskWithZeroProgress_ShouldReturnSuccess()
        {
            var result = await _handler.Handle(Command(), CancellationToken.None);

            result.Success.Should().BeTrue();
            _mockTaskRepo.Verify(r => r.Remove(It.Is<ProjectTask>(t => t.TaskId == TaskId)), Times.Once);
        }

        [Fact]
        public async Task UTCID02_Handle_TaskNotFound_ShouldThrowNotFoundException()
        {
            SetupTasks();

            var act = async () => await _handler.Handle(Command(999), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<NotFoundException>();
            exception.Which.ErrorCode.Should().Be("BIZ_001");
        }

        [Fact]
        public async Task UTCID03_Handle_TaskWithProgress_ShouldThrowBusinessException()
        {
            SetupTasks(DefaultTask(progress: 50));

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_TASK_IN_PROGRESS");
        }

        [Fact]
        public async Task UTCID04_Handle_SubtaskWithProgress_ShouldThrowBusinessException()
        {
            var task = DefaultTask();
            task.SubTasks.Add(new ProjectTask { TaskId = 101, ProgressPercent = 30, IsDeleted = false });
            SetupTasks(task);

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_SUBTASK_IN_PROGRESS");
        }

        [Fact]
        public async Task UTCID05_Handle_SubtaskWithZeroProgress_ShouldDeleteBoth()
        {
            var task = DefaultTask();
            var subtask = new ProjectTask { TaskId = 101, ProgressPercent = 0, IsDeleted = false };
            task.SubTasks.Add(subtask);
            SetupTasks(task);

            var result = await _handler.Handle(Command(), CancellationToken.None);

            result.Success.Should().BeTrue();
            _mockTaskRepo.Verify(r => r.Remove(It.Is<ProjectTask>(t => t.TaskId == 101)), Times.Once);
            _mockTaskRepo.Verify(r => r.Remove(It.Is<ProjectTask>(t => t.TaskId == TaskId)), Times.Once);
        }

        // ==================== Factory Methods ====================

        private static DeleteTaskCommand Command(long taskId = TaskId) => new(taskId);

        private static ProjectTask DefaultTask(byte progress = 0)
            => new()
            {
                TaskId = TaskId,
                PhaseId = PhaseId,
                ProgressPercent = progress,
                Phase = new Phase { PhaseId = PhaseId, ProjectId = ProjectId },
                SubTasks = new List<ProjectTask>()
            };

        // ==================== Setup Methods ====================

        private void SetupTasks(params ProjectTask[] tasks)
        {
            _mockTaskRepo.Setup(r => r.Query()).Returns(tasks.AsQueryable().BuildMock());
        }
    }
}
