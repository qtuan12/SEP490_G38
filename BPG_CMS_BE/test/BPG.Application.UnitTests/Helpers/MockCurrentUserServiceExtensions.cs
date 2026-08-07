using System;
using System.Collections.Generic;
using System.Linq;
using Moq;
using BPG.Application.IServices;

namespace BPG.Application.UnitTests.Helpers;

public static class MockCurrentUserServiceExtensions
{
    public static Mock<ICurrentUserService> SetupUser(this Mock<ICurrentUserService> mock, long userId)
    {
        mock.SetupGet(s => s.UserId).Returns(userId);
        mock.SetupGet(s => s.IsAuthenticated).Returns(true);
        mock.SetupGet(s => s.Roles).Returns(Array.Empty<string>());
        mock.Setup(s => s.GetRequiredUserId()).Returns(userId);
        mock.Setup(s => s.IsInRole(It.IsAny<string>())).Returns(false);
        mock.Setup(s => s.IsInAnyRole(It.IsAny<string[]>())).Returns(false);
        return mock;
    }

    public static Mock<ICurrentUserService> SetupUser(this Mock<ICurrentUserService> mock, long userId, string role, bool hasRole = true)
    {
        var roles = hasRole
            ? new[] { role }
            : Array.Empty<string>();

        mock.SetupGet(s => s.UserId).Returns(userId);
        mock.SetupGet(s => s.IsAuthenticated).Returns(true);
        mock.SetupGet(s => s.Roles).Returns(roles);
        mock.Setup(s => s.GetRequiredUserId()).Returns(userId);
        mock.Setup(s => s.IsInRole(It.IsAny<string>()))
            .Returns((string candidate) =>
                hasRole && string.Equals(candidate, role, StringComparison.OrdinalIgnoreCase));
        mock.Setup(s => s.IsInAnyRole(It.IsAny<string[]>()))
            .Returns((string[] candidates) =>
                hasRole && candidates.Contains(role, StringComparer.OrdinalIgnoreCase));
        return mock;
    }

    public static Mock<ICurrentUserService> SetupUser(this Mock<ICurrentUserService> mock, long userId, params string[] roles)
    {
        IReadOnlyList<string> roleList = roles;

        mock.SetupGet(s => s.UserId).Returns(userId);
        mock.SetupGet(s => s.IsAuthenticated).Returns(true);
        mock.SetupGet(s => s.Roles).Returns(roleList);
        mock.Setup(s => s.GetRequiredUserId()).Returns(userId);
        mock.Setup(s => s.IsInRole(It.IsAny<string>()))
            .Returns((string candidate) => roleList.Contains(candidate, StringComparer.OrdinalIgnoreCase));
        mock.Setup(s => s.IsInAnyRole(It.IsAny<string[]>()))
            .Returns((string[] candidates) =>
                candidates.Any(candidate => roleList.Contains(candidate, StringComparer.OrdinalIgnoreCase)));
        return mock;
    }

    public static Mock<ICurrentUserService> SetupAnonymous(this Mock<ICurrentUserService> mock)
    {
        mock.SetupGet(s => s.UserId).Returns((long?)null);
        mock.SetupGet(s => s.IsAuthenticated).Returns(false);
        mock.SetupGet(s => s.Roles).Returns(Array.Empty<string>());
        mock.Setup(s => s.IsInRole(It.IsAny<string>())).Returns(false);
        mock.Setup(s => s.IsInAnyRole(It.IsAny<string[]>())).Returns(false);
        return mock;
    }
}
