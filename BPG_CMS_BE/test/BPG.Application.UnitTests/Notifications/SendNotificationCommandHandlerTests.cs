using AutoMapper;
using BPG.Application.DTOs.Notifications;
using BPG.Application.Features.Notifications.Commands;
using BPG.Application.Features.Notifications.Handlers;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
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
        private readonly Mock<IRealtimeNotificationSender> _mockRealtimeSender;
        private readonly Mock<IMapper> _mockMapper;
        private readonly Mock<ILogger<SendNotificationCommandHandler>> _mockLogger;
        private readonly SendNotificationCommandHandler _handler;

        public SendNotificationCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockUserRepo = new Mock<IGenericRepository<User>>();
            _mockNotificationRepo = new Mock<IGenericRepository<Notification>>();
            _mockRealtimeSender = new Mock<IRealtimeNotificationSender>();
            _mockMapper = new Mock<IMapper>();
            _mockLogger = new Mock<ILogger<SendNotificationCommandHandler>>();

            // Setup repository behavior in UOW
            _mockUow.Setup(u => u.Repository<User>()).Returns(_mockUserRepo.Object);
            _mockUow.Setup(u => u.Repository<Notification>()).Returns(_mockNotificationRepo.Object);

            _handler = new SendNotificationCommandHandler(
                _mockUow.Object,
                _mockRealtimeSender.Object,
                _mockMapper.Object,
                _mockLogger.Object
            );
        }

        [Fact]
        public async Task Handle_SendToAll_ShouldNotifyAllActiveUsersAndSendBroadcast()
        {
            // ==========================================
            // ARRANGE
            // ==========================================
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
                .Returns(new Notification { Title = request.Title, Content = request.Content });

            _mockMapper.Setup(m => m.Map<NotificationDto>(It.IsAny<Notification>()))
                .Returns(new NotificationDto { NotificationId = 1, Title = request.Title });

            // ==========================================
            // ACT
            // ==========================================
            await _handler.Handle(request, CancellationToken.None);

            // ==========================================
            // ASSERT
            // ==========================================
            _mockNotificationRepo.Verify(r => r.AddRangeAsync(
                It.Is<IEnumerable<Notification>>(list => list.Count() == activeUsers.Count),
                It.IsAny<CancellationToken>()
            ), Times.Once);

            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);

            _mockRealtimeSender.Verify(s => s.SendNotificationToAllAsync(
                It.IsAny<NotificationDto>(),
                It.IsAny<CancellationToken>()
            ), Times.Once);
        }

        [Fact]
        public async Task Handle_SpecificUserId_ShouldNotifyOnlyThatUser()
        {
            // ==========================================
            // ARRANGE
            // ==========================================
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
                .Returns(new Notification { Title = request.Title, Content = request.Content });

            _mockMapper.Setup(m => m.Map<NotificationDto>(It.IsAny<Notification>()))
                .Returns(new NotificationDto { NotificationId = 1, Title = request.Title });

            // ==========================================
            // ACT
            // ==========================================
            await _handler.Handle(request, CancellationToken.None);

            // ==========================================
            // ASSERT
            // ==========================================
            _mockNotificationRepo.Verify(r => r.AddRangeAsync(
                It.Is<IEnumerable<Notification>>(list => list.Count() == 1 && list.First().UserId == targetUserId),
                It.IsAny<CancellationToken>()
            ), Times.Once);

            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);

            _mockRealtimeSender.Verify(s => s.SendNotificationToUserAsync(
                targetUserId.ToString(),
                It.IsAny<NotificationDto>(),
                It.IsAny<CancellationToken>()
            ), Times.Once);
        }

        [Fact]
        public async Task Handle_SpecificUserIdNotFound_ShouldReturnAndNotSave()
        {
            // ==========================================
            // ARRANGE
            // ==========================================
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

            // ==========================================
            // ACT
            // ==========================================
            await _handler.Handle(request, CancellationToken.None);

            // ==========================================
            // ASSERT
            // ==========================================

            _mockNotificationRepo.Verify(r => r.AddRangeAsync(
                It.IsAny<IEnumerable<Notification>>(),
                It.IsAny<CancellationToken>()
            ), Times.Never);

            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);

            _mockRealtimeSender.Verify(s => s.SendNotificationToUserAsync(
                It.IsAny<string>(),
                It.IsAny<NotificationDto>(),
                It.IsAny<CancellationToken>()
            ), Times.Never);
        }

        [Fact]
        public async Task Handle_SendToRoleName_ShouldNotifyOnlyUsersWithRoleAndSendRealtime()
        {
            // ==========================================
            // ARRANGE
            // ==========================================
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
                .Returns(new Notification { Title = request.Title, Content = request.Content });

            _mockMapper.Setup(m => m.Map<NotificationDto>(It.IsAny<Notification>()))
                .Returns(new NotificationDto { NotificationId = 1, Title = request.Title });

            // ==========================================
            // ACT
            // ==========================================
            await _handler.Handle(request, CancellationToken.None);

            // ==========================================
            // ASSERT
            // ==========================================
            // Only user 1 (Admin) should be saved/notified
            _mockNotificationRepo.Verify(r => r.AddRangeAsync(
                It.Is<IEnumerable<Notification>>(list => list.Count() == 1 && list.First().UserId == 1),
                It.IsAny<CancellationToken>()
            ), Times.Once);

            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);

            _mockRealtimeSender.Verify(s => s.SendNotificationToUserAsync(
                "1",
                It.IsAny<NotificationDto>(),
                It.IsAny<CancellationToken>()
            ), Times.Once);

            _mockRealtimeSender.Verify(s => s.SendNotificationToUserAsync(
                "2",
                It.IsAny<NotificationDto>(),
                It.IsAny<CancellationToken>()
            ), Times.Never);
        }
    }
}