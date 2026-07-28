using AutoMapper;
using BPG.Application.DTOs.Notifications;
using BPG.Application.Features.Notifications.Commands;
using BPG.Application.Features.Notifications.Handlers;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Application.UnitTests.Helpers;
using BPG.Domain.Entities;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using MockQueryable;
using MockQueryable.Moq;
using Moq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Xunit;

namespace BPG.Application.UnitTests.Notifications
{
    public class SendNotificationCommandHandlerTests
    {
        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IGenericRepository<User>> _mockUserRepo;
        private readonly Mock<IGenericRepository<Notification>> _mockNotificationRepo;
        private readonly Mock<IMapper> _mockMapper;
        private readonly Mock<ILogger<SendNotificationCommandHandler>> _mockLogger;
        private readonly SendNotificationCommandHandler _handler;

        public SendNotificationCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockUserRepo = new Mock<IGenericRepository<User>>();
            _mockNotificationRepo = new Mock<IGenericRepository<Notification>>();
            _mockMapper = new Mock<IMapper>();
            _mockLogger = new Mock<ILogger<SendNotificationCommandHandler>>();

            // Setup repository behavior in UOW
            _mockUow.Setup(u => u.Repository<User>()).Returns(_mockUserRepo.Object);
            _mockUow.Setup(u => u.Repository<Notification>()).Returns(_mockNotificationRepo.Object);
            _mockUow.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
            _mockNotificationRepo.Setup(repository => repository.AddRangeAsync(It.IsAny<IEnumerable<Notification>>(), It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);

            _handler = new SendNotificationCommandHandler(
                _mockUow.Object,
                ServiceStubFactory.RealtimeSender(),
                _mockMapper.Object,
                _mockLogger.Object
            );
        }

        [Fact]
        public async Task UTCID01_Handle_SendToAllActiveUsers_ShouldComplete()
        {
            var activeUsers = new List<User>
            {
                new User { UserId = 1, IsActive = true, IsDeleted = false },
                new User { UserId = 2, IsActive = true, IsDeleted = false }
            };

            _mockUserRepo.Setup(r => r.Query())
                .Returns(activeUsers.AsQueryable().BuildMock());

            var request = new SendNotificationCommand(
                UserId: null,
                Title: "Chào mừng",
                Content: "Nội dung thông báo",
                NotificationType: "System",
                SendToAll: true,
                RoleName: null,
                ReferenceType: null,
                ReferenceId: null
            );

            _mockMapper.Setup(m => m.Map<Notification>(It.IsAny<SendNotificationCommand>()))
                .Returns((SendNotificationCommand source) => new Notification { Title = source.Title, Content = source.Content });

            _mockMapper.Setup(m => m.Map<NotificationDto>(It.IsAny<Notification>()))
                .Returns((Notification source) => new NotificationDto { NotificationId = source.NotificationId, UserId = source.UserId, Title = source.Title });

            Func<Task> act = async () => await _handler.Handle(request, CancellationToken.None);

            await act.Should().NotThrowAsync();
        }

        [Fact]
        public async Task UTCID02_Handle_SendToAllWithExcludedUser_ShouldComplete()
        {
            // Arrange
            var users = new List<User>
            {
                new User { UserId = 1, IsActive = true, IsDeleted = false },
                new User { UserId = 2, IsActive = true, IsDeleted = false }
            };

            _mockUserRepo.Setup(r => r.Query()).Returns(users.AsQueryable().BuildMock());

            var request = new SendNotificationCommand(
                UserId: null,
                Title: "Announcement",
                Content: "Content",
                NotificationType: "System",
                SendToAll: true,
                RoleName: null,
                ReferenceType: null,
                ReferenceId: null,
                ExcludeUserId: 1
            );

            _mockMapper.Setup(m => m.Map<Notification>(It.IsAny<SendNotificationCommand>()))
                .Returns((SendNotificationCommand source) => new Notification { Title = source.Title, Content = source.Content });
            _mockMapper.Setup(m => m.Map<NotificationDto>(It.IsAny<Notification>()))
                .Returns((Notification n) => new NotificationDto { NotificationId = n.NotificationId, UserId = n.UserId, Title = n.Title });

            Func<Task> act = async () => await _handler.Handle(request, CancellationToken.None);

            await act.Should().NotThrowAsync();
        }

        [Fact]
        public async Task UTCID03_Handle_SpecificActiveUser_ShouldComplete()
        {
            var targetUserId = 99L;
            var targetUser = new User { UserId = targetUserId, IsActive = true, IsDeleted = false };

            _mockUserRepo.Setup(r => r.GetByIdAsync(targetUserId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(targetUser);

            var request = new SendNotificationCommand(
                UserId: targetUserId,
                Title: "Thông báo riêng",
                Content: "Nội dung riêng",
                NotificationType: "Personal",
                SendToAll: false,
                RoleName: null,
                ReferenceType: null,
                ReferenceId: null
            );

            _mockMapper.Setup(m => m.Map<Notification>(It.IsAny<SendNotificationCommand>()))
                .Returns((SendNotificationCommand source) => new Notification { Title = source.Title, Content = source.Content });

            _mockMapper.Setup(m => m.Map<NotificationDto>(It.IsAny<Notification>()))
                .Returns((Notification source) => new NotificationDto { NotificationId = source.NotificationId, UserId = source.UserId, Title = source.Title });

            Func<Task> act = async () => await _handler.Handle(request, CancellationToken.None);

            await act.Should().NotThrowAsync();
        }

        [Fact]
        public async Task UTCID04_Handle_SpecificUserNotFound_ShouldComplete()
        {
            var nonExistentUserId = 999L;
            
            _mockUserRepo.Setup(r => r.GetByIdAsync(nonExistentUserId, It.IsAny<CancellationToken>()))
                .ReturnsAsync((User?)null);

            var request = new SendNotificationCommand(
                UserId: nonExistentUserId,
                Title: "Lỗi",
                Content: "Sẽ không ai nhận được",
                NotificationType: "Personal",
                SendToAll: false,
                RoleName: null,
                ReferenceType: null,
                ReferenceId: null
            );

            Func<Task> act = async () => await _handler.Handle(request, CancellationToken.None);

            await act.Should().NotThrowAsync();
        }

        [Fact]
        public async Task UTCID05_Handle_SendToRoleName_ShouldComplete()
        {
            var roleAdmin = new Role { RoleName = "Admin" };
            var roleSiteEng = new Role { RoleName = "SiteEngineer" };

            var users = new List<User>
            {
                new User 
                { 
                    UserId = 1, 
                    IsActive = true, 
                    IsDeleted = false, 
                    UserRoles = new List<BPG.Domain.Entities.UserRole> { new BPG.Domain.Entities.UserRole { Role = roleAdmin } } 
                },
                new User 
                { 
                    UserId = 2, 
                    IsActive = true, 
                    IsDeleted = false, 
                    UserRoles = new List<BPG.Domain.Entities.UserRole> { new BPG.Domain.Entities.UserRole { Role = roleSiteEng } } 
                }
            };

            _mockUserRepo.Setup(r => r.Query())
                .Returns(users.AsQueryable().BuildMock());

            var request = new SendNotificationCommand(
                UserId: null,
                Title: "Role Announcement",
                Content: "For Admins only",
                NotificationType: "System",
                SendToAll: false,
                RoleName: "Admin",
                ReferenceType: null,
                ReferenceId: null
            );

            _mockMapper.Setup(m => m.Map<Notification>(It.IsAny<SendNotificationCommand>()))
                .Returns((SendNotificationCommand source) => new Notification { Title = source.Title, Content = source.Content });

            _mockMapper.Setup(m => m.Map<NotificationDto>(It.IsAny<Notification>()))
                .Returns((Notification source) => new NotificationDto { NotificationId = source.NotificationId, UserId = source.UserId, Title = source.Title });

            Func<Task> act = async () => await _handler.Handle(request, CancellationToken.None);

            await act.Should().NotThrowAsync();
        }
    }
}

