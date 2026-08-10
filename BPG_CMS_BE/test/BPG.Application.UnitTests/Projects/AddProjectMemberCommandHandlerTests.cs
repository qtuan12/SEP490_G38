using AutoMapper;
using BPG.Application.Features.Projects.Handlers;
using BPG.Application.Features.Projects.Commands;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Application.UnitTests.Helpers;
using RoleConstants = BPG.Domain.Constants.UserRole;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using Moq;

namespace BPG.Application.UnitTests.Projects
{
    public class AddProjectMemberCommandHandlerTests
    {
        private const long CurrentUserId = 1;
        private const long ProjectId = 100;
        private const long TargetUserId = 20;

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly Mock<IMapper> _mockMapper;
        private readonly Mock<IGenericRepository<Project>> _mockProjectRepo;
        private readonly Mock<IGenericRepository<ProjectMember>> _mockMemberRepo;
        private readonly Mock<IGenericRepository<User>> _mockUserRepo;
        private readonly AddProjectMemberCommandHandler _handler;

        public AddProjectMemberCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();
            _mockMapper = new Mock<IMapper>();
            _mockProjectRepo = new Mock<IGenericRepository<Project>>();
            _mockMemberRepo = new Mock<IGenericRepository<ProjectMember>>();
            _mockUserRepo = new Mock<IGenericRepository<User>>();

            _mockUow.Setup(u => u.Repository<Project>()).Returns(_mockProjectRepo.Object);
            _mockUow.Setup(u => u.Repository<ProjectMember>()).Returns(_mockMemberRepo.Object);
            _mockUow.Setup(u => u.Repository<User>()).Returns(_mockUserRepo.Object);

            _mockCurrentUserService.Setup(c => c.GetRequiredUserId()).Returns(CurrentUserId);
            _mockCurrentUserService.Setup(c => c.IsInRole(RoleConstants.TechnicalManager)).Returns(true);

            _mockMemberRepo.SetupMockData(new List<ProjectMember>());
            _mockUserRepo.SetupMockData(new List<User>());

            _handler = new AddProjectMemberCommandHandler(
                _mockUow.Object,
                _mockMapper.Object,
                ServiceStubFactory.RealtimeSender(),
                ServiceStubFactory.NotificationService(),
                _mockCurrentUserService.Object);
        }

        [Fact]
        public async Task Handle_ProjectNotFound_ShouldThrowNotFoundException()
        {
            _mockProjectRepo.Setup(r => r.GetByIdAsync(ProjectId, It.IsAny<CancellationToken>()))
                .ReturnsAsync((Project?)null);

            var command = new AddProjectMemberCommand { ProjectId = ProjectId, UserId = TargetUserId };
            var act = async () => await _handler.Handle(command, CancellationToken.None);

            await act.Should().ThrowAsync<NotFoundException>();
        }

        [Fact]
        public async Task Handle_TargetUserNotFound_ShouldThrowNotFoundException()
        {
            var project = new Project { ProjectId = ProjectId, Name = "Dự án A" };
            _mockProjectRepo.Setup(r => r.GetByIdAsync(ProjectId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(project);
            _mockUserRepo.SetupMockData(new List<User>());

            var command = new AddProjectMemberCommand { ProjectId = ProjectId, UserId = TargetUserId };
            var act = async () => await _handler.Handle(command, CancellationToken.None);

            await act.Should().ThrowAsync<NotFoundException>();
        }

        [Fact]
        public async Task Handle_TargetUserInactive_ShouldThrowForbiddenException()
        {
            var project = new Project { ProjectId = ProjectId, Name = "Dự án A" };
            _mockProjectRepo.Setup(r => r.GetByIdAsync(ProjectId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(project);

            var targetUser = new User
            {
                UserId = TargetUserId,
                IsActive = false,
                UserRoles = new List<BPG.Domain.Entities.UserRole>
                {
                    new BPG.Domain.Entities.UserRole { Role = new Role { RoleName = RoleConstants.SiteEngineer } }
                }
            };
            _mockUserRepo.SetupMockData(new List<User> { targetUser });

            var command = new AddProjectMemberCommand { ProjectId = ProjectId, UserId = TargetUserId };
            var act = async () => await _handler.Handle(command, CancellationToken.None);

            var ex = await act.Should().ThrowAsync<ForbiddenException>();
            ex.Which.Message.Should().Contain("bị khóa");
        }

        [Fact]
        public async Task Handle_TargetUserNotSiteEngineer_ShouldThrowForbiddenException()
        {
            var project = new Project { ProjectId = ProjectId, Name = "Dự án A" };
            _mockProjectRepo.Setup(r => r.GetByIdAsync(ProjectId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(project);

            var targetUser = new User
            {
                UserId = TargetUserId,
                IsActive = true,
                UserRoles = new List<BPG.Domain.Entities.UserRole>
                {
                    new BPG.Domain.Entities.UserRole { Role = new Role { RoleName = RoleConstants.Accountant } }
                }
            };
            _mockUserRepo.SetupMockData(new List<User> { targetUser });

            var command = new AddProjectMemberCommand { ProjectId = ProjectId, UserId = TargetUserId };
            var act = async () => await _handler.Handle(command, CancellationToken.None);

            var ex = await act.Should().ThrowAsync<ForbiddenException>();
            ex.Which.Message.Should().Contain("Chỉ được thêm Site Engineer");
        }

        [Fact]
        public async Task Handle_ValidRequest_ShouldAddMember()
        {
            var project = new Project { ProjectId = ProjectId, Name = "Dự án A" };
            _mockProjectRepo.Setup(r => r.GetByIdAsync(ProjectId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(project);

            var targetUser = new User
            {
                UserId = TargetUserId,
                IsActive = true,
                UserRoles = new List<BPG.Domain.Entities.UserRole>
                {
                    new BPG.Domain.Entities.UserRole { Role = new Role { RoleName = RoleConstants.SiteEngineer } }
                }
            };
            _mockUserRepo.SetupMockData(new List<User> { targetUser });

            var command = new AddProjectMemberCommand { ProjectId = ProjectId, UserId = TargetUserId };
            var result = await _handler.Handle(command, CancellationToken.None);

            _mockMemberRepo.Verify(m => m.AddAsync(It.IsAny<ProjectMember>(), It.IsAny<CancellationToken>()), Times.Once);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }
    }
}
