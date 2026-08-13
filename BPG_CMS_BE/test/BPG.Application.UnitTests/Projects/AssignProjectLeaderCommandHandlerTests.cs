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
    public class AssignProjectLeaderCommandHandlerTests
    {
        private const long CurrentUserId = 1;
        private const long ProjectId = 100;
        private const long TargetUserId = 20;

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly Mock<IGenericRepository<ProjectMember>> _mockMemberRepo;
        private readonly Mock<IGenericRepository<Project>> _mockProjectRepo;
        private readonly AssignProjectLeaderCommandHandler _handler;

        public AssignProjectLeaderCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();
            _mockMemberRepo = new Mock<IGenericRepository<ProjectMember>>();
            _mockProjectRepo = new Mock<IGenericRepository<Project>>();

            _mockUow.Setup(u => u.Repository<ProjectMember>()).Returns(_mockMemberRepo.Object);
            _mockUow.Setup(u => u.Repository<Project>()).Returns(_mockProjectRepo.Object);

            _mockCurrentUserService.Setup(c => c.GetRequiredUserId()).Returns(CurrentUserId);
            _mockCurrentUserService.Setup(c => c.IsInRole(RoleConstants.TechnicalManager)).Returns(true);

            _mockMemberRepo.SetupMockData(new List<ProjectMember>());
            _mockProjectRepo.Setup(r => r.GetByIdAsync(ProjectId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new Project { ProjectId = ProjectId, Name = "Dự án A" });

            _handler = new AssignProjectLeaderCommandHandler(
                _mockUow.Object,
                ServiceStubFactory.RealtimeSender(),
                ServiceStubFactory.NotificationService());
        }

        [Fact]
        public async Task Handle_TargetMemberNotFound_ShouldThrowNotFoundException()
        {
            _mockMemberRepo.SetupMockData(new List<ProjectMember>());

            var command = new AssignProjectLeaderCommand { ProjectId = ProjectId, UserId = TargetUserId };
            var act = async () => await _handler.Handle(command, CancellationToken.None);

            await act.Should().ThrowAsync<NotFoundException>();
        }

        [Fact]
        public async Task Handle_AssignLeader_ShouldSetIsLeaderTrueAndResetOthers()
        {
            var oldLeader = new ProjectMember { ProjectId = ProjectId, UserId = 10, IsLeader = true };
            var targetMember = new ProjectMember
            {
                ProjectId = ProjectId,
                UserId = TargetUserId,
                IsLeader = false,
                Project = new Project { ProjectId = ProjectId, Name = "Dự án A" },
                User = new User { UserId = TargetUserId, FullName = "Kỹ sư B" }
            };
            _mockMemberRepo.SetupMockData(new List<ProjectMember> { oldLeader, targetMember });

            var command = new AssignProjectLeaderCommand { ProjectId = ProjectId, UserId = TargetUserId };
            var result = await _handler.Handle(command, CancellationToken.None);

            result.Should().BeTrue();
            targetMember.IsLeader.Should().BeTrue();
            oldLeader.IsLeader.Should().BeFalse();
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }
    }
}
