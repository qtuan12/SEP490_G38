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
    public class ActivateProjectCommandHandlerTests
    {
        private const long ProjectId = 100;

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IGenericRepository<Project>> _mockProjectRepo;
        private readonly Mock<IGenericRepository<ProjectMember>> _mockMemberRepo;
        private readonly Mock<INotificationService> _mockNotificationService;
        private readonly ActivateProjectCommandHandler _handler;

        public ActivateProjectCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockProjectRepo = new Mock<IGenericRepository<Project>>();
            _mockMemberRepo = new Mock<IGenericRepository<ProjectMember>>();
            _mockNotificationService = new Mock<INotificationService>();

            _mockUow.Setup(u => u.Repository<Project>()).Returns(_mockProjectRepo.Object);
            _mockUow.Setup(u => u.Repository<ProjectMember>()).Returns(_mockMemberRepo.Object);

            _mockProjectRepo.SetupMockData(new List<Project>());
            _mockMemberRepo.SetupMockData(new List<ProjectMember>());

            _handler = new ActivateProjectCommandHandler(
                _mockUow.Object,
                _mockNotificationService.Object,
                ServiceStubFactory.RealtimeSender());
        }

        [Fact]
        public async Task Handle_ProjectNotFound_ShouldThrowNotFoundException()
        {
            _mockProjectRepo.SetupMockData(new List<Project>());

            var command = new ActivateProjectCommand(ProjectId);
            var act = async () => await _handler.Handle(command, CancellationToken.None);

            await act.Should().ThrowAsync<NotFoundException>();
        }

        [Fact]
        public async Task Handle_ProjectNotDraft_ShouldThrowBusinessException()
        {
            var project = new Project
            {
                ProjectId = ProjectId,
                Status = ProjectStatus.InProgress,
                Phases = new List<Phase>
                {
                    new Phase { Tasks = new List<ProjectTask> { new ProjectTask() } }
                }
            };
            _mockProjectRepo.SetupMockData(new List<Project> { project });

            var command = new ActivateProjectCommand(ProjectId);
            var act = async () => await _handler.Handle(command, CancellationToken.None);

            var ex = await act.Should().ThrowAsync<BusinessException>();
            ex.Which.ErrorCode.Should().Be("ERR_PROJECT_NOT_DRAFT");
        }

        [Fact]
        public async Task Handle_ProjectNoTasks_ShouldThrowBusinessException()
        {
            var project = new Project
            {
                ProjectId = ProjectId,
                Status = ProjectStatus.Draft,
                Phases = new List<Phase>()
            };
            _mockProjectRepo.SetupMockData(new List<Project> { project });

            var command = new ActivateProjectCommand(ProjectId);
            var act = async () => await _handler.Handle(command, CancellationToken.None);

            var ex = await act.Should().ThrowAsync<BusinessException>();
            ex.Which.ErrorCode.Should().Be("ERR_PROJECT_NO_TASKS");
        }

        [Fact]
        public async Task Handle_ValidDraftProjectWithTasks_ShouldActivateAndSendNotifications()
        {
            var project = new Project
            {
                ProjectId = ProjectId,
                Name = "Công trình A",
                Status = ProjectStatus.Draft,
                Phases = new List<Phase>
                {
                    new Phase { Tasks = new List<ProjectTask> { new ProjectTask() } }
                }
            };
            var members = new List<ProjectMember>
            {
                new ProjectMember { ProjectId = ProjectId, UserId = 10 },
                new ProjectMember { ProjectId = ProjectId, UserId = 20 }
            };

            _mockProjectRepo.SetupMockData(new List<Project> { project });
            _mockMemberRepo.SetupMockData(members);

            var command = new ActivateProjectCommand(ProjectId);
            var result = await _handler.Handle(command, CancellationToken.None);

            result.Should().Be(MediatR.Unit.Value);
            project.Status.Should().Be(ProjectStatus.InProgress);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);

            // Verify notifications to members
            _mockNotificationService.Verify(n => n.SendNotificationAsync(
                10,
                It.IsAny<string>(),
                It.IsAny<string>(),
                NotificationType.Progress,
                NotificationReferenceType.Project,
                ProjectId,
                It.IsAny<CancellationToken>()), Times.Once);

            _mockNotificationService.Verify(n => n.SendNotificationAsync(
                20,
                It.IsAny<string>(),
                It.IsAny<string>(),
                NotificationType.Progress,
                NotificationReferenceType.Project,
                ProjectId,
                It.IsAny<CancellationToken>()), Times.Once);

            // Verify notifications to Key Roles (Director, TechnicalManager, Accountant)
            _mockNotificationService.Verify(n => n.SendNotificationToRoleAsync(
                BPG.Domain.Constants.UserRole.Director,
                It.IsAny<string>(),
                It.IsAny<string>(),
                NotificationType.Progress,
                NotificationReferenceType.Project,
                ProjectId,
                It.IsAny<CancellationToken>()), Times.Once);

            _mockNotificationService.Verify(n => n.SendNotificationToRoleAsync(
                BPG.Domain.Constants.UserRole.TechnicalManager,
                It.IsAny<string>(),
                It.IsAny<string>(),
                NotificationType.Progress,
                NotificationReferenceType.Project,
                ProjectId,
                It.IsAny<CancellationToken>()), Times.Once);

            _mockNotificationService.Verify(n => n.SendNotificationToRoleAsync(
                BPG.Domain.Constants.UserRole.Accountant,
                It.IsAny<string>(),
                It.IsAny<string>(),
                NotificationType.Progress,
                NotificationReferenceType.Project,
                ProjectId,
                It.IsAny<CancellationToken>()), Times.Once);
        }
    }
}
