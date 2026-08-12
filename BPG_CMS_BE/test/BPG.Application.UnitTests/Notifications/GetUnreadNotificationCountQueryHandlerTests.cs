using BPG.Application.Features.Notifications.Handlers;
using BPG.Application.Features.Notifications.Queries;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Entities;
using FluentAssertions;
using MockQueryable;
using MockQueryable.Moq;
using Moq;

namespace BPG.Application.UnitTests.Notifications;

public class GetUnreadNotificationCountQueryHandlerTests
{
    [Fact]
    public async Task Handle_ShouldCountAllUnreadNotificationsForCurrentUser()
    {
        var uow = new Mock<IUnitOfWork>();
        var repository = new Mock<IGenericRepository<Notification>>();
        var currentUser = new Mock<ICurrentUserService>();
        currentUser.Setup(service => service.GetRequiredUserId()).Returns(10);
        repository.Setup(repo => repo.Query()).Returns(new List<Notification>
        {
            new() { NotificationId = 1, UserId = 10, IsRead = false },
            new() { NotificationId = 2, UserId = 10, IsRead = false },
            new() { NotificationId = 3, UserId = 10, IsRead = true },
            new() { NotificationId = 4, UserId = 20, IsRead = false }
        }.AsQueryable().BuildMock());
        uow.Setup(unit => unit.Repository<Notification>()).Returns(repository.Object);

        var handler = new GetUnreadNotificationCountQueryHandler(uow.Object, currentUser.Object);

        var result = await handler.Handle(new GetUnreadNotificationCountQuery(), CancellationToken.None);

        result.Should().Be(2);
    }
}
