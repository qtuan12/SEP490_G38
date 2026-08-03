using BPG.Application.Common.Models;
using BPG.Application.Features.Surplus.Commands;
using BPG.Application.Features.Surplus.Handlers;
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

namespace BPG.Application.UnitTests.Surplus
{
    public class CreateSurplusRequestCommandHandlerTests
    {
        private const long CurrentUserId = 10;
        private const long ProjectId = 5;
        private const long MaterialId1 = 50;
        private const long MaterialId2 = 51;
        private const int UnitId = 1;

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly Mock<IGenericRepository<Project>> _mockProjectRepo;
        private readonly Mock<IGenericRepository<ProjectMember>> _mockMemberRepo;
        private readonly Mock<IGenericRepository<SurplusRequest>> _mockSurplusRequestRepo;
        private readonly Mock<IGenericRepository<CurrentInventory>> _mockInventoryRepo;
        private readonly Mock<IGenericRepository<User>> _mockUserRepo;
        private readonly CreateSurplusRequestCommandHandler _handler;

        public CreateSurplusRequestCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();
            _mockProjectRepo = new Mock<IGenericRepository<Project>>();
            _mockMemberRepo = new Mock<IGenericRepository<ProjectMember>>();
            _mockSurplusRequestRepo = new Mock<IGenericRepository<SurplusRequest>>();
            _mockInventoryRepo = new Mock<IGenericRepository<CurrentInventory>>();
            _mockUserRepo = new Mock<IGenericRepository<User>>();

            _mockUow.Setup(u => u.Repository<Project>()).Returns(_mockProjectRepo.Object);
            _mockUow.Setup(u => u.Repository<ProjectMember>()).Returns(_mockMemberRepo.Object);
            _mockUow.Setup(u => u.Repository<SurplusRequest>()).Returns(_mockSurplusRequestRepo.Object);
            _mockUow.Setup(u => u.Repository<CurrentInventory>()).Returns(_mockInventoryRepo.Object);
            _mockUow.Setup(u => u.Repository<User>()).Returns(_mockUserRepo.Object);
            _mockUow.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

            SetupProjects(DefaultProject());
            SetupProjectMembers(new ProjectMember { ProjectId = ProjectId, UserId = CurrentUserId, IsLeader = true });
            SetupSurplusRequests();
            SetupInventories(
                new CurrentInventory { ProjectId = ProjectId, MaterialId = MaterialId1, UnitId = UnitId, Quantity = 10 },
                new CurrentInventory { ProjectId = ProjectId, MaterialId = MaterialId2, UnitId = UnitId, Quantity = 5 });
            SetupUser();

            _handler = new CreateSurplusRequestCommandHandler(
                _mockUow.Object,
                _mockCurrentUserService.Object,
                ServiceStubFactory.NotificationService(),
                ServiceStubFactory.RealtimeSender());
        }

        [Fact]
        public async Task UTCID01_Handle_ValidRequest_ShouldReturnSuccess()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.SiteEngineer);

            var result = await _handler.Handle(Command(), CancellationToken.None);

            result.Success.Should().BeTrue();
            _mockSurplusRequestRepo.Verify(r => r.AddAsync(
                It.Is<SurplusRequest>(sr => 
                    sr.ProjectId == ProjectId && 
                    sr.Status == SurplusRequestStatus.Processing && 
                    sr.Items.Count == 2), 
                It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UTCID02_Handle_ProjectNotFound_ShouldThrowNotFoundException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.SiteEngineer);
            SetupProjects();

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<NotFoundException>();
            exception.Which.ErrorCode.Should().Be("BIZ_001");
        }

        [Fact]
        public async Task UTCID03_Handle_ProjectNotInProgress_ShouldThrowBusinessException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.SiteEngineer);
            SetupProjects(DefaultProject(status: ProjectStatus.Completed));

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("BIZ_005");
        }

        [Fact]
        public async Task UTCID04_Handle_ActiveBatchExists_ShouldThrowBusinessException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.SiteEngineer);
            SetupSurplusRequests(new SurplusRequest { ProjectId = ProjectId, Status = SurplusRequestStatus.Processing });

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("VAL_002");
        }

        [Fact]
        public async Task UTCID05_Handle_NoInventoryGreaterThanZero_ShouldThrowBusinessException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.SiteEngineer);
            SetupInventories();

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("BIZ_001");
        }

        // ==================== Factory Methods ====================

        private static CreateSurplusRequestCommand Command(long projectId = ProjectId)
            => new(projectId, "Dọn dẹp công trường cuối dự án");

        private static Project DefaultProject(string status = ProjectStatus.InProgress)
            => new()
            {
                ProjectId = ProjectId,
                Name = "Test Project",
                Status = status
            };

        // ==================== Setup Methods ====================

        private void SetupProjects(params Project[] projects)
        {
            _mockProjectRepo.Setup(r => r.Query()).Returns(projects.AsQueryable().BuildMock());
        }

        private void SetupProjectMembers(params ProjectMember[] members)
        {
            _mockMemberRepo.Setup(r => r.Query()).Returns(members.AsQueryable().BuildMock());
        }

        private void SetupSurplusRequests(params SurplusRequest[] requests)
        {
            _mockSurplusRequestRepo.Setup(r => r.Query()).Returns(requests.AsQueryable().BuildMock());
        }

        private void SetupInventories(params CurrentInventory[] inventories)
        {
            _mockInventoryRepo.Setup(r => r.Query()).Returns(inventories.AsQueryable().BuildMock());
        }

        private void SetupUser()
        {
            var user = new User { UserId = CurrentUserId, FullName = "Current User", UserRoles = new List<BPG.Domain.Entities.UserRole>() };
            _mockUserRepo.Setup(r => r.Query()).Returns(new List<User> { user }.AsQueryable().BuildMock());
        }
    }
}
