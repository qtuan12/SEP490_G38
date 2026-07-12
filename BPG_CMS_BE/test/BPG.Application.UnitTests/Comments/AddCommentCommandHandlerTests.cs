using AutoMapper;
using BPG.Application.Common.Mappings;
using BPG.Application.DTOs.DailyLogs;
using BPG.Application.Features.Comments.Commands;
using BPG.Application.Features.Comments.Handlers;
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

namespace BPG.Application.UnitTests.Comments
{
    public class AddCommentCommandHandlerTests
    {
        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IGenericRepository<DailyLog>> _mockDailyLogRepo;
        private readonly Mock<IGenericRepository<ProjectMember>> _mockMemberRepo;
        private readonly Mock<IGenericRepository<Comment>> _mockCommentRepo;
        private readonly Mock<IGenericRepository<User>> _mockUserRepo;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly Mock<INotificationService> _mockNotificationService;
        private readonly Mock<IRealtimeNotificationSender> _mockRealtimeSender;
        private readonly IMapper _mapper;
        private readonly AddCommentCommandHandler _handler;

        public AddCommentCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockDailyLogRepo = new Mock<IGenericRepository<DailyLog>>();
            _mockMemberRepo = new Mock<IGenericRepository<ProjectMember>>();
            _mockCommentRepo = new Mock<IGenericRepository<Comment>>();
            _mockUserRepo = new Mock<IGenericRepository<User>>();

            _mockCurrentUserService = new Mock<ICurrentUserService>();
            _mockNotificationService = new Mock<INotificationService>();
            _mockRealtimeSender = new Mock<IRealtimeNotificationSender>();

            var mapperConfig = new MapperConfiguration(cfg =>
            {
                cfg.AddProfile<MappingProfile>();
            });
            _mapper = mapperConfig.CreateMapper();

            _mockUow.Setup(u => u.Repository<DailyLog>()).Returns(_mockDailyLogRepo.Object);
            _mockUow.Setup(u => u.Repository<ProjectMember>()).Returns(_mockMemberRepo.Object);
            _mockUow.Setup(u => u.Repository<Comment>()).Returns(_mockCommentRepo.Object);
            _mockUow.Setup(u => u.Repository<User>()).Returns(_mockUserRepo.Object);

            _handler = new AddCommentCommandHandler(
                _mockUow.Object,
                _mapper,
                _mockCurrentUserService.Object,
                _mockNotificationService.Object,
                _mockRealtimeSender.Object
            );
        }

        private void SetupCurrentUser(long userId, string role, bool isAuthenticated = true)
        {
            if (isAuthenticated)
            {
                _mockCurrentUserService.Setup(s => s.GetRequiredUserId()).Returns(userId);
                _mockCurrentUserService.Setup(s => s.IsInAnyRole(It.IsAny<string[]>()))
                    .Returns((string[] roles) => roles.Contains(role));
            }
            else
            {
                _mockCurrentUserService.Setup(s => s.GetRequiredUserId())
                    .Throws(new UnauthorizedAccessException("User is not authenticated."));
            }
        }

        [Fact]
        public async Task UTCID01_Handle_AdminUser_ShouldAddCommentSuccessfully()
        {
            // Arrange
            SetupCurrentUser(userId: 10, role: BPG.Domain.Constants.UserRole.Admin);

            var dailyLog = new DailyLog
            {
                LogId = 100,
                CreatedBy = 20,
                Task = new ProjectTask
                {
                    Name = "Building foundation",
                    Phase = new Phase { ProjectId = 5 }
                }
            };
            _mockDailyLogRepo.Setup(r => r.Query()).Returns(new List<DailyLog> { dailyLog }.AsQueryable().BuildMock());

            var authorUser = new User
            {
                UserId = 10,
                FullName = "Admin User",
                UserRoles = new List<BPG.Domain.Entities.UserRole>
                {
                    new BPG.Domain.Entities.UserRole { Role = new Role { RoleName = BPG.Domain.Constants.UserRole.Admin } }
                }
            };
            _mockUserRepo.Setup(r => r.Query()).Returns(new List<User> { authorUser }.AsQueryable().BuildMock());
            _mockCommentRepo.Setup(r => r.Query()).Returns(new List<Comment>().AsQueryable().BuildMock());

            var command = new AddCommentCommand { LogId = 100, Content = "Looks good!" };

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.Content.Should().Be("Looks good!");
            result.AuthorName.Should().Be("Admin User");
            result.AuthorRole.Should().Be(BPG.Domain.Constants.UserRole.Admin);

            _mockCommentRepo.Verify(r => r.AddAsync(It.Is<Comment>(c => c.Content == "Looks good!"), It.IsAny<CancellationToken>()), Times.Once);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
            _mockNotificationService.Verify(n => n.SendNotificationAsync(
                20,
                "Bình luận mới dưới nhật ký",
                It.Is<string>(s => s.Contains("Admin User") && s.Contains("Building foundation")),
                NotificationType.Progress,
                NotificationReferenceType.Task,
                dailyLog.TaskId,
                It.IsAny<CancellationToken>()
            ), Times.Once);
        }

        [Fact]
        public async Task UTCID02_Handle_TechnicalManagerUser_ShouldAddCommentSuccessfully()
        {
            // Arrange
            SetupCurrentUser(userId: 11, role: BPG.Domain.Constants.UserRole.TechnicalManager);

            var dailyLog = new DailyLog
            {
                LogId = 100,
                CreatedBy = 20,
                Task = new ProjectTask
                {
                    Name = "Brickwork",
                    Phase = new Phase { ProjectId = 5 }
                }
            };
            _mockDailyLogRepo.Setup(r => r.Query()).Returns(new List<DailyLog> { dailyLog }.AsQueryable().BuildMock());

            var authorUser = new User
            {
                UserId = 11,
                FullName = "TM User",
                UserRoles = new List<BPG.Domain.Entities.UserRole>
                {
                    new BPG.Domain.Entities.UserRole { Role = new Role { RoleName = BPG.Domain.Constants.UserRole.TechnicalManager } }
                }
            };
            _mockUserRepo.Setup(r => r.Query()).Returns(new List<User> { authorUser }.AsQueryable().BuildMock());
            _mockCommentRepo.Setup(r => r.Query()).Returns(new List<Comment>().AsQueryable().BuildMock());

            var command = new AddCommentCommand { LogId = 100, Content = "Great job!" };

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.AuthorRole.Should().Be(BPG.Domain.Constants.UserRole.TechnicalManager);
        }

        [Fact]
        public async Task UTCID03_Handle_ProjectMemberUser_ShouldAddCommentSuccessfully()
        {
            // Arrange
            SetupCurrentUser(userId: 12, role: BPG.Domain.Constants.UserRole.SiteEngineer); // Normal user

            var dailyLog = new DailyLog
            {
                LogId = 100,
                CreatedBy = 20,
                Task = new ProjectTask
                {
                    Name = "Plumbing",
                    Phase = new Phase { ProjectId = 5 }
                }
            };
            _mockDailyLogRepo.Setup(r => r.Query()).Returns(new List<DailyLog> { dailyLog }.AsQueryable().BuildMock());

            // Mock project member query
            var member = new ProjectMember { ProjectId = 5, UserId = 12 };
            _mockMemberRepo.Setup(r => r.Query()).Returns(new List<ProjectMember> { member }.AsQueryable().BuildMock());

            var authorUser = new User
            {
                UserId = 12,
                FullName = "SiteEngineer User",
                UserRoles = new List<BPG.Domain.Entities.UserRole>
                {
                    new BPG.Domain.Entities.UserRole { Role = new Role { RoleName = BPG.Domain.Constants.UserRole.SiteEngineer } }
                }
            };
            _mockUserRepo.Setup(r => r.Query()).Returns(new List<User> { authorUser }.AsQueryable().BuildMock());
            _mockCommentRepo.Setup(r => r.Query()).Returns(new List<Comment>().AsQueryable().BuildMock());

            var command = new AddCommentCommand { LogId = 100, Content = "Approved" };

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.AuthorName.Should().Be("SiteEngineer User");
        }

        [Fact]
        public async Task UTCID04_Handle_DailyLogNotFound_ShouldThrowNotFoundException()
        {
            // Arrange
            SetupCurrentUser(userId: 10, role: BPG.Domain.Constants.UserRole.Admin);
            _mockDailyLogRepo.Setup(r => r.Query()).Returns(new List<DailyLog>().AsQueryable().BuildMock());

            var command = new AddCommentCommand { LogId = 999, Content = "Content" };

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<NotFoundException>()
                .WithMessage("DailyLog với ID [999] không tồn tại.");
        }

        [Fact]
        public async Task UTCID05_Handle_NotMemberOrAdminTM_ShouldThrowForbiddenException()
        {
            // Arrange
            SetupCurrentUser(userId: 12, role: BPG.Domain.Constants.UserRole.SiteEngineer); // Normal user

            var dailyLog = new DailyLog
            {
                LogId = 100,
                CreatedBy = 20,
                Task = new ProjectTask
                {
                    Name = "Electrical",
                    Phase = new Phase { ProjectId = 5 }
                }
            };
            _mockDailyLogRepo.Setup(r => r.Query()).Returns(new List<DailyLog> { dailyLog }.AsQueryable().BuildMock());

            // Empty project members list
            _mockMemberRepo.Setup(r => r.Query()).Returns(new List<ProjectMember>().AsQueryable().BuildMock());

            var command = new AddCommentCommand { LogId = 100, Content = "Forbidden write" };

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<ForbiddenException>()
                .WithMessage("Bạn không phải thành viên của dự án này.");
        }

        [Fact]
        public async Task UTCID06_Handle_ContentBoundaryMaxLength_ShouldAddCommentSuccessfully()
        {
            // Arrange
            SetupCurrentUser(userId: 10, role: BPG.Domain.Constants.UserRole.Admin);

            var dailyLog = new DailyLog
            {
                LogId = 100,
                CreatedBy = 20,
                Task = new ProjectTask
                {
                    Name = "Building foundation",
                    Phase = new Phase { ProjectId = 5 }
                }
            };
            _mockDailyLogRepo.Setup(r => r.Query()).Returns(new List<DailyLog> { dailyLog }.AsQueryable().BuildMock());

            var authorUser = new User
            {
                UserId = 10,
                FullName = "Admin User",
                UserRoles = new List<BPG.Domain.Entities.UserRole>
                {
                    new BPG.Domain.Entities.UserRole { Role = new Role { RoleName = BPG.Domain.Constants.UserRole.Admin } }
                }
            };
            _mockUserRepo.Setup(r => r.Query()).Returns(new List<User> { authorUser }.AsQueryable().BuildMock());
            _mockCommentRepo.Setup(r => r.Query()).Returns(new List<Comment>().AsQueryable().BuildMock());

            var maxLengthContent = new string('A', 1000);
            var command = new AddCommentCommand { LogId = 100, Content = maxLengthContent };

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Content.Length.Should().Be(1000);
        }

        [Fact]
        public async Task UTCID07_Handle_OwnDailyLog_ShouldNotSendNotificationToCreator()
        {
            // Arrange
            SetupCurrentUser(userId: 20, role: BPG.Domain.Constants.UserRole.SiteEngineer); // Creator of log is current user

            var dailyLog = new DailyLog
            {
                LogId = 100,
                CreatedBy = 20, // matching currentUserId
                Task = new ProjectTask
                {
                    Name = "Plastering",
                    Phase = new Phase { ProjectId = 5 }
                }
            };
            _mockDailyLogRepo.Setup(r => r.Query()).Returns(new List<DailyLog> { dailyLog }.AsQueryable().BuildMock());

            var member = new ProjectMember { ProjectId = 5, UserId = 20 };
            _mockMemberRepo.Setup(r => r.Query()).Returns(new List<ProjectMember> { member }.AsQueryable().BuildMock());

            var authorUser = new User
            {
                UserId = 20,
                FullName = "Creator User",
                UserRoles = new List<BPG.Domain.Entities.UserRole>()
            };
            _mockUserRepo.Setup(r => r.Query()).Returns(new List<User> { authorUser }.AsQueryable().BuildMock());
            _mockCommentRepo.Setup(r => r.Query()).Returns(new List<Comment>().AsQueryable().BuildMock());

            var command = new AddCommentCommand { LogId = 100, Content = "Self comment" };

            // Act
            await _handler.Handle(command, CancellationToken.None);

            // Assert
            // Should not send notification to dailyLog.CreatedBy because dailyLog.CreatedBy == currentUserId
            _mockNotificationService.Verify(n => n.SendNotificationAsync(
                20,
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<long?>(),
                It.IsAny<CancellationToken>()
            ), Times.Never);
        }

        [Fact]
        public async Task UTCID08_Handle_OtherCommentersExist_ShouldSendNotificationToOtherCommenters()
        {
            // Arrange
            SetupCurrentUser(userId: 10, role: BPG.Domain.Constants.UserRole.Admin);

            var dailyLog = new DailyLog
            {
                LogId = 100,
                CreatedBy = 20, // Creator
                Task = new ProjectTask
                {
                    Name = "Scaffolding",
                    Phase = new Phase { ProjectId = 5 }
                }
            };
            _mockDailyLogRepo.Setup(r => r.Query()).Returns(new List<DailyLog> { dailyLog }.AsQueryable().BuildMock());

            var authorUser = new User
            {
                UserId = 10,
                FullName = "Admin User",
                UserRoles = new List<BPG.Domain.Entities.UserRole>()
            };
            _mockUserRepo.Setup(r => r.Query()).Returns(new List<User> { authorUser }.AsQueryable().BuildMock());

            // Mock existing comments from users 30 and 40
            var existingComments = new List<Comment>
            {
                new Comment { LogId = 100, AuthorId = 30, IsDeleted = false },
                new Comment { LogId = 100, AuthorId = 40, IsDeleted = false }
            };
            _mockCommentRepo.Setup(r => r.Query()).Returns(existingComments.AsQueryable().BuildMock());

            var command = new AddCommentCommand { LogId = 100, Content = "Follow up comment" };

            // Act
            await _handler.Handle(command, CancellationToken.None);

            // Assert
            // Notifies log creator (20)
            _mockNotificationService.Verify(n => n.SendNotificationAsync(
                20,
                "Bình luận mới dưới nhật ký",
                It.IsAny<string>(),
                NotificationType.Progress,
                NotificationReferenceType.Task,
                dailyLog.TaskId,
                It.IsAny<CancellationToken>()
            ), Times.Once);

            // Notifies other commenters (30 and 40)
            _mockNotificationService.Verify(n => n.SendNotificationAsync(
                30,
                "Hoạt động bình luận mới",
                It.IsAny<string>(),
                NotificationType.Progress,
                NotificationReferenceType.Task,
                dailyLog.TaskId,
                It.IsAny<CancellationToken>()
            ), Times.Once);

            _mockNotificationService.Verify(n => n.SendNotificationAsync(
                40,
                "Hoạt động bình luận mới",
                It.IsAny<string>(),
                NotificationType.Progress,
                NotificationReferenceType.Task,
                dailyLog.TaskId,
                It.IsAny<CancellationToken>()
            ), Times.Once);
        }

        [Fact]
        public async Task UTCID09_Handle_DuplicateCommenters_ShouldSendSingleNotificationPerUser()
        {
            // Arrange
            SetupCurrentUser(userId: 10, role: BPG.Domain.Constants.UserRole.Admin);

            var dailyLog = new DailyLog
            {
                LogId = 100,
                CreatedBy = 20,
                Task = new ProjectTask
                {
                    Name = "Scaffolding",
                    Phase = new Phase { ProjectId = 5 }
                }
            };
            _mockDailyLogRepo.Setup(r => r.Query()).Returns(new List<DailyLog> { dailyLog }.AsQueryable().BuildMock());

            var authorUser = new User
            {
                UserId = 10,
                FullName = "Admin User",
                UserRoles = new List<BPG.Domain.Entities.UserRole>()
            };
            _mockUserRepo.Setup(r => r.Query()).Returns(new List<User> { authorUser }.AsQueryable().BuildMock());

            // Mock multiple comments from user 30, and some from current user (10) and creator (20)
            var existingComments = new List<Comment>
            {
                new Comment { LogId = 100, AuthorId = 30, IsDeleted = false },
                new Comment { LogId = 100, AuthorId = 30, IsDeleted = false }, // Duplicate commenter 30
                new Comment { LogId = 100, AuthorId = 10, IsDeleted = false }, // Current user (should be excluded)
                new Comment { LogId = 100, AuthorId = 20, IsDeleted = false }, // Creator (should be excluded)
                new Comment { LogId = 100, AuthorId = 50, IsDeleted = true }   // Deleted comment (should be excluded)
            };
            _mockCommentRepo.Setup(r => r.Query()).Returns(existingComments.AsQueryable().BuildMock());

            var command = new AddCommentCommand { LogId = 100, Content = "Follow up comment" };

            // Act
            await _handler.Handle(command, CancellationToken.None);

            // Assert
            // Notifies other commenter 30 exactly ONCE due to Distinct()
            _mockNotificationService.Verify(n => n.SendNotificationAsync(
                30,
                "Hoạt động bình luận mới",
                It.IsAny<string>(),
                NotificationType.Progress,
                NotificationReferenceType.Task,
                dailyLog.TaskId,
                It.IsAny<CancellationToken>()
            ), Times.Once);

            // Does not notify creator with the "other commenter" template
            _mockNotificationService.Verify(n => n.SendNotificationAsync(
                20,
                "Hoạt động bình luận mới",
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<long?>(),
                It.IsAny<CancellationToken>()
            ), Times.Never);

            // Does not notify deleted comment user
            _mockNotificationService.Verify(n => n.SendNotificationAsync(
                50,
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<long?>(),
                It.IsAny<CancellationToken>()
            ), Times.Never);
        }

        [Fact]
        public async Task UTCID10_Handle_UserNotAuthenticated_ShouldThrowUnauthorizedAccessException()
        {
            // Arrange
            SetupCurrentUser(userId: 0, role: "", isAuthenticated: false);

            var command = new AddCommentCommand { LogId = 100, Content = "Content" };

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<UnauthorizedAccessException>()
                .WithMessage("User is not authenticated.");
        }
    }
}
