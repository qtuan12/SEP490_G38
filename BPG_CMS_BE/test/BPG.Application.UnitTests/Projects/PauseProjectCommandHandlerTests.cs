using BPG.Application.Features.Projects.Handlers;
using BPG.Application.Features.Projects.Commands;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Application.UnitTests.Helpers;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using Moq;

namespace BPG.Application.UnitTests.Projects
{
    public class PauseProjectCommandHandlerTests
    {
        private const long CurrentUserId = 1;
        private const long ProjectId = 100;

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly Mock<IGenericRepository<Project>> _mockProjectRepo;
        private readonly Mock<IGenericRepository<User>> _mockUserRepo;
        private readonly Mock<IGenericRepository<ProjectMember>> _mockMemberRepo;
        private readonly PauseProjectCommandHandler _handler;

        public PauseProjectCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();
            _mockProjectRepo = new Mock<IGenericRepository<Project>>();
            _mockUserRepo = new Mock<IGenericRepository<User>>();
            _mockMemberRepo = new Mock<IGenericRepository<ProjectMember>>();

            _mockUow.Setup(u => u.Repository<Project>()).Returns(_mockProjectRepo.Object);
            _mockUow.Setup(u => u.Repository<User>()).Returns(_mockUserRepo.Object);
            _mockUow.Setup(u => u.Repository<ProjectMember>()).Returns(_mockMemberRepo.Object);

            _mockCurrentUserService.Setup(c => c.GetRequiredUserId()).Returns(CurrentUserId);
            _mockMemberRepo.SetupMockData(new List<ProjectMember>());

            _handler = new PauseProjectCommandHandler(
                _mockUow.Object,
                ServiceStubFactory.NotificationService(),
                ServiceStubFactory.RealtimeSender(),
                _mockCurrentUserService.Object);
        }

        [Fact]
        public async Task Handle_ProjectNotFound_ShouldThrowNotFoundException()
        {
            _mockProjectRepo.Setup(r => r.GetByIdAsync(ProjectId, It.IsAny<CancellationToken>()))
                .ReturnsAsync((Project?)null);

            var command = new PauseProjectCommand { ProjectId = ProjectId, PauseReason = "Tạm dừng kiểm tra" };
            var act = async () => await _handler.Handle(command, CancellationToken.None);

            await act.Should().ThrowAsync<NotFoundException>();
        }

        [Fact]
        public async Task Handle_ProjectNotInProgress_ShouldThrowBusinessException()
        {
            var project = new Project { ProjectId = ProjectId, Status = ProjectStatus.Draft };
            _mockProjectRepo.Setup(r => r.GetByIdAsync(ProjectId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(project);

            var command = new PauseProjectCommand { ProjectId = ProjectId, PauseReason = "Tạm dừng kiểm tra" };
            var act = async () => await _handler.Handle(command, CancellationToken.None);

            var ex = await act.Should().ThrowAsync<BusinessException>();
            ex.Which.ErrorCode.Should().Be("ERR_PROJECT_PAUSE");
        }

        [Fact]
        public async Task Handle_ValidRequest_ShouldPauseProjectAndReturnSuccess()
        {
            var project = new Project { ProjectId = ProjectId, Status = ProjectStatus.InProgress, PauseReason = null };
            var user = new User { UserId = CurrentUserId, FullName = "Nguyễn Văn A" };

            _mockProjectRepo.Setup(r => r.GetByIdAsync(ProjectId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(project);
            _mockUserRepo.Setup(r => r.GetByIdAsync(CurrentUserId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(user);

            var command = new PauseProjectCommand { ProjectId = ProjectId, PauseReason = "Tạm dừng do thiếu vật tư" };
            var result = await _handler.Handle(command, CancellationToken.None);

            result.Should().BeTrue();
            project.Status.Should().Be(ProjectStatus.Paused);
            project.PauseReason.Should().NotBeNullOrEmpty();
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }
    }
}
