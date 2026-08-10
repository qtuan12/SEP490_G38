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
    public class RemoveProjectMemberCommandHandlerTests
    {
        private const long CurrentUserId = 1;
        private const long ProjectId = 100;
        private const long TargetUserId = 20;

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly Mock<IGenericRepository<ProjectMember>> _mockMemberRepo;
        private readonly RemoveProjectMemberCommandHandler _handler;

        public RemoveProjectMemberCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();
            _mockMemberRepo = new Mock<IGenericRepository<ProjectMember>>();

            _mockUow.Setup(u => u.Repository<ProjectMember>()).Returns(_mockMemberRepo.Object);

            _mockCurrentUserService.Setup(c => c.GetRequiredUserId()).Returns(CurrentUserId);
            _mockCurrentUserService.Setup(c => c.IsInRole(RoleConstants.TechnicalManager)).Returns(true);
            _mockCurrentUserService.Setup(c => c.IsInRole(RoleConstants.SiteEngineer)).Returns(false);

            _mockMemberRepo.SetupMockData(new List<ProjectMember>());

            _handler = new RemoveProjectMemberCommandHandler(
                _mockUow.Object,
                _mockCurrentUserService.Object,
                ServiceStubFactory.RealtimeSender());
        }

        [Fact]
        public async Task Handle_SiteEngineerActor_ShouldThrowForbiddenException()
        {
            _mockCurrentUserService.Setup(c => c.IsInRole(RoleConstants.SiteEngineer)).Returns(true);

            var command = new RemoveProjectMemberCommand { ProjectId = ProjectId, UserId = TargetUserId };
            var act = async () => await _handler.Handle(command, CancellationToken.None);

            var ex = await act.Should().ThrowAsync<ForbiddenException>();
            ex.Which.Message.Should().Contain("Chỉ Trưởng dự án mới được xóa thành viên");
        }

        [Fact]
        public async Task Handle_MemberNotFound_ShouldThrowNotFoundException()
        {
            _mockMemberRepo.SetupMockData(new List<ProjectMember>());

            var command = new RemoveProjectMemberCommand { ProjectId = ProjectId, UserId = TargetUserId };
            var act = async () => await _handler.Handle(command, CancellationToken.None);

            await act.Should().ThrowAsync<NotFoundException>();
        }

        [Fact]
        public async Task Handle_ValidRequest_ShouldRemoveMember()
        {
            var member = new ProjectMember
            {
                ProjectId = ProjectId,
                UserId = TargetUserId,
                IsDeleted = false
            };
            _mockMemberRepo.SetupMockData(new List<ProjectMember> { member });

            var command = new RemoveProjectMemberCommand { ProjectId = ProjectId, UserId = TargetUserId };
            var result = await _handler.Handle(command, CancellationToken.None);

            result.Should().BeTrue();
            member.IsDeleted.Should().BeTrue();
            _mockMemberRepo.Verify(m => m.Update(member), Times.Once);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }
    }
}
