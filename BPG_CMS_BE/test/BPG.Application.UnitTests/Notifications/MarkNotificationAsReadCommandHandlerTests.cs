using BPG.Application.Features.Notifications.Commands;
using BPG.Application.Features.Notifications.Handlers;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using Moq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Threading;
using System.Threading.Tasks;
using Xunit;
using BPG.Application.UnitTests.Helpers;

namespace BPG.Application.UnitTests.Notifications
{
    public class MarkNotificationAsReadCommandHandlerTests
    {
        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IGenericRepository<Notification>> _mockNotiRepo;
        private readonly MarkNotificationAsReadCommandHandler _handler;

        public MarkNotificationAsReadCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockNotiRepo = new Mock<IGenericRepository<Notification>>();

            _mockUow.Setup(u => u.Repository<Notification>()).Returns(_mockNotiRepo.Object);

            _handler = new MarkNotificationAsReadCommandHandler(_mockUow.Object);
        }



        [Fact]
        public async Task UTCID01_Handle_MarkAll_UserHasUnread_ShouldMarkAllAsRead()
        {
            // Arrange
            var notifications = new List<Notification>
            {
                new Notification { NotificationId = 1, UserId = 10, IsRead = false },
                new Notification { NotificationId = 2, UserId = 10, IsRead = false },
                new Notification { NotificationId = 3, UserId = 10, IsRead = true }, // already read
                new Notification { NotificationId = 4, UserId = 20, IsRead = false }  // other user
            };
            _mockNotiRepo.SetupMockData(notifications);

            var command = new MarkNotificationAsReadCommand(UserId: 10, MarkAll: true);

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().BeTrue();
            notifications.Where(n => n.UserId == 10).All(n => n.IsRead).Should().BeTrue();
            notifications.First(n => n.NotificationId == 4).IsRead.Should().BeFalse(); // other user untouched

            _mockNotiRepo.Verify(r => r.Update(It.IsAny<Notification>()), Times.Exactly(2));
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID02_Handle_MarkAll_UserHasNoUnread_ShouldDoNothingAndReturnTrue()
        {
            // Arrange
            var notifications = new List<Notification>
            {
                new Notification { NotificationId = 1, UserId = 10, IsRead = true }
            };
            _mockNotiRepo.SetupMockData(notifications);

            var command = new MarkNotificationAsReadCommand(UserId: 10, MarkAll: true);

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().BeTrue();
            _mockNotiRepo.Verify(r => r.Update(It.IsAny<Notification>()), Times.Never);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task UTCID03_Handle_SpecificNotificationUnread_ShouldMarkAsRead()
        {
            // Arrange
            var notification = new Notification { NotificationId = 123, UserId = 10, IsRead = false };
            var notifications = new List<Notification> { notification };
            _mockNotiRepo.SetupMockData(notifications);

            var command = new MarkNotificationAsReadCommand(UserId: 10, NotificationId: 123);

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().BeTrue();
            notification.IsRead.Should().BeTrue();
            notification.ReadAt.Should().NotBeNull();

            _mockNotiRepo.Verify(r => r.Update(notification), Times.Once);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID04_Handle_SpecificNotificationAlreadyRead_ShouldDoNothingAndReturnTrue()
        {
            // Arrange
            var notification = new Notification { NotificationId = 123, UserId = 10, IsRead = true };
            var notifications = new List<Notification> { notification };
            _mockNotiRepo.SetupMockData(notifications);

            var command = new MarkNotificationAsReadCommand(UserId: 10, NotificationId: 123);

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().BeTrue();
            _mockNotiRepo.Verify(r => r.Update(It.IsAny<Notification>()), Times.Never);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task UTCID05_Handle_SpecificNotificationNotFound_ShouldThrowNotFoundException()
        {
            // Arrange
            var notifications = new List<Notification>
            {
                new Notification { NotificationId = 123, UserId = 20, IsRead = false } // other user's notification
            };
            _mockNotiRepo.SetupMockData(notifications);

            var command = new MarkNotificationAsReadCommand(UserId: 10, NotificationId: 123);

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<NotFoundException>()
                .WithMessage("Notification với ID [123] không tồn tại.");

            _mockNotiRepo.Verify(r => r.Update(It.IsAny<Notification>()), Times.Never);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task UTCID06_Handle_NoActionRequested_ShouldReturnFalse()
        {
            // Arrange
            var command = new MarkNotificationAsReadCommand(UserId: 10, NotificationId: null, MarkAll: false);

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().BeFalse();
            _mockNotiRepo.Verify(r => r.Update(It.IsAny<Notification>()), Times.Never);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task UTCID07_Handle_BothMarkAllAndNotificationIdProvided_ShouldPrioritizeMarkAll()
        {
            // Arrange
            var notifications = new List<Notification>
            {
                new Notification { NotificationId = 1, UserId = 10, IsRead = false },
                new Notification { NotificationId = 2, UserId = 10, IsRead = false }
            };
            _mockNotiRepo.SetupMockData(notifications);

            var command = new MarkNotificationAsReadCommand(UserId: 10, NotificationId: 1, MarkAll: true);

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().BeTrue();
            notifications.All(n => n.IsRead).Should().BeTrue(); // All notifications marked read, not just ID 1

            _mockNotiRepo.Verify(r => r.Update(It.IsAny<Notification>()), Times.Exactly(2));
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }
    }
}
