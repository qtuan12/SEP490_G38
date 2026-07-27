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
using System.Threading;
using System.Threading.Tasks;
using Xunit;
using BPG.Application.UnitTests.Helpers;

namespace BPG.Application.UnitTests.DailyLogs
{
    public class UpdateDailyLogCommandHandlerTests
    {
        private const long CurrentUserId = 10;
        private const long ProjectId = 5;
        private const long LogId = 800;
        private const long TaskId = 100;
        private const long ParentTaskId = 90;
        private const string DefaultDescription = "New Desc";

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IMapper> _mockMapper;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;

        private readonly Mock<IGenericRepository<DailyLog>> _mockLogRepo;
        private readonly Mock<IGenericRepository<ProjectTask>> _mockTaskRepo;
        private readonly Mock<IGenericRepository<ProjectMember>> _mockMemberRepo;
        private readonly Mock<IGenericRepository<TaskAssignee>> _mockAssigneeRepo;
        private readonly Mock<IGenericRepository<Attachment>> _mockAttachmentRepo;
        private readonly Mock<IGenericRepository<User>> _mockUserRepo;
        private readonly Mock<IGenericRepository<TaskProgressLog>> _mockProgressLogRepo;
        private readonly Mock<IGenericRepository<SystemConfig>> _mockConfigRepo;

        private readonly UpdateDailyLogCommandHandler _handler;

        public UpdateDailyLogCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockMapper = new Mock<IMapper>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();

            _mockLogRepo = new Mock<IGenericRepository<DailyLog>>();
            _mockTaskRepo = new Mock<IGenericRepository<ProjectTask>>();
            _mockMemberRepo = new Mock<IGenericRepository<ProjectMember>>();
            _mockAssigneeRepo = new Mock<IGenericRepository<TaskAssignee>>();
            _mockAttachmentRepo = new Mock<IGenericRepository<Attachment>>();
            _mockUserRepo = new Mock<IGenericRepository<User>>();
            _mockProgressLogRepo = new Mock<IGenericRepository<TaskProgressLog>>();
            _mockConfigRepo = new Mock<IGenericRepository<SystemConfig>>();

            _mockUow.Setup(u => u.Repository<DailyLog>()).Returns(_mockLogRepo.Object);
            _mockUow.Setup(u => u.Repository<ProjectTask>()).Returns(_mockTaskRepo.Object);
            _mockUow.Setup(u => u.Repository<ProjectMember>()).Returns(_mockMemberRepo.Object);
            _mockUow.Setup(u => u.Repository<TaskAssignee>()).Returns(_mockAssigneeRepo.Object);
            _mockUow.Setup(u => u.Repository<Attachment>()).Returns(_mockAttachmentRepo.Object);
            _mockUow.Setup(u => u.Repository<User>()).Returns(_mockUserRepo.Object);
            _mockUow.Setup(u => u.Repository<TaskProgressLog>()).Returns(_mockProgressLogRepo.Object);
            _mockUow.Setup(u => u.Repository<SystemConfig>()).Returns(_mockConfigRepo.Object);

            // Default mock setups
            _mockLogRepo.Setup(r => r.Query()).Returns(new List<DailyLog>().AsQueryable().BuildMock());
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask>().AsQueryable().BuildMock());
            _mockMemberRepo.Setup(r => r.Query()).Returns(new List<ProjectMember>().AsQueryable().BuildMock());
            _mockAssigneeRepo.Setup(r => r.Query()).Returns(new List<TaskAssignee>().AsQueryable().BuildMock());
            _mockAttachmentRepo.Setup(r => r.Query()).Returns(new List<Attachment>().AsQueryable().BuildMock());
            _mockUserRepo.Setup(r => r.Query()).Returns(new List<User>().AsQueryable().BuildMock());
            _mockProgressLogRepo.Setup(r => r.Query()).Returns(new List<TaskProgressLog>().AsQueryable().BuildMock());
            _mockConfigRepo.Setup(r => r.Query()).Returns(new List<SystemConfig>
            {
                new SystemConfig { ConfigKey = SystemConfigKeys.DailyLogEditWindowHours, ConfigValue = "24" }
            }.AsQueryable().BuildMock());

            // Default mapper setup
            _mockMapper.Setup(m => m.Map<DailyLogDto>(It.IsAny<DailyLog>()))
                .Returns((DailyLog src) => new DailyLogDto
                {
                    LogId = src.LogId,
                    TaskId = src.TaskId,
                    NewProgressPercent = src.NewProgressPercent,
                    Description = src.Description
                });

            _handler = new UpdateDailyLogCommandHandler(
                _mockUow.Object,
                _mockMapper.Object,
                _mockCurrentUserService.Object,
                Mock.Of<IRealtimeNotificationSender>()
            );
        }



        [Fact]
        public async Task UTCID01_Handle_ValidRequest_ShouldUpdateDailyLogSuccessfully()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(CurrentUserId, BPG.Domain.Constants.UserRole.TechnicalManager, hasRole: true);

            var project = Project();
            var log = new DailyLog
            {
                LogId = LogId,
                TaskId = TaskId,
                NewProgressPercent = 50,
                Description = "Old description",
                CreatedBy = CurrentUserId,
                CreatedAt = DateTime.UtcNow.AddMinutes(-5),
                Task = new ProjectTask
                {
                    TaskId = TaskId,
                    Name = "Slab Work",
                    IsLocked = false,
                    Phase = new Phase { Project = project }
                }
            };
            _mockLogRepo.Setup(r => r.Query()).Returns(new List<DailyLog> { log }.AsQueryable().BuildMock());

            // Mock old attachments (one remains, one is deleted)
            var oldAtt1 = DailyLogAttachment("http://site.com/old1.jpg");
            var oldAtt2 = DailyLogAttachment("http://site.com/old2.jpg");
            _mockAttachmentRepo.Setup(r => r.Query()).Returns(new List<Attachment> { oldAtt1, oldAtt2 }.AsQueryable().BuildMock());

            var user = new User { UserId = CurrentUserId, FullName = "Admin User" };
            _mockUserRepo.Setup(r => r.Query()).Returns(new List<User> { user }.AsQueryable().BuildMock());

            // Mock Progress Log history for old progress mapping
            var progressLog = new TaskProgressLog { TaskId = TaskId, NewProgress = 50, OldProgress = 20, UpdatedAt = DateTime.UtcNow.AddMinutes(-5) };
            _mockProgressLogRepo.Setup(r => r.Query()).Returns(new List<TaskProgressLog> { progressLog }.AsQueryable().BuildMock());

            // Request keeps old1.jpg, removes old2.jpg, adds new1.jpg
            var command = Command("Updated description with new details", new List<string> { "http://site.com/old1.jpg", "http://site.com/new1.jpg" });

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.Description.Should().Be("Updated description with new details");
            result.OldProgressPercent.Should().Be(20); // Mapped correctly

            result.EditWindowHours.Should().Be(24);
            result.CanEdit.Should().BeTrue(); // just edited -> still editable




        }

        [Fact]
        public async Task UTCID02_Handle_DailyLogNotFound_ShouldThrowNotFoundException()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(CurrentUserId, BPG.Domain.Constants.UserRole.TechnicalManager, hasRole: true);
            var command = Command(logId: 999);

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<NotFoundException>();
        }

        [Fact]
        public async Task UTCID03_Handle_InsufficientPermission_ShouldThrowForbiddenException()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(CurrentUserId, BPG.Domain.Constants.UserRole.SiteEngineer, hasRole: false); // Engineer

            var project = Project();
            var log = new DailyLog
            {
                LogId = LogId,
                TaskId = TaskId,
                Task = new ProjectTask
                {
                    TaskId = TaskId,
                    IsLocked = false,
                    Phase = new Phase { Project = project }
                }
            };
            _mockLogRepo.Setup(r => r.Query()).Returns(new List<DailyLog> { log }.AsQueryable().BuildMock());

            // Not a project leader, and not assigned to task
            var command = Command();

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<ForbiddenException>();
        }

        [Fact]
        public async Task UTCID04_Handle_ProjectNotActive_ShouldThrowBusinessException()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(CurrentUserId, BPG.Domain.Constants.UserRole.TechnicalManager, hasRole: true);

            var project = Project(ProjectStatus.Completed);
            var log = new DailyLog
            {
                LogId = LogId,
                Task = new ProjectTask { Phase = new Phase { Project = project } }
            };
            _mockLogRepo.Setup(r => r.Query()).Returns(new List<DailyLog> { log }.AsQueryable().BuildMock());

            var command = Command();

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>();
        }

        [Fact]
        public async Task UTCID05_Handle_TaskIsLocked_ShouldThrowBusinessException()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(CurrentUserId, BPG.Domain.Constants.UserRole.TechnicalManager, hasRole: true);

            var project = Project();
            var log = new DailyLog
            {
                LogId = LogId,
                Task = new ProjectTask
                {
                    IsLocked = true, // Locked!
                    Phase = new Phase { Project = project }
                }
            };
            _mockLogRepo.Setup(r => r.Query()).Returns(new List<DailyLog> { log }.AsQueryable().BuildMock());

            var command = Command();

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>();
        }

        [Fact]
public async Task UTCID06_Handle_MultipleImages_ShouldSucceed()
{
    // Arrange
    _mockCurrentUserService.SetupUser(CurrentUserId, BPG.Domain.Constants.UserRole.TechnicalManager, hasRole: true);

    var project = Project();
        var log = new DailyLog
        {
            LogId = LogId,
            CreatedAt = DateTime.UtcNow.AddMinutes(-10),
            Task = new ProjectTask
            {
                    IsLocked = false,
                    Phase = new Phase { Project = project }
                }
            };
            _mockLogRepo.Setup(r => r.Query()).Returns(new List<DailyLog> { log }.AsQueryable().BuildMock());
            _mockAttachmentRepo.Setup(r => r.Query()).Returns(new List<Attachment>().AsQueryable().BuildMock());

        var images = new List<string> { "1", "2", "3", "4", "5" }; // 5 images (within limit)
        var command = Command("Multiple images", images);

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
        }

        [Fact]
        public async Task UTCID07_Handle_UserIsAssignee_ShouldUpdateSuccessfully()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(CurrentUserId, BPG.Domain.Constants.UserRole.SiteEngineer, hasRole: false); // Engineer

            var project = Project();
            var log = new DailyLog
            {
                LogId = LogId,
                TaskId = TaskId,
                CreatedAt = DateTime.UtcNow.AddMinutes(-10),
                Task = new ProjectTask
                {
                    TaskId = TaskId,
                    IsLocked = false,
                    Phase = new Phase { Project = project }
                }
            };
            _mockLogRepo.Setup(r => r.Query()).Returns(new List<DailyLog> { log }.AsQueryable().BuildMock());

            var assignees = new List<TaskAssignee>
            {
                new TaskAssignee { TaskId = TaskId, UserId = CurrentUserId }
            };
            _mockAssigneeRepo.Setup(r => r.Query()).Returns(assignees.AsQueryable().BuildMock());
            _mockAttachmentRepo.Setup(r => r.Query()).Returns(new List<Attachment>().AsQueryable().BuildMock());

            var command = Command("New Description");

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.EditWindowHours.Should().Be(24);
            result.CanEdit.Should().BeTrue();
        }

        [Fact]
        public async Task UTCID08_Handle_ImagesIsNull_ShouldReturnDailyLogDto()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(CurrentUserId, BPG.Domain.Constants.UserRole.TechnicalManager, hasRole: true);

            var project = Project();
            var log = new DailyLog
            {
                LogId = LogId,
                CreatedAt = DateTime.UtcNow.AddMinutes(-10),
                Task = new ProjectTask
                {
                    IsLocked = false,
                    Phase = new Phase { Project = project }
                }
            };
            _mockLogRepo.Setup(r => r.Query()).Returns(new List<DailyLog> { log }.AsQueryable().BuildMock());

            var oldAtt = DailyLogAttachment("old.jpg");
            _mockAttachmentRepo.Setup(r => r.Query()).Returns(new List<Attachment> { oldAtt }.AsQueryable().BuildMock());

            var command = Command("Desc", images: null);

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
        }

        [Fact]
        public async Task UTCID09_Handle_ExceptionDuringUpdate_ShouldThrowException()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(CurrentUserId, BPG.Domain.Constants.UserRole.TechnicalManager, hasRole: true);

            var project = Project();
            var log = new DailyLog
            {
                LogId = LogId,
                CreatedAt = DateTime.UtcNow.AddMinutes(-10),
                Task = new ProjectTask
                {
                    IsLocked = false,
                    Phase = new Phase { Project = project }
                }
            };
            _mockLogRepo.Setup(r => r.Query()).Returns(new List<DailyLog> { log }.AsQueryable().BuildMock());
            _mockAttachmentRepo.Setup(r => r.Query()).Returns(new List<Attachment>().AsQueryable().BuildMock());

            _mockUow.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ThrowsAsync(new Exception("DB Error"));

            var command = Command("Desc");

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<Exception>();
        }

        [Fact]
        public async Task UTCID10_Handle_ValidRequest_ProgressUnchanged_DescriptionOrImagesChanged_ShouldSucceed()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(CurrentUserId, BPG.Domain.Constants.UserRole.TechnicalManager, hasRole: true);

            var project = Project();
            var log = new DailyLog
            {
                LogId = LogId,
                TaskId = TaskId,
                NewProgressPercent = 50,
                Description = "Old Description",
                CreatedAt = DateTime.UtcNow.AddMinutes(-10),
                Task = new ProjectTask
                {
                    TaskId = TaskId,
                    IsLocked = false,
                    Phase = new Phase { Project = project }
                }
            };
            _mockLogRepo.Setup(r => r.Query()).Returns(new List<DailyLog> { log }.AsQueryable().BuildMock());

            // Return empty attachments initially
            _mockAttachmentRepo.Setup(r => r.Query()).Returns(new List<Attachment>().AsQueryable().BuildMock());

            // Mock progress logs to verify OldProgressPercent resolving logic
            var progressLog = new TaskProgressLog
            {
                TaskId = TaskId,
                OldProgress = 40,
                NewProgress = 50,
                UpdatedAt = DateTime.UtcNow.AddMinutes(-10)
            };
            _mockProgressLogRepo.Setup(r => r.Query()).Returns(new List<TaskProgressLog> { progressLog }.AsQueryable().BuildMock());

            var newImages = new List<string> { "new_photo1.jpg" };
            var command = Command("New Description - Progress remains 50%", newImages);

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.OldProgressPercent.Should().Be(40);
            result.NewProgressPercent.Should().Be(50);
            result.Images.Should().ContainSingle(img => img == "new_photo1.jpg");
            result.EditWindowHours.Should().Be(24);
            result.CanEdit.Should().BeTrue();

        }

        [Fact]
        public async Task UTCID11_Handle_EditWindowExpired_ShouldThrowBusinessException()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(CurrentUserId, BPG.Domain.Constants.UserRole.TechnicalManager, hasRole: true);

            var project = Project();
            var log = new DailyLog
            {
                LogId = LogId,
                CreatedAt = DateTime.UtcNow.AddHours(-25),
                Task = new ProjectTask
                {
                    TaskId = TaskId,
                    IsLocked = false,
                    Phase = new Phase { Project = project }
                }
            };
            _mockLogRepo.Setup(r => r.Query()).Returns(new List<DailyLog> { log }.AsQueryable().BuildMock());

            var command = Command("Late update");

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_EDIT_WINDOW_EXPIRED");
        }

        [Fact]
        public async Task UTCID12_Handle_AncestorTaskObsolete_ShouldThrowBusinessException()
        {
            // Arrange
            _mockCurrentUserService.SetupUser(CurrentUserId, BPG.Domain.Constants.UserRole.TechnicalManager, hasRole: true);

            var project = Project();
            var log = new DailyLog
            {
                LogId = LogId,
                CreatedAt = DateTime.UtcNow.AddMinutes(-10),
                Task = new ProjectTask
                {
                    TaskId = TaskId,
                    ParentTaskId = ParentTaskId,
                    IsLocked = false,
                    Phase = new Phase { Project = project }
                }
            };
            var parentTask = new ProjectTask
            {
                TaskId = ParentTaskId,
                Name = "Obsolete parent",
                Status = BPG.Domain.Constants.TaskStatus.Obsolete
            };

            _mockLogRepo.Setup(r => r.Query()).Returns(new List<DailyLog> { log }.AsQueryable().BuildMock());
            _mockTaskRepo.Setup(r => r.Query()).Returns(new List<ProjectTask> { parentTask }.AsQueryable().BuildMock());

            var command = Command("Update obsolete branch");

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_TASK_OBSOLETE");
        }

        private static Project Project(string status = ProjectStatus.InProgress)
            => new() { ProjectId = ProjectId, Status = status };

        private static Attachment DailyLogAttachment(string fileUrl)
            => new()
            {
                EntityType = EntityType.DailyLog,
                EntityId = LogId,
                FileUrl = fileUrl,
                IsDeleted = false
            };

        private static UpdateDailyLogCommand Command(
            string description = DefaultDescription,
            List<string>? images = null,
            long logId = LogId)
            => new()
            {
                LogId = logId,
                Description = description,
                Images = images!
            };
    }
}
