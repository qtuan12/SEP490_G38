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

namespace BPG.Application.UnitTests.DailyLogs
{
    public class UpdateDailyLogCommandHandlerTests
    {
        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IMapper> _mockMapper;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly Mock<IRealtimeNotificationSender> _mockRealtimeSender;

        private readonly Mock<IGenericRepository<DailyLog>> _mockLogRepo;
        private readonly Mock<IGenericRepository<ProjectMember>> _mockMemberRepo;
        private readonly Mock<IGenericRepository<TaskAssignee>> _mockAssigneeRepo;
        private readonly Mock<IGenericRepository<Attachment>> _mockAttachmentRepo;
        private readonly Mock<IGenericRepository<User>> _mockUserRepo;
        private readonly Mock<IGenericRepository<TaskProgressLog>> _mockProgressLogRepo;

        private readonly UpdateDailyLogCommandHandler _handler;

        public UpdateDailyLogCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockMapper = new Mock<IMapper>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();
            _mockRealtimeSender = new Mock<IRealtimeNotificationSender>();

            _mockLogRepo = new Mock<IGenericRepository<DailyLog>>();
            _mockMemberRepo = new Mock<IGenericRepository<ProjectMember>>();
            _mockAssigneeRepo = new Mock<IGenericRepository<TaskAssignee>>();
            _mockAttachmentRepo = new Mock<IGenericRepository<Attachment>>();
            _mockUserRepo = new Mock<IGenericRepository<User>>();
            _mockProgressLogRepo = new Mock<IGenericRepository<TaskProgressLog>>();

            _mockUow.Setup(u => u.Repository<DailyLog>()).Returns(_mockLogRepo.Object);
            _mockUow.Setup(u => u.Repository<ProjectMember>()).Returns(_mockMemberRepo.Object);
            _mockUow.Setup(u => u.Repository<TaskAssignee>()).Returns(_mockAssigneeRepo.Object);
            _mockUow.Setup(u => u.Repository<Attachment>()).Returns(_mockAttachmentRepo.Object);
            _mockUow.Setup(u => u.Repository<User>()).Returns(_mockUserRepo.Object);
            _mockUow.Setup(u => u.Repository<TaskProgressLog>()).Returns(_mockProgressLogRepo.Object);

            // Default mock setups
            _mockLogRepo.Setup(r => r.Query()).Returns(new List<DailyLog>().AsQueryable().BuildMock());
            _mockMemberRepo.Setup(r => r.Query()).Returns(new List<ProjectMember>().AsQueryable().BuildMock());
            _mockAssigneeRepo.Setup(r => r.Query()).Returns(new List<TaskAssignee>().AsQueryable().BuildMock());
            _mockAttachmentRepo.Setup(r => r.Query()).Returns(new List<Attachment>().AsQueryable().BuildMock());
            _mockUserRepo.Setup(r => r.Query()).Returns(new List<User>().AsQueryable().BuildMock());
            _mockProgressLogRepo.Setup(r => r.Query()).Returns(new List<TaskProgressLog>().AsQueryable().BuildMock());

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
                _mockRealtimeSender.Object
            );
        }

        private void SetupCurrentUser(long userId, string role, bool isAdminOrTM = true)
        {
            _mockCurrentUserService.Setup(s => s.GetRequiredUserId()).Returns(userId);
            _mockCurrentUserService.Setup(s => s.IsInAnyRole(It.IsAny<string[]>()))
                .Returns((string[] roles) => roles.Contains(role) && isAdminOrTM);
        }

        [Fact]
        public async Task UTCID01_Handle_ValidRequest_ShouldUpdateDailyLogSuccessfully()
        {
            // Arrange
            SetupCurrentUser(10, BPG.Domain.Constants.UserRole.Admin, isAdminOrTM: true);

            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var log = new DailyLog
            {
                LogId = 800,
                TaskId = 100,
                NewProgressPercent = 50,
                Description = "Old description",
                CreatedBy = 10,
                CreatedAt = DateTime.UtcNow.AddMinutes(-5),
                Task = new ProjectTask
                {
                    TaskId = 100,
                    Name = "Slab Work",
                    IsLocked = false,
                    Phase = new Phase { Project = project }
                }
            };
            _mockLogRepo.Setup(r => r.Query()).Returns(new List<DailyLog> { log }.AsQueryable().BuildMock());

            // Mock old attachments (one remains, one is deleted)
            var oldAtt1 = new Attachment { EntityType = EntityType.DailyLog, EntityId = 800, FileUrl = "http://site.com/old1.jpg", IsDeleted = false };
            var oldAtt2 = new Attachment { EntityType = EntityType.DailyLog, EntityId = 800, FileUrl = "http://site.com/old2.jpg", IsDeleted = false };
            _mockAttachmentRepo.Setup(r => r.Query()).Returns(new List<Attachment> { oldAtt1, oldAtt2 }.AsQueryable().BuildMock());

            var user = new User { UserId = 10, FullName = "Admin User" };
            _mockUserRepo.Setup(r => r.Query()).Returns(new List<User> { user }.AsQueryable().BuildMock());

            // Mock Progress Log history for old progress mapping
            var progressLog = new TaskProgressLog { TaskId = 100, NewProgress = 50, OldProgress = 20, UpdatedAt = DateTime.UtcNow.AddMinutes(-5) };
            _mockProgressLogRepo.Setup(r => r.Query()).Returns(new List<TaskProgressLog> { progressLog }.AsQueryable().BuildMock());

            // Request keeps old1.jpg, removes old2.jpg, adds new1.jpg
            var command = new UpdateDailyLogCommand
            {
                LogId = 800,
                Description = "Updated description with new details",
                Images = new List<string> { "http://site.com/old1.jpg", "http://site.com/new1.jpg" }
            };

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.Description.Should().Be("Updated description with new details");
            result.OldProgressPercent.Should().Be(20); // Mapped correctly

            log.Description.Should().Be("Updated description with new details");

            _mockUow.Verify(u => u.BeginTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
            _mockLogRepo.Verify(r => r.Update(log), Times.Once);

            // Verify oldAtt2 is soft deleted (since it is absent in new request list)
            oldAtt2.IsDeleted.Should().BeTrue();
            _mockAttachmentRepo.Verify(r => r.Update(oldAtt2), Times.Once);

            // Verify new1.jpg is added
            _mockAttachmentRepo.Verify(r => r.AddRangeAsync(It.Is<IEnumerable<Attachment>>(l => l.First().FileUrl == "http://site.com/new1.jpg"), It.IsAny<CancellationToken>()), Times.Once);

            _mockUow.Verify(u => u.CommitTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
            _mockRealtimeSender.Verify(s => s.SendToGroupAsync("Project_5", "ReceiveDailyLogUpdated", It.IsAny<DailyLogDto>(), It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID02_Handle_DailyLogNotFound_ShouldThrowNotFoundException()
        {
            // Arrange
            SetupCurrentUser(10, BPG.Domain.Constants.UserRole.Admin);
            var command = new UpdateDailyLogCommand { LogId = 999, Description = "New Desc" };

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<NotFoundException>()
                .WithMessage("DailyLog với ID [999] không tồn tại.");
        }

        [Fact]
        public async Task UTCID03_Handle_InsufficientPermission_ShouldThrowForbiddenException()
        {
            // Arrange
            SetupCurrentUser(10, BPG.Domain.Constants.UserRole.SiteEngineer, isAdminOrTM: false); // Engineer

            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var log = new DailyLog
            {
                LogId = 800,
                TaskId = 100,
                Task = new ProjectTask
                {
                    TaskId = 100,
                    IsLocked = false,
                    Phase = new Phase { Project = project }
                }
            };
            _mockLogRepo.Setup(r => r.Query()).Returns(new List<DailyLog> { log }.AsQueryable().BuildMock());

            // Not a project leader, and not assigned to task
            var command = new UpdateDailyLogCommand { LogId = 800, Description = "New Desc" };

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<ForbiddenException>()
                .WithMessage("Chỉ Trưởng dự án (Leader), Ban quản lý hoặc Kỹ sư được gán vào công việc mới được phép chỉnh sửa nhật ký thi công.");
        }

        [Fact]
        public async Task UTCID04_Handle_ProjectNotActive_ShouldThrowBusinessException()
        {
            // Arrange
            SetupCurrentUser(10, BPG.Domain.Constants.UserRole.Admin);

            var project = new Project { ProjectId = 5, Status = ProjectStatus.Completed }; // Inactive
            var log = new DailyLog
            {
                LogId = 800,
                Task = new ProjectTask { Phase = new Phase { Project = project } }
            };
            _mockLogRepo.Setup(r => r.Query()).Returns(new List<DailyLog> { log }.AsQueryable().BuildMock());

            var command = new UpdateDailyLogCommand { LogId = 800, Description = "New Desc" };

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
            SetupCurrentUser(10, BPG.Domain.Constants.UserRole.Admin);

            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var log = new DailyLog
            {
                LogId = 800,
                Task = new ProjectTask
                {
                    IsLocked = true, // Locked!
                    Phase = new Phase { Project = project }
                }
            };
            _mockLogRepo.Setup(r => r.Query()).Returns(new List<DailyLog> { log }.AsQueryable().BuildMock());

            var command = new UpdateDailyLogCommand { LogId = 800, Description = "New Desc" };

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Công việc này đã được nghiệm thu và khóa tiến độ, không thể chỉnh sửa nhật ký thi công.");
        }

        [Fact]
        public async Task UTCID06_Handle_MaxImagesExceeded_ShouldThrowBusinessException()
        {
            // Arrange
            SetupCurrentUser(10, BPG.Domain.Constants.UserRole.Admin);

            var project = new Project { ProjectId = 5, Status = ProjectStatus.InProgress };
            var log = new DailyLog
            {
                LogId = 800,
                Task = new ProjectTask
                {
                    IsLocked = false,
                    Phase = new Phase { Project = project }
                }
            };
            _mockLogRepo.Setup(r => r.Query()).Returns(new List<DailyLog> { log }.AsQueryable().BuildMock());

            var tooManyImages = new List<string> { "1", "2", "3", "4", "5", "6" }; // 6 images
            var command = new UpdateDailyLogCommand { LogId = 800, Description = "New Desc", Images = tooManyImages };

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<BusinessException>()
                .WithMessage("Tối đa chỉ được đính kèm 5 hình ảnh hiện trường thi công.");
        }
    }
}
