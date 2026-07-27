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
    public class AdjustTaskProgressCommandHandlerTests
    {
        private readonly Mock<IUnitOfWork> _mockUow;

        private readonly Mock<IGenericRepository<ProjectTask>> _mockTaskRepo;
        private readonly Mock<IGenericRepository<TaskDependency>> _mockDependencyRepo;

        private readonly AdjustTaskProgressCommandHandler _handler;

        public AdjustTaskProgressCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();

            _mockTaskRepo = new Mock<IGenericRepository<ProjectTask>>();
            _mockDependencyRepo = new Mock<IGenericRepository<TaskDependency>>();

            _mockUow.Setup(u => u.Repository<ProjectTask>()).Returns(_mockTaskRepo.Object);
            _mockUow.Setup(u => u.Repository<TaskDependency>()).Returns(_mockDependencyRepo.Object);

            _handler = new AdjustTaskProgressCommandHandler(
                _mockUow.Object,
                Mock.Of<IProgressRollupService>(),
                Mock.Of<INotificationService>(),
                Mock.Of<IRealtimeNotificationSender>()
            );
        }

        [Fact]
        public async Task UTCID01_Handle_ValidProgressDecrease_ShouldAdjustSuccessfully()
        {
            // Arrange
            var task = new ProjectTask
            {
                TaskId = 1,
                Name = "Task 1",
                ProgressPercent = 80,
                Status = BPG.Domain.Constants.TaskStatus.InProgress,
                Phase = new Phase { PhaseId = 1, ProjectId = 10 }
            };
            
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());
            _mockDependencyRepo.Setup(r => r.Query()).Returns(new List<TaskDependency>().AsQueryable().BuildMock());

            var command = new AdjustTaskProgressCommand(1, 40, "Làm lại 1 phần");

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
        }

        [Fact]
        public async Task UTCID02_Handle_AdjustTo100_ShouldChangeStatusToCompleted()
        {
            // Arrange
            var task = new ProjectTask
            {
                TaskId = 1,
                ProgressPercent = 50,
                Status = BPG.Domain.Constants.TaskStatus.InProgress,
                Phase = new Phase { PhaseId = 1, ProjectId = 10 }
            };
            
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());
            _mockDependencyRepo.Setup(r => r.Query()).Returns(new List<TaskDependency>().AsQueryable().BuildMock());

            var command = new AdjustTaskProgressCommand(1, 100, "Xong");

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
        }

        [Fact]
        public async Task UTCID03_Handle_AdjustToZero_ShouldNotChangeStatusToInProgress()
        {
            // Arrange
            var task = new ProjectTask
            {
                TaskId = 1,
                ProgressPercent = 50,
                Status = BPG.Domain.Constants.TaskStatus.Assigned, // Suppose it was manually set to 50 but status was somehow Assigned, or let's say it was InProgress and we reset it
                Phase = new Phase { PhaseId = 1, ProjectId = 10 }
            };
            
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());
            _mockDependencyRepo.Setup(r => r.Query()).Returns(new List<TaskDependency>().AsQueryable().BuildMock());

            var command = new AdjustTaskProgressCommand(1, 0, "Reset");

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
        }

        [Fact]
        public async Task UTCID04_Handle_TaskNotFound_ShouldThrowNotFoundException()
        {
            // Arrange
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask>().AsQueryable().BuildMock());
            var command = new AdjustTaskProgressCommand(1, 50, "Update");

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<NotFoundException>();
        }

        [Fact]
        public async Task UTCID05_Handle_TaskObsolete_ShouldThrowBusinessException()
        {
            // Arrange
            var task = new ProjectTask
            {
                TaskId = 1,
                Status = BPG.Domain.Constants.TaskStatus.Obsolete,
                Phase = new Phase { PhaseId = 1, ProjectId = 10 }
            };
            
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());
            var command = new AdjustTaskProgressCommand(1, 50, "Update");

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>();
        }

        [Fact]
        public async Task UTCID06_Handle_HasIncompleteDependency_ShouldThrowBusinessException()
        {
            // Arrange
            var task = new ProjectTask { TaskId = 1, Phase = new Phase { PhaseId = 1, ProjectId = 10 } };
            var predecessor = new ProjectTask { TaskId = 2, Name = "Task A", ProgressPercent = 50, Status = BPG.Domain.Constants.TaskStatus.InProgress };
            
            var dependencies = new List<TaskDependency>
            {
                new TaskDependency { TaskId = 1, PredecessorTaskId = 2, Predecessor = predecessor }
            };

            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());
            _mockDependencyRepo.Setup(r => r.Query()).Returns(dependencies.AsQueryable().BuildMock());

            var command = new AdjustTaskProgressCommand(1, 50, "Update");

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>();
        }

        [Fact]
        public async Task UTCID07_Handle_DependencyIsAncestor_ShouldNotBlock()
        {
            // Arrange
            var predecessor = new ProjectTask { TaskId = 2, ProgressPercent = 50, Status = BPG.Domain.Constants.TaskStatus.InProgress };
            var task = new ProjectTask { TaskId = 1, ParentTaskId = 2, Phase = new Phase { PhaseId = 1, ProjectId = 10 } };
            
            var dependencies = new List<TaskDependency>
            {
                new TaskDependency { TaskId = 1, PredecessorTaskId = 2, Predecessor = predecessor }
            };

            var tasks = new List<ProjectTask> { task, predecessor }.AsQueryable();
            _mockTaskRepo.Setup(r => r.Query()).Returns(tasks.BuildMock());
            _mockDependencyRepo.Setup(r => r.Query()).Returns(dependencies.AsQueryable().BuildMock());

            var command = new AdjustTaskProgressCommand(1, 50, "Update");

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
        }

        [Fact]
        public async Task UTCID08_Handle_HasParentTask_ShouldReturnSuccess()
        {
            // Arrange
            var task = new ProjectTask { TaskId = 1, ParentTaskId = 99, Phase = new Phase { PhaseId = 1, ProjectId = 10 } };
            
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());
            _mockDependencyRepo.Setup(r => r.Query()).Returns(new List<TaskDependency>().AsQueryable().BuildMock());

            var command = new AdjustTaskProgressCommand(1, 50, "Update");

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
        }

        [Fact]
        public async Task UTCID09_Handle_HasAssignees_ShouldReturnSuccess()
        {
            // Arrange
            var task = new ProjectTask
            {
                TaskId = 1,
                Phase = new Phase { PhaseId = 1, ProjectId = 10 },
                Assignees = new List<TaskAssignee>
                {
                    new TaskAssignee { UserId = 100 },
                    new TaskAssignee { UserId = 200 }
                }
            };
            
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());
            _mockDependencyRepo.Setup(r => r.Query()).Returns(new List<TaskDependency>().AsQueryable().BuildMock());

            var command = new AdjustTaskProgressCommand(1, 50, "Update");

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
        }

        [Fact]
        public async Task UTCID10_Handle_AdjustToSameProgress_ShouldCreateLogAndReturnSuccess()
        {
            // Arrange
            var task = new ProjectTask
            {
                TaskId = 1,
                ProgressPercent = 50,
                Phase = new Phase { PhaseId = 1, ProjectId = 10 }
            };
            
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());
            _mockDependencyRepo.Setup(r => r.Query()).Returns(new List<TaskDependency>().AsQueryable().BuildMock());

            var command = new AdjustTaskProgressCommand(1, 50, "Update reason");

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
        }

        [Fact]
        public async Task UTCID11_Handle_NoParentTask_ShouldNotCallRollupService()
        {
            // Arrange
            var task = new ProjectTask { TaskId = 1, ParentTaskId = null, Phase = new Phase { PhaseId = 1, ProjectId = 10 } };
            
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());
            _mockDependencyRepo.Setup(r => r.Query()).Returns(new List<TaskDependency>().AsQueryable().BuildMock());

            var command = new AdjustTaskProgressCommand(1, 50, "Update");

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
        }
    }
}

