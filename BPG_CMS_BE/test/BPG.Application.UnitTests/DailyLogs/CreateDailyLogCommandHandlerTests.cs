using AutoMapper;
using BPG.Application.Common.Models;
using BPG.Application.DTOs.DailyLogs;
using BPG.Application.Features.DailyLogs.Commands;
using BPG.Application.Features.DailyLogs.Handlers;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using MockQueryable;
using MockQueryable.Moq;
using Moq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Threading;
using System.Threading.Tasks;
using Xunit;
using BPG.Application.UnitTests.Helpers;

namespace BPG.Application.UnitTests.DailyLogs
{
    public class CreateDailyLogCommandHandlerTests
    {
        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IMapper> _mockMapper;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly Mock<INotificationService> _mockNotificationService;
        private readonly Mock<IRealtimeNotificationSender> _mockRealtimeSender;

        private readonly Mock<IGenericRepository<ProjectTask>> _mockTaskRepo;
        private readonly Mock<IGenericRepository<ProjectMember>> _mockMemberRepo;
        private readonly Mock<IGenericRepository<TaskAssignee>> _mockAssigneeRepo;
        private readonly Mock<IGenericRepository<TaskDependency>> _mockDependencyRepo;
        private readonly Mock<IGenericRepository<DailyLog>> _mockLogRepo;
        private readonly Mock<IGenericRepository<Attachment>> _mockAttachmentRepo;
        private readonly Mock<IGenericRepository<TaskProgressLog>> _mockProgressLogRepo;
        private readonly Mock<IGenericRepository<User>> _mockUserRepo;
        private readonly Mock<IGenericRepository<SystemConfig>> _mockConfigRepo;

        private readonly CreateDailyLogCommandHandler _handler;

        public CreateDailyLogCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockMapper = new Mock<IMapper>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();
            _mockNotificationService = new Mock<INotificationService>();
            _mockRealtimeSender = new Mock<IRealtimeNotificationSender>();

            _mockTaskRepo = new Mock<IGenericRepository<ProjectTask>>();
            _mockMemberRepo = new Mock<IGenericRepository<ProjectMember>>();
            _mockAssigneeRepo = new Mock<IGenericRepository<TaskAssignee>>();
            _mockDependencyRepo = new Mock<IGenericRepository<TaskDependency>>();
            _mockLogRepo = new Mock<IGenericRepository<DailyLog>>();
            _mockAttachmentRepo = new Mock<IGenericRepository<Attachment>>();
            _mockProgressLogRepo = new Mock<IGenericRepository<TaskProgressLog>>();
            _mockUserRepo = new Mock<IGenericRepository<User>>();
            _mockConfigRepo = new Mock<IGenericRepository<SystemConfig>>();

            _mockUow.Setup(u => u.Repository<ProjectTask>()).Returns(_mockTaskRepo.Object);
            _mockUow.Setup(u => u.Repository<ProjectMember>()).Returns(_mockMemberRepo.Object);
            _mockUow.Setup(u => u.Repository<TaskAssignee>()).Returns(_mockAssigneeRepo.Object);
            _mockUow.Setup(u => u.Repository<TaskDependency>()).Returns(_mockDependencyRepo.Object);
            _mockUow.Setup(u => u.Repository<DailyLog>()).Returns(_mockLogRepo.Object);
            _mockUow.Setup(u => u.Repository<Attachment>()).Returns(_mockAttachmentRepo.Object);
            _mockUow.Setup(u => u.Repository<TaskProgressLog>()).Returns(_mockProgressLogRepo.Object);
            _mockUow.Setup(u => u.Repository<User>()).Returns(_mockUserRepo.Object);
            _mockUow.Setup(u => u.Repository<SystemConfig>()).Returns(_mockConfigRepo.Object);

            // Default Query returns empty mockable lists
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask>().AsQueryable().BuildMock());
            _mockMemberRepo.Setup(r => r.Query()).Returns(new List<ProjectMember>().AsQueryable().BuildMock());
            _mockAssigneeRepo.Setup(r => r.Query()).Returns(new List<TaskAssignee>().AsQueryable().BuildMock());
            _mockDependencyRepo.Setup(r => r.Query()).Returns(new List<TaskDependency>().AsQueryable().BuildMock());
            _mockLogRepo.Setup(r => r.Query()).Returns(new List<DailyLog>().AsQueryable().BuildMock());
            _mockAttachmentRepo.Setup(r => r.Query()).Returns(new List<Attachment>().AsQueryable().BuildMock());
            _mockProgressLogRepo.Setup(r => r.Query()).Returns(new List<TaskProgressLog>().AsQueryable().BuildMock());
            _mockUserRepo.Setup(r => r.Query()).Returns(new List<User>().AsQueryable().BuildMock());

            // Default SystemConfig: edit window = 24h
            _mockConfigRepo.Setup(r => r.Query()).Returns(new List<SystemConfig>
            {
                new SystemConfig { ConfigKey = SystemConfigKeys.DailyLogEditWindowHours, ConfigValue = "24" }
            }.AsQueryable().BuildMock());

            // Default AddAsync setups
            _mockLogRepo.Setup(r => r.AddAsync(It.IsAny<DailyLog>(), It.IsAny<CancellationToken>()))
                .Callback<DailyLog, CancellationToken>((log, ct) => log.LogId = 800)
                .Returns(Task.CompletedTask);

            // Default mapper setup
            _mockMapper.Setup(m => m.Map<DailyLogDto>(It.IsAny<DailyLog>()))
                .Returns((DailyLog src) => new DailyLogDto
                {
                    LogId = src.LogId,
                    TaskId = src.TaskId,
                    NewProgressPercent = src.NewProgressPercent,
                    Description = src.Description
                });

            _handler = new CreateDailyLogCommandHandler(
                _mockUow.Object,
                _mockMapper.Object,
                _mockCurrentUserService.Object,
                _mockNotificationService.Object,
                _mockRealtimeSender.Object
            );
        }



        [Fact]
        public async Task UTCID01_Handle_ValidRequest_LeafTask_ShouldCreateDailyLogSuccessfully()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(10, BPG.Domain.Constants.UserRole.TechnicalManager, hasRole: true);

            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var task = new ProjectTask
            {
                TaskId = 100,
                Name = "Concrete Slab",
                ProgressPercent = 20,
                IsLocked = false,
                Phase = new Phase { Project = project },
                SubTasks = new List<ProjectTask>() // Leaf task (no subtasks)
            };
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());

            var user = new User { UserId = 10, FullName = "Admin User" };
            _mockUserRepo.Setup(r => r.Query()).Returns(new List<User> { user }.AsQueryable().BuildMock());

            var command = new CreateDailyLogCommand
            {
                TaskId = 100,
                NewProgressPercent = 50,
                Description = "Poured half slab",
                Images = new List<string> { "http://site.com/img.jpg" }
            };

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.LogId.Should().Be(800);
            result.NewProgressPercent.Should().Be(50);
            result.EditWindowHours.Should().Be(24);
            result.CanEdit.Should().BeTrue();

            task.ProgressPercent.Should().Be(50);
            task.Status.Should().Be(BPG.Domain.Constants.TaskStatus.InProgress);

            _mockUow.Verify(u => u.BeginTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
            _mockLogRepo.Verify(r => r.AddAsync(It.Is<DailyLog>(l => l.TaskId == 100 && l.NewProgressPercent == 50), It.IsAny<CancellationToken>()), Times.Once);
            _mockAttachmentRepo.Verify(r => r.AddRangeAsync(It.Is<IEnumerable<Attachment>>(l => l.First().FileUrl == "http://site.com/img.jpg"), It.IsAny<CancellationToken>()), Times.Once);
            _mockProgressLogRepo.Verify(r => r.AddAsync(It.Is<TaskProgressLog>(tpl => tpl.OldProgress == 20 && tpl.NewProgress == 50), It.IsAny<CancellationToken>()), Times.Once);
            _mockUow.Verify(u => u.CommitTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
            _mockRealtimeSender.Verify(s => s.SendToGroupAsync("Project_5", "ReceiveDailyLogCreated", It.IsAny<DailyLogDto>(), It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID02_Handle_ProgressPercent100_ShouldSetStatusToCompleted()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(10, BPG.Domain.Constants.UserRole.TechnicalManager, hasRole: true);

            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var task = new ProjectTask
            {
                TaskId = 100,
                Name = "Concrete Slab",
                ProgressPercent = 50,
                IsLocked = false,
                Phase = new Phase { Project = project },
                SubTasks = new List<ProjectTask>()
            };
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());

            var user = new User { UserId = 10, FullName = "Admin User" };
            _mockUserRepo.Setup(r => r.Query()).Returns(new List<User> { user }.AsQueryable().BuildMock());

            var command = new CreateDailyLogCommand
            {
                TaskId = 100,
                NewProgressPercent = 100,
                Description = "Finished Slab"
            };

            // Act
            await _handler.Handle(command, CancellationToken.None);

            // Assert
            task.ProgressPercent.Should().Be(100);
            task.Status.Should().Be(BPG.Domain.Constants.TaskStatus.Completed);
        }

        [Fact]
        public async Task UTCID03_Handle_TaskNotFound_ShouldThrowNotFoundException()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(10, BPG.Domain.Constants.UserRole.TechnicalManager, hasRole: true);
            var command = new CreateDailyLogCommand { TaskId = 999, NewProgressPercent = 50 };

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<NotFoundException>()
                .WithMessage("ProjectTask với ID [999] không tồn tại.");
        }

        [Fact]
        public async Task UTCID04_Handle_ProjectNotActive_ShouldThrowBusinessException()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(10, BPG.Domain.Constants.UserRole.TechnicalManager, hasRole: true);

            var project = new Project { ProjectId = 5, Status = ProjectStatus.Completed }; // Inactive
            var task = new ProjectTask
            {
                TaskId = 100,
                Phase = new Phase { Project = project }
            };
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());

            var command = new CreateDailyLogCommand { TaskId = 100, NewProgressPercent = 50 };

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage(ValidationMessages.ProjectNotActive);
        }

        [Fact]
        public async Task UTCID05_Handle_TaskIsLocked_ShouldThrowBusinessException()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(10, BPG.Domain.Constants.UserRole.TechnicalManager, hasRole: true);

            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var task = new ProjectTask
            {
                TaskId = 100,
                Name = "Slab",
                IsLocked = true, // Locked!
                Phase = new Phase { Project = project }
            };
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());

            var command = new CreateDailyLogCommand { TaskId = 100, NewProgressPercent = 50 };

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("*Không thể cập nhật tiến độ vì công việc hoặc cấp cha [Slab] đã được nghiệm thu và khóa.*");
        }

        [Fact]
        public async Task UTCID06_Handle_AncestorTaskIsLocked_ShouldThrowBusinessException()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(10, BPG.Domain.Constants.UserRole.TechnicalManager, hasRole: true);

            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var parentTask = new ProjectTask { TaskId = 90, Name = "Structure Parent", IsLocked = true }; // Parent locked!
            var task = new ProjectTask
            {
                TaskId = 100,
                Name = "Slab",
                IsLocked = false,
                ParentTaskId = 90,
                Phase = new Phase { Project = project }
            };
            // Setup query return both tasks
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task, parentTask }.AsQueryable().BuildMock());

            var command = new CreateDailyLogCommand { TaskId = 100, NewProgressPercent = 50 };

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("*Không thể cập nhật tiến độ vì công việc hoặc cấp cha [Structure Parent] đã được nghiệm thu và khóa.*");
        }

        [Fact]
        public async Task UTCID07_Handle_TaskHasSubtasks_ShouldThrowBusinessException()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(10, BPG.Domain.Constants.UserRole.TechnicalManager, hasRole: true);

            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var subtask = new ProjectTask { TaskId = 101, IsDeleted = false };
            var task = new ProjectTask
            {
                TaskId = 100,
                Phase = new Phase { Project = project },
                SubTasks = new List<ProjectTask> { subtask } // Has active subtasks!
            };
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());

            var command = new CreateDailyLogCommand { TaskId = 100, NewProgressPercent = 50 };

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Không thể cập nhật tiến độ thủ công cho công việc cha có chứa các công việc con.");
        }

        [Fact]
        public async Task UTCID08_Handle_PredecessorNotCompleted_ShouldThrowBusinessException()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(10, BPG.Domain.Constants.UserRole.TechnicalManager, hasRole: true);

            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var task = new ProjectTask
            {
                TaskId = 100,
                Phase = new Phase { Project = project },
                SubTasks = new List<ProjectTask>()
            };
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());

            // Predecessor task: only 80% completed
            var predecessor = new ProjectTask { TaskId = 50, Name = "Foundation Work", ProgressPercent = 80 };
            var dependency = new TaskDependency { TaskId = 100, PredecessorTaskId = 50, Predecessor = predecessor };
            _mockDependencyRepo.Setup(r => r.Query()).Returns(new List<TaskDependency> { dependency }.AsQueryable().BuildMock());

            var command = new CreateDailyLogCommand { TaskId = 100, NewProgressPercent = 10 }; // Log progress > 0

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Không thể cập nhật tiến độ. Các công việc tiên quyết chưa hoàn thành: Foundation Work");
        }

        [Fact]
        public async Task UTCID09_Handle_DecreaseProgressByLeader_ShouldThrowBusinessException()
        {
            // Arrange
            // User is not Admin/TM, but is a leader
            _mockCurrentUserService.SetupUser(10, BPG.Domain.Constants.UserRole.SiteEngineer, hasRole: false);

            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var task = new ProjectTask
            {
                TaskId = 100,
                ProgressPercent = 50, // Old progress is 50%
                Phase = new Phase { Project = project },
                SubTasks = new List<ProjectTask>()
            };
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());

            // User is leader
            var leaderMember = new ProjectMember { ProjectId = 5, UserId = 10, IsLeader = true };
            _mockMemberRepo.Setup(r => r.Query()).Returns(new List<ProjectMember> { leaderMember }.AsQueryable().BuildMock());

            var command = new CreateDailyLogCommand
            {
                TaskId = 100,
                NewProgressPercent = 30, // Request lùi tiến độ (30 < 50)
                Description = "Correction needed"
            };

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Chỉ Quản trị viên hoặc Trưởng phòng kỹ thuật mới có quyền giảm tiến độ công việc.");
        }

        [Fact]
        public async Task UTCID10_Handle_DecreaseProgressByAdminWithoutReason_ShouldThrowBusinessException()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(10, BPG.Domain.Constants.UserRole.TechnicalManager, hasRole: true); // User is Admin

            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var task = new ProjectTask
            {
                TaskId = 100,
                ProgressPercent = 50,
                Phase = new Phase { Project = project },
                SubTasks = new List<ProjectTask>()
            };
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());

            var command = new CreateDailyLogCommand
            {
                TaskId = 100,
                NewProgressPercent = 30, // Decrease progress
                Description = "" // EMPTY REASON!
            };

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Vui lòng nhập lý do giảm tiến độ công việc.");
        }

        [Fact]
        public async Task UTCID11_Handle_DecreaseProgressByAdminWithReason_ShouldSucceed()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(10, BPG.Domain.Constants.UserRole.TechnicalManager, hasRole: true); // TM

            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var task = new ProjectTask
            {
                TaskId = 100,
                ProgressPercent = 50,
                Phase = new Phase { Project = project },
                SubTasks = new List<ProjectTask>()
            };
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());

            var user = new User { UserId = 10, FullName = "TM User" };
            _mockUserRepo.Setup(r => r.Query()).Returns(new List<User> { user }.AsQueryable().BuildMock());

            var command = new CreateDailyLogCommand
            {
                TaskId = 100,
                NewProgressPercent = 30,
                Description = "Re-evaluation of foundation concrete" // Reason provided
            };

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.EditWindowHours.Should().Be(24);
            result.CanEdit.Should().BeTrue();
            task.ProgressPercent.Should().Be(30);
        }

        [Fact]
        public async Task UTCID12_Handle_MultipleImages_ShouldSucceed()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(10, BPG.Domain.Constants.UserRole.TechnicalManager, hasRole: true);

            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var task = new ProjectTask
            {
                TaskId = 100,
                Phase = new Phase { Project = project }
            };
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());

            var user = new User { UserId = 10, FullName = "Admin User" };
            _mockUserRepo.Setup(r => r.Query()).Returns(new List<User> { user }.AsQueryable().BuildMock());

            var images = new List<string> { "1", "2", "3", "4", "5", "6", "7", "8" }; // 8 images
            var command = new CreateDailyLogCommand
            {
                TaskId = 100,
                NewProgressPercent = 50,
                Description = "Multiple images test",
                Images = images
            };

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.EditWindowHours.Should().Be(24);
            result.CanEdit.Should().BeTrue();
            _mockAttachmentRepo.Verify(r => r.AddRangeAsync(
        It.Is<IEnumerable<Attachment>>(l => l.Count() == 8),
        It.IsAny<CancellationToken>()
    ), Times.Once);
        }

        [Fact]
        public async Task UTCID13_Handle_InsufficientPermission_ShouldThrowForbiddenException()
        {
            // Arrange
            // Not Admin/TM, not project member, not assignee
            _mockCurrentUserService.SetupUser(10, BPG.Domain.Constants.UserRole.SiteEngineer, hasRole: false);

            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var task = new ProjectTask
            {
                TaskId = 100,
                Phase = new Phase { Project = project }
            };
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());

            var command = new CreateDailyLogCommand { TaskId = 100, NewProgressPercent = 50 };

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<ForbiddenException>()
                .WithMessage("Chỉ Trưởng dự án (Leader), Ban quản lý hoặc Kỹ sư được gán vào công việc mới được phép tạo nhật ký thi công.");
        }

        [Fact]
        public async Task UTCID14_Handle_ExceptionDuringUpdate_ShouldRollbackAndThrow()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(10, BPG.Domain.Constants.UserRole.TechnicalManager, hasRole: true);

            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var task = new ProjectTask
            {
                TaskId = 100,
                Phase = new Phase { Project = project }
            };
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());

            _mockUow.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ThrowsAsync(new Exception("DB Error"));

            var command = new CreateDailyLogCommand { TaskId = 100, NewProgressPercent = 50, Description = "Succeed" };

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<Exception>().WithMessage("DB Error");
            _mockUow.Verify(u => u.RollbackTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID15_Handle_ValidRequest_ProgressIsZero_ShouldSucceed()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(10, BPG.Domain.Constants.UserRole.TechnicalManager, hasRole: true);

            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var task = new ProjectTask
            {
                TaskId = 100,
                ProgressPercent = 0,
                Phase = new Phase { Project = project },
                SubTasks = new List<ProjectTask>()
            };
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());

            var predecessor = new ProjectTask { TaskId = 99, ProgressPercent = 50, Status = BPG.Domain.Constants.TaskStatus.InProgress };
            var dependency = new TaskDependency { TaskId = 100, PredecessorTaskId = 99, Predecessor = predecessor };
            _mockDependencyRepo.Setup(r => r.Query()).Returns(new List<TaskDependency> { dependency }.AsQueryable().BuildMock());

            var user = new User { UserId = 10, FullName = "Admin User", UserRoles = new List<BPG.Domain.Entities.UserRole>() };
            _mockUserRepo.Setup(r => r.Query()).Returns(new List<User> { user }.AsQueryable().BuildMock());

            var command = new CreateDailyLogCommand
            {
                TaskId = 100,
                NewProgressPercent = 0,
                Description = "Site inspection, no progress yet"
            };

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.EditWindowHours.Should().Be(24);
            result.CanEdit.Should().BeTrue();
            task.ProgressPercent.Should().Be(0);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.AtLeastOnce);
        }

        [Fact]
        public async Task UTCID16_Handle_TaskIsAlreadyCompleted_ReportingLowerProgress_ShouldThrowBusinessException()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(10, BPG.Domain.Constants.UserRole.SiteEngineer, hasRole: false); // Normal user, not Admin/TM

            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var task = new ProjectTask
            {
                TaskId = 100,
                ProgressPercent = 100,
                Phase = new Phase { Project = project }
            };
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());

            // Mock Assignee to pass the initial permission check
            var assignee = new TaskAssignee { TaskId = 100, UserId = 10 };
            _mockAssigneeRepo.Setup(r => r.Query()).Returns(new List<TaskAssignee> { assignee }.AsQueryable().BuildMock());

            var command = new CreateDailyLogCommand
            {
                TaskId = 100,
                NewProgressPercent = 80,
                Description = "Attempting to decrease progress"
            };

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Chỉ Quản trị viên hoặc Trưởng phòng kỹ thuật mới có quyền giảm tiến độ công việc.");
        }

        [Fact]
        public async Task UTCID17_Handle_TaskIsAlreadyCompleted_ReportingSameProgress_ShouldSucceed()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(10, BPG.Domain.Constants.UserRole.TechnicalManager, hasRole: true);

            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var task = new ProjectTask
            {
                TaskId = 100,
                ProgressPercent = 100,
                Phase = new Phase { Project = project },
                SubTasks = new List<ProjectTask>()
            };
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());

            var user = new User { UserId = 10, FullName = "Admin User", UserRoles = new List<BPG.Domain.Entities.UserRole>() };
            _mockUserRepo.Setup(r => r.Query()).Returns(new List<User> { user }.AsQueryable().BuildMock());

            var command = new CreateDailyLogCommand
            {
                TaskId = 100,
                NewProgressPercent = 100,
                Description = "Re-reporting completed state"
            };

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.EditWindowHours.Should().Be(24);
            result.CanEdit.Should().BeTrue();
            task.ProgressPercent.Should().Be(100);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.AtLeastOnce);
        }

        [Fact]
        public async Task UTCID18Handle_MultiplePredecessorDependencies_ShouldThrowIfAnyPredecessorIncomplete()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(10, BPG.Domain.Constants.UserRole.TechnicalManager, hasRole: true);

            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var task = new ProjectTask
            {
                TaskId = 100,
                ProgressPercent = 0,
                Phase = new Phase { Project = project }
            };
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { task }.AsQueryable().BuildMock());

            var predecessor1 = new ProjectTask { TaskId = 91, ProgressPercent = 100, Status = BPG.Domain.Constants.TaskStatus.Completed };
            var predecessor2 = new ProjectTask { TaskId = 92, ProgressPercent = 50, Status = BPG.Domain.Constants.TaskStatus.InProgress, Name = "Unfinished Foundation Work" };

            var dependency1 = new TaskDependency { TaskId = 100, PredecessorTaskId = 91, Predecessor = predecessor1 };
            var dependency2 = new TaskDependency { TaskId = 100, PredecessorTaskId = 92, Predecessor = predecessor2 };
            _mockDependencyRepo.Setup(r => r.Query()).Returns(new List<TaskDependency> { dependency1, dependency2 }.AsQueryable().BuildMock());

            var command = new CreateDailyLogCommand
            {
                TaskId = 100,
                NewProgressPercent = 10,
                Description = "Trying to progress despite incomplete predecessor"
            };

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("*Các công việc tiên quyết chưa hoàn thành: Unfinished Foundation Work*");
        }

        [Fact]
        public async Task UTCID20_Handle_SubtaskDecreaseProgress_ShouldDecreaseParentProgressAndCreateParentDailyLog()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(10, BPG.Domain.Constants.UserRole.TechnicalManager, hasRole: true);

            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };

            // Parent task has 80% progress
            var parentTask = new ProjectTask
            {
                TaskId = 90,
                ProgressPercent = 80,
                Phase = new Phase { Project = project },
                SubTasks = new List<ProjectTask>()
            };

            // Child task currently has 80% progress, and belongs to the parent task
            var childTask = new ProjectTask
            {
                TaskId = 100,
                ParentTaskId = 90,
                ProgressPercent = 80,
                Phase = new Phase { Project = project },
                SubTasks = new List<ProjectTask>()
            };

            parentTask.SubTasks.Add(childTask);

            // Mock repo query to return both tasks
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { parentTask, childTask }.AsQueryable().BuildMock());

            var user = new User { UserId = 10, FullName = "TM User", UserRoles = new List<BPG.Domain.Entities.UserRole>() };
            _mockUserRepo.Setup(r => r.Query()).Returns(new List<User> { user }.AsQueryable().BuildMock());

            // Capture DailyLogs added to verify that both child and parent logs are created
            var capturedLogs = new List<DailyLog>();
            _mockLogRepo.Setup(r => r.AddAsync(It.IsAny<DailyLog>(), It.IsAny<CancellationToken>()))
                .Callback<DailyLog, CancellationToken>((log, ct) => capturedLogs.Add(log))
                .Returns(Task.CompletedTask);

            var command = new CreateDailyLogCommand
            {
                TaskId = 100,
                NewProgressPercent = 50, // Decreased from 80% to 50%
                Description = "Decreasing child task progress"
            };

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            childTask.ProgressPercent.Should().Be(50);
            parentTask.ProgressPercent.Should().Be(50); // Rolled up parent task progress should be updated to 50% (average of child task)

            // Should capture two DailyLog entries: one for child task (100) and one for parent task (90)
            capturedLogs.Should().HaveCount(2);
            capturedLogs.Any(l => l.TaskId == 100 && l.NewProgressPercent == 50).Should().BeTrue();
            capturedLogs.Any(l => l.TaskId == 90 && l.NewProgressPercent == 50 && l.Description.Contains("Tiến độ giảm tự động")).Should().BeTrue();

            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.AtLeastOnce);
        }
    }
}
