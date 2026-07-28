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
    public class MarkTaskObsoleteCommandHandlerTests
    {
        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IProgressRollupService> _mockRollupService;
        private readonly Mock<INotificationService> _mockNotificationService;
        private readonly Mock<IRealtimeNotificationSender> _mockRealtimeSender;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;

        private readonly Mock<IGenericRepository<ProjectTask>> _mockTaskRepo;
        private readonly Mock<IGenericRepository<ProjectMember>> _mockMemberRepo;
        private readonly Mock<IGenericRepository<TaskDependency>> _mockDependencyRepo;
        private readonly Mock<IGenericRepository<User>> _mockUserRepo;

        private readonly MarkTaskObsoleteCommandHandler _handler;

        public MarkTaskObsoleteCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockRollupService = new Mock<IProgressRollupService>();
            _mockNotificationService = new Mock<INotificationService>();
            _mockRealtimeSender = new Mock<IRealtimeNotificationSender>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();

            _mockTaskRepo = new Mock<IGenericRepository<ProjectTask>>();
            _mockMemberRepo = new Mock<IGenericRepository<ProjectMember>>();
            _mockDependencyRepo = new Mock<IGenericRepository<TaskDependency>>();
            _mockUserRepo = new Mock<IGenericRepository<User>>();

            _mockUow.Setup(u => u.Repository<ProjectTask>()).Returns(_mockTaskRepo.Object);
            _mockUow.Setup(u => u.Repository<ProjectMember>()).Returns(_mockMemberRepo.Object);
            _mockUow.Setup(u => u.Repository<TaskDependency>()).Returns(_mockDependencyRepo.Object);
            _mockUow.Setup(u => u.Repository<User>()).Returns(_mockUserRepo.Object);

            // Technical Manager scenarios query the project leader for cross-notification.
            // Use an async-capable empty query by default; individual tests can override it.
            _mockMemberRepo.Setup(r => r.Query())
                .Returns(new List<ProjectMember>().AsQueryable().BuildMock());

            _handler = new MarkTaskObsoleteCommandHandler(
                _mockUow.Object,
                _mockRollupService.Object,
                _mockNotificationService.Object,
                _mockRealtimeSender.Object,
                _mockCurrentUserService.Object
            );
        }

        [Fact]
        public async Task UTCID01_Handle_UserIsTechnicalManager_ShouldMarkObsoleteSuccessfully()
        {
            // Arrange
            _mockCurrentUserService.Setup(s => s.GetRequiredUserId()).Returns(100);
            _mockCurrentUserService.Setup(s => s.IsInRole("TechnicalManager")).Returns(true);
            _mockUserRepo.Setup(r => r.GetByIdAsync(100, It.IsAny<CancellationToken>())).ReturnsAsync(new User { UserId = 100, FullName = "TM User" });

            var task = new ProjectTask
            {
                TaskId = 1,
                Status = BPG.Domain.Constants.TaskStatus.InProgress,
                Phase = new Phase { PhaseId = 1, ProjectId = 10 }
            };
            
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());
            _mockDependencyRepo.Setup(r => r.Query()).Returns(new List<TaskDependency>().AsQueryable().BuildMock());

            var command = new MarkTaskObsoleteCommand(1, "Thay đổi thiết kế");

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            task.Status.Should().Be(BPG.Domain.Constants.TaskStatus.Obsolete);
            task.ObsoleteReason.Should().Be("Thay đổi thiết kế");
            _mockTaskRepo.Verify(r => r.Update(task), Times.Once);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.AtLeastOnce);
        }

        [Fact]
        public async Task UTCID02_Handle_UserIsProjectLeader_ShouldMarkObsoleteSuccessfully()
        {
            // Arrange
            _mockCurrentUserService.Setup(s => s.GetRequiredUserId()).Returns(100);
            _mockCurrentUserService.Setup(s => s.IsInRole("TechnicalManager")).Returns(false);
            _mockUserRepo.Setup(r => r.GetByIdAsync(100, It.IsAny<CancellationToken>())).ReturnsAsync(new User { UserId = 100, FullName = "PL User" });

            var task = new ProjectTask
            {
                TaskId = 1,
                Status = BPG.Domain.Constants.TaskStatus.InProgress,
                Phase = new Phase { PhaseId = 1, ProjectId = 10 }
            };
            var member = new ProjectMember { ProjectId = 10, UserId = 100, IsLeader = true };
            
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());
            _mockMemberRepo.Setup(r => r.Query()).Returns(new List<ProjectMember> { member }.AsQueryable().BuildMock());
            _mockDependencyRepo.Setup(r => r.Query()).Returns(new List<TaskDependency>().AsQueryable().BuildMock());

            var command = new MarkTaskObsoleteCommand(1, "Thay đổi thiết kế");

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            task.Status.Should().Be(BPG.Domain.Constants.TaskStatus.Obsolete);
        }

        [Fact]
        public async Task UTCID03_Handle_UserIsNormalMember_ShouldThrowForbiddenException()
        {
            // Arrange
            _mockCurrentUserService.Setup(s => s.GetRequiredUserId()).Returns(100);
            _mockCurrentUserService.Setup(s => s.IsInRole("TechnicalManager")).Returns(false);

            var task = new ProjectTask
            {
                TaskId = 1,
                Status = BPG.Domain.Constants.TaskStatus.InProgress,
                Phase = new Phase { PhaseId = 1, ProjectId = 10 }
            };
            var member = new ProjectMember { ProjectId = 10, UserId = 100, IsLeader = false }; // Not a leader
            
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());
            _mockMemberRepo.Setup(r => r.Query()).Returns(new List<ProjectMember> { member }.AsQueryable().BuildMock());

            var command = new MarkTaskObsoleteCommand(1, "Hủy");

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<ForbiddenException>()
                .WithMessage("*Chỉ Quản lý dự án hoặc Trưởng phòng Kỹ thuật mới có quyền*");
        }

        [Fact]
        public async Task UTCID04_Handle_TaskNotFound_ShouldThrowNotFoundException()
        {
            // Arrange
            _mockCurrentUserService.Setup(s => s.GetRequiredUserId()).Returns(100);
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask>().AsQueryable().BuildMock());
            
            var command = new MarkTaskObsoleteCommand(1, "Hủy");

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<NotFoundException>().WithMessage("*ProjectTask*1*");
        }

        [Fact]
        public async Task UTCID05_Handle_TaskAlreadyObsolete_ShouldReturnSuccessWithoutSaving()
        {
            // Arrange
            _mockCurrentUserService.Setup(s => s.GetRequiredUserId()).Returns(100);
            _mockCurrentUserService.Setup(s => s.IsInRole("TechnicalManager")).Returns(true);

            var task = new ProjectTask
            {
                TaskId = 1,
                Status = BPG.Domain.Constants.TaskStatus.Obsolete,
                Phase = new Phase { PhaseId = 1, ProjectId = 10 }
            };
            
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());

            var command = new MarkTaskObsoleteCommand(1, "Đã hủy trước đó");

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            result.Message.Should().Be("Task đã ở trạng thái Obsolete.");
            _mockTaskRepo.Verify(r => r.Update(It.IsAny<ProjectTask>()), Times.Never);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task UTCID06_Handle_HasParentTask_ShouldCallRollupService()
        {
            // Arrange
            _mockCurrentUserService.Setup(s => s.GetRequiredUserId()).Returns(100);
            _mockCurrentUserService.Setup(s => s.IsInRole("TechnicalManager")).Returns(true);
            _mockUserRepo.Setup(r => r.GetByIdAsync(100, It.IsAny<CancellationToken>())).ReturnsAsync(new User { UserId = 100, FullName = "TM User" });

            var task = new ProjectTask
            {
                TaskId = 1,
                ParentTaskId = 99,
                Phase = new Phase { PhaseId = 1, ProjectId = 10 }
            };
            
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());
            _mockDependencyRepo.Setup(r => r.Query()).Returns(new List<TaskDependency>().AsQueryable().BuildMock());

            var command = new MarkTaskObsoleteCommand(1, "Lý do");

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            _mockRollupService.Verify(s => s.RecalculateParentTaskProgressAsync(99, 1, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID07_Handle_HasDependentTasks_ShouldCascadeObsolete()
        {
            // Arrange
            _mockCurrentUserService.Setup(s => s.GetRequiredUserId()).Returns(100);
            _mockCurrentUserService.Setup(s => s.IsInRole("TechnicalManager")).Returns(true);
            _mockUserRepo.Setup(r => r.GetByIdAsync(100, It.IsAny<CancellationToken>())).ReturnsAsync(new User { UserId = 100, FullName = "TM User" });

            var task = new ProjectTask { TaskId = 1, Phase = new Phase { PhaseId = 1, ProjectId = 10 } };
            var dependentTask = new ProjectTask { TaskId = 2, Phase = new Phase { PhaseId = 1, ProjectId = 10 }, Status = BPG.Domain.Constants.TaskStatus.New };
            
            var dependencies = new List<TaskDependency>
            {
                new TaskDependency { TaskId = 2, PredecessorTaskId = 1 }
            };

            var tasks = new List<ProjectTask> { task, dependentTask };
            _mockTaskRepo.Setup(r => r.Query()).Returns(tasks.AsQueryable().BuildMock());
            _mockDependencyRepo.Setup(r => r.Query()).Returns(dependencies.AsQueryable().BuildMock());

            var command = new MarkTaskObsoleteCommand(1, "Lý do");

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            dependentTask.Status.Should().Be(BPG.Domain.Constants.TaskStatus.Obsolete);
            dependentTask.ObsoleteReason.Should().Contain("Tự động tạm dừng");
            _mockTaskRepo.Verify(r => r.Update(dependentTask), Times.Once);
        }

        [Fact]
        public async Task UTCID08_Handle_HasAssignees_ShouldNotifyAssignees()
        {
            // Arrange
            _mockCurrentUserService.Setup(s => s.GetRequiredUserId()).Returns(100);
            _mockCurrentUserService.Setup(s => s.IsInRole("TechnicalManager")).Returns(true);
            _mockUserRepo.Setup(r => r.GetByIdAsync(100, It.IsAny<CancellationToken>())).ReturnsAsync(new User { UserId = 100, FullName = "TM User" });

            var task = new ProjectTask
            {
                TaskId = 1,
                Phase = new Phase { PhaseId = 1, ProjectId = 10 },
                Assignees = new List<TaskAssignee>
                {
                    new TaskAssignee { UserId = 200 }
                }
            };
            
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());
            _mockDependencyRepo.Setup(r => r.Query()).Returns(new List<TaskDependency>().AsQueryable().BuildMock());

            var command = new MarkTaskObsoleteCommand(1, "Hủy");

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            _mockNotificationService.Verify(s => s.SendNotificationAsync(200, It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), 1, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID09_Handle_Success_ShouldCallRealtimeSender()
        {
            // Arrange
            _mockCurrentUserService.Setup(s => s.GetRequiredUserId()).Returns(100);
            _mockCurrentUserService.Setup(s => s.IsInRole("TechnicalManager")).Returns(true);
            _mockUserRepo.Setup(r => r.GetByIdAsync(100, It.IsAny<CancellationToken>())).ReturnsAsync(new User { UserId = 100, FullName = "TM User" });

            var task = new ProjectTask { TaskId = 1, Phase = new Phase { PhaseId = 1, ProjectId = 10 } };
            
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());
            _mockDependencyRepo.Setup(r => r.Query()).Returns(new List<TaskDependency>().AsQueryable().BuildMock());

            var command = new MarkTaskObsoleteCommand(1, "Hủy");

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            _mockRealtimeSender.Verify(s => s.SendToGroupAsync("Project_10", "WbsTreeUpdated", It.IsAny<object>(), It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID10_Handle_LeaderOfDifferentProject_ShouldThrowForbiddenException()
        {
            // Arrange
            _mockCurrentUserService.Setup(s => s.GetRequiredUserId()).Returns(100);
            _mockCurrentUserService.Setup(s => s.IsInRole("TechnicalManager")).Returns(false);

            var task = new ProjectTask
            {
                TaskId = 1,
                Phase = new Phase { PhaseId = 1, ProjectId = 10 }
            };
            var member = new ProjectMember { ProjectId = 99, UserId = 100, IsLeader = true }; // Leader of project 99, not 10
            
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());
            _mockMemberRepo.Setup(r => r.Query()).Returns(new List<ProjectMember> { member }.AsQueryable().BuildMock());

            var command = new MarkTaskObsoleteCommand(1, "Hủy");

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<ForbiddenException>();
        }
    }
}
