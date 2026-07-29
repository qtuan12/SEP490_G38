using BPG.Application.Common.Authorization;
using BPG.Application.Common.Behaviors;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Exceptions;
using FluentAssertions;
using MediatR;
using Moq;

namespace BPG.Application.UnitTests.Authorization;

public class ProjectAuthorizationBehaviorTests
{
    private const long ProjectId = 10;

    private readonly Mock<ICurrentUserService> _currentUser = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly Mock<IPermissionService> _permissions = new();
    private readonly Mock<IProjectResourceResolver> _resolver = new();

    [Fact]
    public async Task Handle_ProjectRequestWithoutAuthenticatedUser_ShouldThrowUnauthorizedException()
    {
        var behavior = CreateBehavior();
        _resolver
            .Setup(item => item.ResolveProjectIdAsync(It.IsAny<ProjectResource>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(ProjectId);
        _currentUser.SetupGet(item => item.UserId).Returns((long?)null);

        var act = () => behavior.Handle(Request(), Next(), CancellationToken.None);

        await act.Should().ThrowAsync<UnauthorizedException>();
    }

    [Fact]
    public async Task Handle_ProjectRequestWithoutPermission_ShouldThrowForbiddenException()
    {
        var behavior = CreateBehavior();
        _resolver
            .Setup(item => item.ResolveProjectIdAsync(It.IsAny<ProjectResource>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(ProjectId);
        _currentUser.SetupGet(item => item.UserId).Returns(99);
        _permissions
            .Setup(item => item.HasProjectPermissionAsync(ProjectId, ProjectPermission.ExecutionManage, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var act = () => behavior.Handle(Request(), Next(), CancellationToken.None);

        await act.Should().ThrowAsync<ForbiddenException>();
    }

    [Fact]
    public async Task Handle_ProjectRequestWithPermission_ShouldCallNext()
    {
        var behavior = CreateBehavior();
        _resolver
            .Setup(item => item.ResolveProjectIdAsync(It.IsAny<ProjectResource>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(ProjectId);
        _currentUser.SetupGet(item => item.UserId).Returns(99);
        _permissions
            .Setup(item => item.HasProjectPermissionAsync(ProjectId, ProjectPermission.ExecutionManage, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var result = await behavior.Handle(Request(), Next("handled"), CancellationToken.None);

        result.Should().Be("handled");
    }

    private ProjectAuthorizationBehavior<TestProjectCommand, string> CreateBehavior() =>
        new(
            _currentUser.Object,
            _unitOfWork.Object,
            _permissions.Object,
            _resolver.Object);

    private static TestProjectCommand Request() => new();

    private static RequestHandlerDelegate<string> Next(string result = "ok") =>
        _ => Task.FromResult(result);

    private sealed record TestProjectCommand : IRequest<string>, IProjectResourceRequirement
    {
        public ProjectResource ProjectResource => ProjectResource.Project(ProjectId);
        public string RequiredPermission => ProjectPermission.ExecutionManage;
    }
}
