using System;
using System.Linq;
using Moq;
using BPG.Application.IServices;

namespace BPG.Application.UnitTests.Helpers;

public static class MockCurrentUserServiceExtensions
{
    public static Mock<ICurrentUserService> SetupUser(this Mock<ICurrentUserService> mock, long userId)
    {
        mock.Setup(s => s.GetRequiredUserId()).Returns(userId);
        return mock;
    }

    public static Mock<ICurrentUserService> SetupUser(this Mock<ICurrentUserService> mock, long userId, string role, bool hasRole = true)
    {
        mock.Setup(s => s.GetRequiredUserId()).Returns(userId);
        mock.Setup(s => s.IsInAnyRole(It.IsAny<string[]>()))
            .Returns((string[] roles) => roles.Contains(role) && hasRole);
        return mock;
    }
}
