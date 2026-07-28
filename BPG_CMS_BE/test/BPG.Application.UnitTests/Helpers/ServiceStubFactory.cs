using BPG.Application.IServices;
using Moq;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.UnitTests.Helpers
{
    public static class ServiceStubFactory
    {
        public static IRealtimeNotificationSender RealtimeSender()
        {
            var mock = new Mock<IRealtimeNotificationSender>();
            mock.Setup(x => x.SendToGroupAsync(
                    It.IsAny<string>(),
                    It.IsAny<string>(),
                    It.IsAny<object>(),
                    It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);
            mock.Setup(x => x.SendNotificationToUserAsync(
                    It.IsAny<string>(),
                    It.IsAny<object>(),
                    It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);
            mock.Setup(x => x.SendNotificationToAllAsync(
                    It.IsAny<object>(),
                    It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);

            return mock.Object;
        }

        public static INotificationService NotificationService()
        {
            var mock = new Mock<INotificationService>();
            mock.Setup(x => x.SendNotificationAsync(
                    It.IsAny<long>(),
                    It.IsAny<string>(),
                    It.IsAny<string>(),
                    It.IsAny<string>(),
                    It.IsAny<string?>(),
                    It.IsAny<long?>(),
                    It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);
            mock.Setup(x => x.SendNotificationToAllAsync(
                    It.IsAny<string>(),
                    It.IsAny<string>(),
                    It.IsAny<string>(),
                    It.IsAny<string?>(),
                    It.IsAny<long?>(),
                    It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);
            mock.Setup(x => x.SendNotificationToRoleAsync(
                    It.IsAny<string>(),
                    It.IsAny<string>(),
                    It.IsAny<string>(),
                    It.IsAny<string>(),
                    It.IsAny<string?>(),
                    It.IsAny<long?>(),
                    It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);
            mock.Setup(x => x.SendNotificationToRoleAsync(
                    It.IsAny<string>(),
                    It.IsAny<string>(),
                    It.IsAny<string>(),
                    It.IsAny<string>(),
                    It.IsAny<long>(),
                    It.IsAny<string?>(),
                    It.IsAny<long?>(),
                    It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);

            return mock.Object;
        }

        public static IProgressRollupService ProgressRollupService()
        {
            var mock = new Mock<IProgressRollupService>();
            mock.Setup(x => x.RecalculateParentTaskProgressAsync(
                    It.IsAny<long>(),
                    It.IsAny<long?>(),
                    It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);

            return mock.Object;
        }
    }
}
