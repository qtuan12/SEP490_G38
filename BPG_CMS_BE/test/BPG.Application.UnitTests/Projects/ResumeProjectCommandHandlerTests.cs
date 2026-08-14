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
    public class ResumeProjectCommandHandlerTests
    {
        private const long CurrentUserId = 1;
        private const long ProjectId = 100;

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly Mock<IGenericRepository<Project>> _mockProjectRepo;
        private readonly Mock<IGenericRepository<User>> _mockUserRepo;
        private readonly Mock<IGenericRepository<Incident>> _mockIncidentRepo;
        private readonly Mock<IGenericRepository<ProjectMember>> _mockMemberRepo;
        private readonly ResumeProjectCommandHandler _handler;

        public ResumeProjectCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();
            _mockProjectRepo = new Mock<IGenericRepository<Project>>();
            _mockUserRepo = new Mock<IGenericRepository<User>>();
            _mockIncidentRepo = new Mock<IGenericRepository<Incident>>();
            _mockMemberRepo = new Mock<IGenericRepository<ProjectMember>>();

            _mockUow.Setup(u => u.Repository<Project>()).Returns(_mockProjectRepo.Object);
            _mockUow.Setup(u => u.Repository<User>()).Returns(_mockUserRepo.Object);
            _mockUow.Setup(u => u.Repository<Incident>()).Returns(_mockIncidentRepo.Object);
            _mockUow.Setup(u => u.Repository<ProjectMember>()).Returns(_mockMemberRepo.Object);

            _mockCurrentUserService.Setup(c => c.GetRequiredUserId()).Returns(CurrentUserId);
            _mockIncidentRepo.SetupMockData(new List<Incident>());
            _mockMemberRepo.SetupMockData(new List<ProjectMember>());

            _handler = new ResumeProjectCommandHandler(
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

            var command = new ResumeProjectCommand { ProjectId = ProjectId };
            var act = async () => await _handler.Handle(command, CancellationToken.None);

            await act.Should().ThrowAsync<NotFoundException>();
        }

        [Fact]
        public async Task Handle_ProjectNotPaused_ShouldThrowBusinessException()
        {
            var project = new Project { ProjectId = ProjectId, Status = ProjectStatus.InProgress };
            _mockProjectRepo.Setup(r => r.GetByIdAsync(ProjectId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(project);

            var command = new ResumeProjectCommand { ProjectId = ProjectId };
            var act = async () => await _handler.Handle(command, CancellationToken.None);

            var ex = await act.Should().ThrowAsync<BusinessException>();
            ex.Which.ErrorCode.Should().Be("ERR_PROJECT_RESUME");
        }

        [Fact]
        public async Task Handle_PendingEmergencyIncident_ShouldThrowBusinessException()
        {
            var project = new Project { ProjectId = ProjectId, Status = ProjectStatus.Paused };
            _mockProjectRepo.Setup(r => r.GetByIdAsync(ProjectId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(project);

            var emergencyIncident = new Incident
            {
                IncidentId = 1,
                ProjectId = ProjectId,
                IsEmergency = true,
                Status = "WaitingStopApproval"
            };
            _mockIncidentRepo.SetupMockData(new List<Incident> { emergencyIncident });

            var command = new ResumeProjectCommand { ProjectId = ProjectId };
            var act = async () => await _handler.Handle(command, CancellationToken.None);

            var ex = await act.Should().ThrowAsync<BusinessException>();
            ex.Which.ErrorCode.Should().Be("ERR_EMERGENCY_RECOVERY_NOT_APPROVED");
        }

        [Fact]
        public async Task Handle_ValidRequest_ShouldResumeProject()
        {
            var project = new Project { ProjectId = ProjectId, Status = ProjectStatus.Paused };
            var user = new User { UserId = CurrentUserId, FullName = "Nguyễn Văn A" };

            _mockProjectRepo.Setup(r => r.GetByIdAsync(ProjectId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(project);
            _mockUserRepo.Setup(r => r.GetByIdAsync(CurrentUserId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(user);

            var command = new ResumeProjectCommand { ProjectId = ProjectId };
            var result = await _handler.Handle(command, CancellationToken.None);

            result.Should().BeTrue();
            project.Status.Should().Be(ProjectStatus.InProgress);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }
    }
}
