using AutoMapper;
using BPG.Application.Common.Mappings;
using BPG.Application.DTOs.Notifications;
using BPG.Application.Features.Notifications.Handlers;
using BPG.Application.Features.Notifications.Queries;
using BPG.Application.IServices;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
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

namespace BPG.Application.UnitTests.Notifications
{
    public class GetMyNotificationsQueryHandlerTests
    {
        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IGenericRepository<Notification>> _mockNotiRepo;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly IMapper _mapper;
        private readonly GetMyNotificationsQueryHandler _handler;

        public GetMyNotificationsQueryHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockNotiRepo = new Mock<IGenericRepository<Notification>>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();

            var mapperConfig = new MapperConfiguration(cfg =>
            {
                cfg.AddProfile<MappingProfile>();
            });
            _mapper = mapperConfig.CreateMapper();

            _mockUow.Setup(u => u.Repository<Notification>()).Returns(_mockNotiRepo.Object);

            _handler = new GetMyNotificationsQueryHandler(_mockUow.Object, _mapper, _mockCurrentUserService.Object);
        }

        private List<Notification> GetSampleNotifications()
        {
            return new List<Notification>
            {
                new Notification { NotificationId = 1, UserId = 10, Title = "Title 1", Content = "Msg 1", IsRead = false, CreatedAt = DateTime.UtcNow.AddMinutes(-5) },
                new Notification { NotificationId = 2, UserId = 10, Title = "Title 2", Content = "Msg 2", IsRead = true, CreatedAt = DateTime.UtcNow.AddMinutes(-10) },
                new Notification { NotificationId = 3, UserId = 20, Title = "Title 3", Content = "Msg 3", IsRead = false, CreatedAt = DateTime.UtcNow.AddMinutes(-2) }, // other user
                new Notification { NotificationId = 4, UserId = 10, Title = "Title 4", Content = "Msg 4", IsRead = false, CreatedAt = DateTime.UtcNow } // newest
            };
        }

        [Fact]
        public async Task UTCID01_Handle_ValidUser_ShouldReturnMyNotifications()
        {
            // Arrange
            _mockCurrentUserService.Setup(s => s.GetRequiredUserId()).Returns(10);

            var notifications = GetSampleNotifications();
            _mockNotiRepo.Setup(r => r.Query()).Returns(notifications.BuildMock());

            var query = new GetMyNotificationsQuery
            {
                PageNumber = 1,
                PageSize = 10
            };

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.Items.Should().HaveCount(3);
            result.TotalCount.Should().Be(3);
            result.Items.All(n => n.UserId == 10).Should().BeTrue();
        }

        [Fact]
        public async Task UTCID02_Handle_UserHasNoNotifications_ShouldReturnEmptyPagedList()
        {
            // Arrange
            _mockCurrentUserService.Setup(s => s.GetRequiredUserId()).Returns(99);

            var notifications = GetSampleNotifications();
            _mockNotiRepo.Setup(r => r.Query()).Returns(notifications.BuildMock());

            var query = new GetMyNotificationsQuery
            {
                PageNumber = 1,
                PageSize = 10
            };

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.Items.Should().BeEmpty();
            result.TotalCount.Should().Be(0);
        }

        [Fact]
        public async Task UTCID03_Handle_ShouldExcludeOtherUsersNotifications()
        {
            // Arrange
            _mockCurrentUserService.Setup(s => s.GetRequiredUserId()).Returns(20);

            var notifications = GetSampleNotifications();
            _mockNotiRepo.Setup(r => r.Query()).Returns(notifications.BuildMock());

            var query = new GetMyNotificationsQuery
            {
                PageNumber = 1,
                PageSize = 10
            };

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Items.Should().HaveCount(1);
            result.Items.First().NotificationId.Should().Be(3);
            result.TotalCount.Should().Be(1);
        }

        [Fact]
        public async Task UTCID04_Handle_ShouldReturnNewestFirst()
        {
            // Arrange
            _mockCurrentUserService.Setup(s => s.GetRequiredUserId()).Returns(10);

            var notifications = GetSampleNotifications();
            _mockNotiRepo.Setup(r => r.Query()).Returns(notifications.BuildMock());

            var query = new GetMyNotificationsQuery
            {
                PageNumber = 1,
                PageSize = 10
            };

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Items.Select(n => n.NotificationId).Should().ContainInOrder(4, 1, 2);
        }

        [Fact]
        public async Task UTCID05_Handle_PagedRequest_ShouldReturnPaginatedNotifications()
        {
            // Arrange
            _mockCurrentUserService.Setup(s => s.GetRequiredUserId()).Returns(10);

            var notifications = GetSampleNotifications();
            _mockNotiRepo.Setup(r => r.Query()).Returns(notifications.BuildMock());

            var query = new GetMyNotificationsQuery
            {
                PageNumber = 2,
                PageSize = 2
            };

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Items.Should().HaveCount(1);
            result.Items.First().NotificationId.Should().Be(2); // The oldest item among my 3 notifications (sorted: 4, 1, 2)
            result.TotalCount.Should().Be(3);
            result.PageNumber.Should().Be(2);
            result.PageSize.Should().Be(2);
        }

        [Fact]
        public async Task UTCID06_Handle_UnauthenticatedUser_ShouldThrowException()
        {
            // Arrange
            _mockCurrentUserService.Setup(s => s.GetRequiredUserId())
                .Throws(new UnauthorizedAccessException("User is not authenticated."));

            var query = new GetMyNotificationsQuery
            {
                PageNumber = 1,
                PageSize = 10
            };

            // Act
            Func<Task> act = async () => await _handler.Handle(query, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<UnauthorizedAccessException>()
                .WithMessage("User is not authenticated.");
        }

        [Fact]
        public async Task UTCID07_Handle_PaginationFallback_ShouldClampInvalidPageNumberAndSize()
        {
            // Arrange
            _mockCurrentUserService.Setup(s => s.GetRequiredUserId()).Returns(10);

            var notifications = GetSampleNotifications();
            _mockNotiRepo.Setup(r => r.Query()).Returns(notifications.BuildMock());

            var query = new GetMyNotificationsQuery
            {
                PageNumber = 0,
                PageSize = -10
            };

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.PageNumber.Should().Be(1);
            result.PageSize.Should().Be(20);
        }
    }
}
