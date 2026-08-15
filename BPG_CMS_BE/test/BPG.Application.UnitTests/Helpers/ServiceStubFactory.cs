using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
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

        public static IInventoryService InventoryService()
        {
            var mock = new Mock<IInventoryService>();
            mock.Setup(x => x.UpdateStockAsync(
                    It.IsAny<long>(),
                    It.IsAny<long>(),
                    It.IsAny<decimal>(),
                    It.IsAny<byte>(),
                    It.IsAny<long>(),
                    It.IsAny<string>(),
                    It.IsAny<long>(),
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync((
                    long projectId,
                    long materialId,
                    decimal quantityChange,
                    byte _,
                    long __,
                    string ___,
                    long ____,
                    CancellationToken _____) => new CurrentInventory
                    {
                        ProjectId = projectId,
                        MaterialId = materialId,
                        Quantity = quantityChange,
                        UnitId = 1
                    });

            return mock.Object;
        }

        public static ICurrentUserService CurrentUserService()
        {
            var mock = new Mock<ICurrentUserService>();
            mock.Setup(x => x.IsAuthenticated).Returns(true);
            mock.Setup(x => x.UserId).Returns(1);
            mock.Setup(x => x.GetRequiredUserId()).Returns(1);
            mock.Setup(x => x.IsInRole(It.IsAny<string>())).Returns(true);
            mock.Setup(x => x.IsInAnyRole(It.IsAny<string[]>())).Returns(true);
            return mock.Object;
        }

        public static IProjectAccessService ProjectAccessService()
        {
            var mock = new Mock<IProjectAccessService>();
            mock.Setup(x => x.GetAccessibleProjectIdsAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(new HashSet<long> { 1, 2, 3, 4, 5 });
            mock.Setup(x => x.IsCurrentUserProjectMemberAsync(It.IsAny<long>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);
            mock.Setup(x => x.IsCurrentUserProjectLeaderAsync(It.IsAny<long>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);
            return mock.Object;
        }
    }
}
