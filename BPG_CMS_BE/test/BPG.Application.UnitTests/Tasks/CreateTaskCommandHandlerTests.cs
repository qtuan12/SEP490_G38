using AutoMapper;
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
    public class CreateTaskCommandHandlerTests
    {
        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<INotificationService> _mockNotificationService;
        private readonly Mock<IRealtimeNotificationSender> _mockRealtimeSender;
        private readonly Mock<IMapper> _mockMapper;
        private readonly Mock<IProgressRollupService> _mockRollupService;

        private readonly Mock<IGenericRepository<Phase>> _mockPhaseRepo;
        private readonly Mock<IGenericRepository<ProjectTask>> _mockTaskRepo;
        private readonly Mock<IGenericRepository<ProjectMember>> _mockMemberRepo;
        private readonly Mock<IGenericRepository<TaskAssignee>> _mockAssigneeRepo;

        private readonly CreateTaskCommandHandler _handler;

        public CreateTaskCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockNotificationService = new Mock<INotificationService>();
            _mockRealtimeSender = new Mock<IRealtimeNotificationSender>();
            _mockMapper = new Mock<IMapper>();
            _mockRollupService = new Mock<IProgressRollupService>();

            _mockPhaseRepo = new Mock<IGenericRepository<Phase>>();
            _mockTaskRepo = new Mock<IGenericRepository<ProjectTask>>();
            _mockMemberRepo = new Mock<IGenericRepository<ProjectMember>>();
            _mockAssigneeRepo = new Mock<IGenericRepository<TaskAssignee>>();

            _mockUow.Setup(u => u.Repository<Phase>()).Returns(_mockPhaseRepo.Object);
            _mockUow.Setup(u => u.Repository<ProjectTask>()).Returns(_mockTaskRepo.Object);
            _mockUow.Setup(u => u.Repository<ProjectMember>()).Returns(_mockMemberRepo.Object);
            _mockUow.Setup(u => u.Repository<TaskAssignee>()).Returns(_mockAssigneeRepo.Object);

            _mockMapper.Setup(m => m.Map<ProjectTask>(It.IsAny<CreateTaskCommand>()))
                .Returns((CreateTaskCommand c) => new ProjectTask
                {
                    TaskId = 100,
                    PhaseId = c.PhaseId,
                    ParentTaskId = c.ParentTaskId,
                    Name = c.Name,
                    StartDate = c.StartDate,
                    EndDate = c.EndDate
                });

            _mockTaskRepo.Setup(r => r.AddAsync(It.IsAny<ProjectTask>(), It.IsAny<CancellationToken>()))
                .Callback<ProjectTask, CancellationToken>((task, ct) => task.TaskId = 100)
                .Returns(Task.CompletedTask);

            _handler = new CreateTaskCommandHandler(
                _mockUow.Object,
                _mockNotificationService.Object,
                _mockRealtimeSender.Object,
                _mockMapper.Object,
                _mockRollupService.Object
            );
        }

        [Fact]
        public async Task UTCID01_Handle_ValidRootTask_ShouldCreateSuccessfully()
        {
            // Arrange
            var phase = new Phase { PhaseId = 1, ProjectId = 1, StartDate = new DateOnly(2026, 1, 1), EndDate = new DateOnly(2026, 12, 31) };
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase> { phase }.AsQueryable().BuildMock());

            var command = new CreateTaskCommand(1, null, "Task 1", null, 1, new DateOnly(2026, 2, 1), new DateOnly(2026, 3, 1), null, null);

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            _mockTaskRepo.Verify(r => r.AddAsync(It.Is<ProjectTask>(t => t.Status == BPG.Domain.Constants.TaskStatus.New && t.ProgressPercent == 0), It.IsAny<CancellationToken>()), Times.Once);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
            _mockRealtimeSender.Verify(s => s.SendToGroupAsync("Project_1", "WbsTreeUpdated", It.IsAny<object>(), It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID02_Handle_WithAssignees_ShouldSetStatusAssignedAndNotify()
        {
            // Arrange
            var phase = new Phase { PhaseId = 1, ProjectId = 1, StartDate = new DateOnly(2026, 1, 1), EndDate = new DateOnly(2026, 12, 31) };
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase> { phase }.AsQueryable().BuildMock());

            var command = new CreateTaskCommand(1, null, "Task 1", null, 1, new DateOnly(2026, 2, 1), new DateOnly(2026, 3, 1), new List<long> { 10, 20 }, null);

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            _mockTaskRepo.Verify(r => r.AddAsync(It.Is<ProjectTask>(t => t.Status == BPG.Domain.Constants.TaskStatus.Assigned), It.IsAny<CancellationToken>()), Times.Once);
            _mockNotificationService.Verify(s => s.SendNotificationAsync(10, It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), 100, It.IsAny<CancellationToken>()), Times.Once);
            _mockNotificationService.Verify(s => s.SendNotificationAsync(20, It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), 100, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID03_Handle_PhaseNotFound_ShouldThrowNotFoundException()
        {
            // Arrange
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase>().AsQueryable().BuildMock());
            var command = new CreateTaskCommand(1, null, "Task", null, 1, new DateOnly(2026, 1, 1), new DateOnly(2026, 1, 2), null, null);

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<NotFoundException>().WithMessage("*Phase*1*");
        }

        [Fact]
        public async Task UTCID04_Handle_TaskStartDateBeforePhase_ShouldThrowBusinessException()
        {
            // Arrange
            var phase = new Phase { PhaseId = 1, StartDate = new DateOnly(2026, 2, 1), EndDate = new DateOnly(2026, 12, 31) };
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase> { phase }.AsQueryable().BuildMock());
            var command = new CreateTaskCommand(1, null, "Task", null, 1, new DateOnly(2026, 1, 1), new DateOnly(2026, 3, 1), null, null);

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>().WithMessage("*Ngày bắt đầu*");
        }

        [Fact]
        public async Task UTCID05_Handle_TaskEndDateAfterPhase_ShouldThrowBusinessException()
        {
            // Arrange
            var phase = new Phase { PhaseId = 1, StartDate = new DateOnly(2026, 1, 1), EndDate = new DateOnly(2026, 11, 30) };
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase> { phase }.AsQueryable().BuildMock());
            var command = new CreateTaskCommand(1, null, "Task", null, 1, new DateOnly(2026, 2, 1), new DateOnly(2026, 12, 1), null, null);

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>().WithMessage("*Ngày kết thúc*");
        }

        [Fact]
        public async Task UTCID06_Handle_ParentTaskNotFound_ShouldThrowNotFoundException()
        {
            // Arrange
            var phase = new Phase { PhaseId = 1, StartDate = new DateOnly(2026, 1, 1), EndDate = new DateOnly(2026, 12, 31) };
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase> { phase }.AsQueryable().BuildMock());
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask>().AsQueryable().BuildMock());

            var command = new CreateTaskCommand(1, 99, "Task", null, 1, new DateOnly(2026, 2, 1), new DateOnly(2026, 3, 1), null, null);

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<NotFoundException>().WithMessage("*ParentTask*99*");
        }

        [Fact]
        public async Task UTCID07_Handle_TaskDatesOutsideParentTask_ShouldThrowBusinessException()
        {
            // Arrange
            var phase = new Phase { PhaseId = 1, StartDate = new DateOnly(2026, 1, 1), EndDate = new DateOnly(2026, 12, 31) };
            var parentTask = new ProjectTask { TaskId = 99, StartDate = new DateOnly(2026, 2, 1), EndDate = new DateOnly(2026, 5, 1) };
            
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase> { phase }.AsQueryable().BuildMock());
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { parentTask }.AsQueryable().BuildMock());

            var command = new CreateTaskCommand(1, 99, "Task", null, 1, new DateOnly(2026, 1, 1), new DateOnly(2026, 3, 1), null, null);

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>().WithMessage("*phải nằm trong khoảng thời gian của công việc cha*");
        }

        [Fact]
        public async Task UTCID08_Handle_SubTaskCreated_ShouldAssignParentToProjectLeader()
        {
            // Arrange
            var phase = new Phase { PhaseId = 1, ProjectId = 1, StartDate = new DateOnly(2026, 1, 1), EndDate = new DateOnly(2026, 12, 31) };
            var parentTask = new ProjectTask
            {
                TaskId = 99,
                StartDate = new DateOnly(2026, 2, 1),
                EndDate = new DateOnly(2026, 5, 1),
                Assignees = new List<TaskAssignee> { new TaskAssignee { UserId = 5 } },
                Status = BPG.Domain.Constants.TaskStatus.New
            };
            var leader = new ProjectMember { ProjectId = 1, UserId = 10, IsLeader = true };
            
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase> { phase }.AsQueryable().BuildMock());
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { parentTask }.AsQueryable().BuildMock());
            _mockMemberRepo.Setup(r => r.Query()).Returns(new List<ProjectMember> { leader }.AsQueryable().BuildMock());

            var command = new CreateTaskCommand(1, 99, "Task", null, 1, new DateOnly(2026, 2, 1), new DateOnly(2026, 3, 1), null, null);

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            _mockAssigneeRepo.Verify(r => r.RemoveRange(It.IsAny<IEnumerable<TaskAssignee>>()), Times.Once);
            parentTask.Assignees.Should().ContainSingle(a => a.UserId == 10);
            parentTask.Status.Should().Be(BPG.Domain.Constants.TaskStatus.Assigned);
            _mockTaskRepo.Verify(r => r.Update(parentTask), Times.Once);
        }

        [Fact]
        public async Task UTCID09_Handle_SubTaskCreated_ShouldCallRollupService()
        {
            // Arrange
            var phase = new Phase { PhaseId = 1, ProjectId = 1, StartDate = new DateOnly(2026, 1, 1), EndDate = new DateOnly(2026, 12, 31) };
            var parentTask = new ProjectTask { TaskId = 99, StartDate = new DateOnly(2026, 2, 1), EndDate = new DateOnly(2026, 5, 1) };
            
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase> { phase }.AsQueryable().BuildMock());
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { parentTask }.AsQueryable().BuildMock());
            _mockMemberRepo.Setup(r => r.Query()).Returns(new List<ProjectMember>().AsQueryable().BuildMock());

            var command = new CreateTaskCommand(1, 99, "Task", null, 1, new DateOnly(2026, 2, 1), new DateOnly(2026, 3, 1), null, null);

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            _mockRollupService.Verify(s => s.RecalculateParentTaskProgressAsync(99, 100, It.IsAny<CancellationToken>()), Times.Once);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Exactly(2));
        }

        [Fact]
        public async Task UTCID10_Handle_SubTaskDatesEqualsParent_ShouldCreateSuccessfully()
        {
            // Arrange
            var phase = new Phase { PhaseId = 1, StartDate = new DateOnly(2026, 1, 1), EndDate = new DateOnly(2026, 12, 31) };
            var parentTask = new ProjectTask { TaskId = 99, StartDate = new DateOnly(2026, 2, 1), EndDate = new DateOnly(2026, 5, 1) };
            
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase> { phase }.AsQueryable().BuildMock());
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { parentTask }.AsQueryable().BuildMock());
            _mockMemberRepo.Setup(r => r.Query()).Returns(new List<ProjectMember>().AsQueryable().BuildMock());

            var command = new CreateTaskCommand(1, 99, "Task", null, 1, new DateOnly(2026, 2, 1), new DateOnly(2026, 5, 1), null, null);

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            _mockTaskRepo.Verify(r => r.AddAsync(It.IsAny<ProjectTask>(), It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID11_Handle_ParentTaskNew_ShouldUpdateToAssignedWhenLeaderAssigned()
        {
            // Same as UTCID08, verifying the status transition specifically.
            // Arrange
            var phase = new Phase { PhaseId = 1, ProjectId = 1, StartDate = new DateOnly(2026, 1, 1), EndDate = new DateOnly(2026, 12, 31) };
            var parentTask = new ProjectTask
            {
                TaskId = 99,
                StartDate = new DateOnly(2026, 2, 1),
                EndDate = new DateOnly(2026, 5, 1),
                Status = BPG.Domain.Constants.TaskStatus.New,
                Assignees = new List<TaskAssignee>() // Empty initially
            };
            var leader = new ProjectMember { ProjectId = 1, UserId = 10, IsLeader = true };
            
            _mockPhaseRepo.Setup(r => r.Query()).Returns(new List<Phase> { phase }.AsQueryable().BuildMock());
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { parentTask }.AsQueryable().BuildMock());
            _mockMemberRepo.Setup(r => r.Query()).Returns(new List<ProjectMember> { leader }.AsQueryable().BuildMock());

            var command = new CreateTaskCommand(1, 99, "Task", null, 1, new DateOnly(2026, 2, 1), new DateOnly(2026, 3, 1), null, null);

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            parentTask.Status.Should().Be(BPG.Domain.Constants.TaskStatus.Assigned);
            parentTask.Assignees.Should().ContainSingle(a => a.UserId == 10);
        }
    }
}
