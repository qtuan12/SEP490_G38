using BPG.Application.Common.Authorization;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Application.UnitTests.Helpers;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using MockQueryable;
using Moq;
using RoleConstants = BPG.Domain.Constants.UserRole;

namespace BPG.Application.UnitTests.Authorization;

public class PermissionServiceTests
{
    private const long CurrentUserId = 10;

    private readonly Mock<ICurrentUserService> _currentUser = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();

    [Fact]
    public void GetSystemPermissions_WhenAnonymous_ShouldReturnEmptyList()
    {
        _currentUser.SetupAnonymous();
        var service = CreateService();

        var result = service.GetSystemPermissions();

        result.Should().BeEmpty();
    }

    [Fact]
    public void GetSystemPermissions_WhenAdmin_ShouldReturnAllSystemPermissions()
    {
        _currentUser.SetupUser(CurrentUserId, RoleConstants.Admin);
        var service = CreateService();

        var result = service.GetSystemPermissions();

        result.Should().BeEquivalentTo(PermissionCatalog.SystemPermissions);
    }

    [Fact]
    public async Task GetProjectPermissionsAsync_WhenAnonymous_ShouldThrowUnauthorizedException()
    {
        _currentUser.SetupAnonymous();
        var service = CreateService();

        var act = () => service.GetProjectPermissionsAsync(projectId: 1);

        await act.Should().ThrowAsync<UnauthorizedException>();
    }

    [Fact]
    public async Task GetProjectPermissionsAsync_WhenProjectMember_ShouldReturnViewOnly()
    {
        _currentUser.SetupUser(CurrentUserId, RoleConstants.SiteEngineer);
        SetupProjectMembers(new ProjectMember
        {
            ProjectId = 1,
            UserId = CurrentUserId,
            IsLeader = false
        });
        var service = CreateService();

        var result = await service.GetProjectPermissionsAsync(projectId: 1);

        result.Should().BeEquivalentTo([ProjectPermission.View]);
    }

    [Fact]
    public async Task GetProjectPermissionsAsync_WhenProjectLeader_ShouldReturnLeaderProjectPermissions()
    {
        _currentUser.SetupUser(CurrentUserId, RoleConstants.SiteEngineer);
        SetupProjectMembers(new ProjectMember
        {
            ProjectId = 1,
            UserId = CurrentUserId,
            IsLeader = true
        });
        var service = CreateService();

        var result = await service.GetProjectPermissionsAsync(projectId: 1);

        result.Should().BeEquivalentTo([
            ProjectPermission.View,
            ProjectPermission.ExecutionManage,
            ProjectPermission.InventoryManage
        ]);
    }

    [Fact]
    public async Task GetProjectPermissionsAsync_WhenTechnicalManagerWithoutMembership_ShouldReturnGlobalProjectPermissions()
    {
        _currentUser.SetupUser(CurrentUserId, RoleConstants.TechnicalManager);
        SetupProjectMembers();
        var service = CreateService();

        var result = await service.GetProjectPermissionsAsync(projectId: 1);

        result.Should().BeEquivalentTo([
            ProjectPermission.View,
            ProjectPermission.ExecutionManage,
            ProjectPermission.TechnicalManage,
            ProjectPermission.InventoryManage,
            ProjectPermission.ReportsView
        ]);
    }

    [Fact]
    public async Task GetProjectIdsWithPermissionAsync_ShouldFilterByRoleAndMembership()
    {
        _currentUser.SetupUser(CurrentUserId, RoleConstants.SiteEngineer);
        SetupProjects(
            new Project { ProjectId = 1 },
            new Project { ProjectId = 2 },
            new Project { ProjectId = 3 });
        SetupProjectMembers(
            new ProjectMember { ProjectId = 1, UserId = CurrentUserId, IsLeader = false },
            new ProjectMember { ProjectId = 2, UserId = CurrentUserId, IsLeader = true });
        var service = CreateService();

        var viewableProjects = await service.GetProjectIdsWithPermissionAsync(ProjectPermission.View);
        var executableProjects = await service.GetProjectIdsWithPermissionAsync(ProjectPermission.ExecutionManage);

        viewableProjects.Should().BeEquivalentTo([1L, 2L]);
        executableProjects.Should().BeEquivalentTo([2L]);
    }

    [Fact]
    public async Task GetProjectIdsWithPermissionAsync_WhenAdmin_ShouldReturnAllProjects()
    {
        _currentUser.SetupUser(CurrentUserId, RoleConstants.Admin);
        SetupProjects(
            new Project { ProjectId = 1 },
            new Project { ProjectId = 2 },
            new Project { ProjectId = 3 });
        var service = CreateService();

        var result = await service.GetProjectIdsWithPermissionAsync(ProjectPermission.ReportsView);

        result.Should().BeEquivalentTo([1L, 2L, 3L]);
    }

    private PermissionService CreateService() =>
        new(_currentUser.Object, _unitOfWork.Object);

    private void SetupProjects(params Project[] projects)
    {
        var repository = Repository(projects);
        _unitOfWork.Setup(item => item.Repository<Project>()).Returns(repository.Object);
    }

    private void SetupProjectMembers(params ProjectMember[] members)
    {
        var repository = Repository(members);
        _unitOfWork.Setup(item => item.Repository<ProjectMember>()).Returns(repository.Object);
    }

    private static Mock<IGenericRepository<T>> Repository<T>(params T[] items)
        where T : class
    {
        var repository = new Mock<IGenericRepository<T>>();
        repository.Setup(item => item.Query()).Returns(items.AsQueryable().BuildMock());
        return repository;
    }
}
