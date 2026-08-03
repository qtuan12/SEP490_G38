using BPG.Application.Common.Models;
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
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Xunit;

namespace BPG.Application.UnitTests.Tasks
{
    public class DeleteTaskCommandHandlerTests
    {
        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IRealtimeNotificationSender> _mockRealtimeSender;
        private readonly Mock<IGenericRepository<ProjectTask>> _mockTaskRepo;
        private readonly DeleteTaskCommandHandler _handler;

        public DeleteTaskCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockRealtimeSender = new Mock<IRealtimeNotificationSender>();
            _mockTaskRepo = new Mock<IGenericRepository<ProjectTask>>();

            _mockUow.Setup(u => u.Repository<ProjectTask>()).Returns(_mockTaskRepo.Object);

            _handler = new DeleteTaskCommandHandler(_mockUow.Object, _mockRealtimeSender.Object);
        }

        [Fact]
        public async Task UTCID01_Handle_TaskExistsWithZeroProgress_ShouldDeleteSuccessfully()
        {
            // Arrange
            var task = new ProjectTask
            {
                TaskId = 1,
                ProgressPercent = 0,
                Phase = new Phase { PhaseId = 1, ProjectId = 10 },
                SubTasks = new List<ProjectTask>()
            };
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());

            var command = new DeleteTaskCommand(1);

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            _mockTaskRepo.Verify(r => r.Remove(task), Times.Once);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID02_Handle_TaskWithSubTasksAllZeroProgress_ShouldDeleteAll()
        {
            // Arrange
            var subTask1 = new ProjectTask { TaskId = 2, ProgressPercent = 0 };
            var subTask2 = new ProjectTask { TaskId = 3, ProgressPercent = 0 };
            var task = new ProjectTask
            {
                TaskId = 1,
                ProgressPercent = 0,
                Phase = new Phase { PhaseId = 1, ProjectId = 10 },
                SubTasks = new List<ProjectTask> { subTask1, subTask2 }
            };
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());

            var command = new DeleteTaskCommand(1);

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            _mockTaskRepo.Verify(r => r.Remove(subTask1), Times.Once);
            _mockTaskRepo.Verify(r => r.Remove(subTask2), Times.Once);
            _mockTaskRepo.Verify(r => r.Remove(task), Times.Once);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID03_Handle_TaskNotFound_ShouldThrowNotFoundException()
        {
            // Arrange
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask>().AsQueryable().BuildMock());
            var command = new DeleteTaskCommand(1);

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<NotFoundException>().WithMessage("*ProjectTask*1*");
        }

        [Fact]
        public async Task UTCID04_Handle_TaskInProgress_ShouldThrowBusinessException()
        {
            // Arrange
            var task = new ProjectTask
            {
                TaskId = 1,
                ProgressPercent = 5,
                Phase = new Phase { PhaseId = 1, ProjectId = 10 },
                SubTasks = new List<ProjectTask>()
            };
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());

            var command = new DeleteTaskCommand(1);

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("*Không thể xóa công việc đã có tiến độ thực hiện*");
        }

        [Fact]
        public async Task UTCID05_Handle_SubTaskInProgress_ShouldThrowBusinessException()
        {
            // Arrange
            var subTask = new ProjectTask { TaskId = 2, ProgressPercent = 10 };
            var task = new ProjectTask
            {
                TaskId = 1,
                ProgressPercent = 0,
                Phase = new Phase { PhaseId = 1, ProjectId = 10 },
                SubTasks = new List<ProjectTask> { subTask }
            };
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());

            var command = new DeleteTaskCommand(1);

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("*Không thể xóa task vì có task con đã có tiến độ*");
        }

        [Fact]
        public async Task UTCID06_Handle_PhaseIsNull_ShouldNotCallRealtimeSender()
        {
            // Arrange
            var task = new ProjectTask
            {
                TaskId = 1,
                ProgressPercent = 0,
                Phase = null!,
                SubTasks = new List<ProjectTask>()
            };
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());

            var command = new DeleteTaskCommand(1);

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            _mockTaskRepo.Verify(r => r.Remove(task), Times.Once);
            _mockRealtimeSender.Verify(s => s.SendToGroupAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<object>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task UTCID07_Handle_DeletedSuccessfully_ShouldCallRealtimeSender()
        {
            // Arrange
            var task = new ProjectTask
            {
                TaskId = 1,
                ProgressPercent = 0,
                Phase = new Phase { PhaseId = 1, ProjectId = 10 },
                SubTasks = new List<ProjectTask>()
            };
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());

            var command = new DeleteTaskCommand(1);

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            _mockRealtimeSender.Verify(s => s.SendToGroupAsync("Project_10", "WbsTreeUpdated", It.IsAny<object>(), It.IsAny<CancellationToken>()), Times.Once);
        }
    }
}
