namespace BPG.Application.UnitTests.Projects;

using BPG.Application.Features.Projects.Commands;
using BPG.Application.Features.Projects.Handlers;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Application.UnitTests.Helpers;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using Moq;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Xunit;

public class CompleteProjectCommandHandlerTests
{
    private const long ProjectId = 100;

    private readonly Mock<IUnitOfWork> _mockUow;
    private readonly Mock<IGenericRepository<Project>> _mockProjectRepo;
    private readonly Mock<IGenericRepository<ProjectTask>> _mockTaskRepo;
    private readonly Mock<IGenericRepository<Incident>> _mockIncidentRepo;
    private readonly Mock<IGenericRepository<ProjectMember>> _mockMemberRepo;
    private readonly Mock<IGenericRepository<User>> _mockUserRepo;
    private readonly Mock<INotificationService> _mockNotificationService;
    private readonly Mock<ICurrentUserService> _mockCurrentUserService;
    private readonly CompleteProjectCommandHandler _handler;

    public CompleteProjectCommandHandlerTests()
    {
        _mockUow = new Mock<IUnitOfWork>();
        _mockProjectRepo = new Mock<IGenericRepository<Project>>();
        _mockTaskRepo = new Mock<IGenericRepository<ProjectTask>>();
        _mockIncidentRepo = new Mock<IGenericRepository<Incident>>();
        _mockMemberRepo = new Mock<IGenericRepository<ProjectMember>>();
        _mockUserRepo = new Mock<IGenericRepository<User>>();
        _mockNotificationService = new Mock<INotificationService>();
        _mockCurrentUserService = new Mock<ICurrentUserService>();

        _mockUow.Setup(u => u.Repository<Project>()).Returns(_mockProjectRepo.Object);
        _mockUow.Setup(u => u.Repository<ProjectTask>()).Returns(_mockTaskRepo.Object);
        _mockUow.Setup(u => u.Repository<Incident>()).Returns(_mockIncidentRepo.Object);
        _mockUow.Setup(u => u.Repository<ProjectMember>()).Returns(_mockMemberRepo.Object);
        _mockUow.Setup(u => u.Repository<User>()).Returns(_mockUserRepo.Object);

        _mockProjectRepo.SetupMockData(new List<Project>());
        _mockTaskRepo.SetupMockData(new List<ProjectTask>());
        _mockIncidentRepo.SetupMockData(new List<Incident>());
        _mockMemberRepo.SetupMockData(new List<ProjectMember>());
        _mockUserRepo.SetupMockData(new List<User>());

        _mockCurrentUserService.Setup(s => s.UserId).Returns(1L);

        _handler = new CompleteProjectCommandHandler(
            _mockUow.Object,
            _mockNotificationService.Object,
            ServiceStubFactory.RealtimeSender(),
            _mockCurrentUserService.Object);
    }

    [Fact]
    public async Task Handle_ProjectNotFound_ShouldThrowNotFoundException()
    {
        _mockProjectRepo.SetupMockData(new List<Project>());

        var command = new CompleteProjectCommand(ProjectId);
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Handle_ProjectNotActive_ShouldThrowBusinessException()
    {
        var project = new Project { ProjectId = ProjectId, Status = ProjectStatus.Paused };
        _mockProjectRepo.SetupMockData(new List<Project> { project });

        var command = new CompleteProjectCommand(ProjectId);
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        var ex = await act.Should().ThrowAsync<BusinessException>();
        ex.Which.ErrorCode.Should().Be("ERR_PROJECT_NOT_INPROGRESS");
    }

    [Fact]
    public async Task Handle_ProjectHasUnfinishedTasks_ShouldThrowBusinessException()
    {
        var project = new Project { ProjectId = ProjectId, Status = ProjectStatus.InProgress };
        var phase = new Phase { PhaseId = 1, ProjectId = ProjectId };
        var task = new ProjectTask { TaskId = 1, Phase = phase, ProgressPercent = 80, Status = BPG.Domain.Constants.TaskStatus.InProgress };

        _mockProjectRepo.SetupMockData(new List<Project> { project });
        _mockTaskRepo.SetupMockData(new List<ProjectTask> { task });

        var command = new CompleteProjectCommand(ProjectId);
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        var ex = await act.Should().ThrowAsync<BusinessException>();
        ex.Which.ErrorCode.Should().Be("ERR_PROJECT_TASKS_NOT_COMPLETED");
    }

    [Fact]
    public async Task Handle_ProjectHasPendingIncidents_ShouldThrowBusinessException()
    {
        var project = new Project { ProjectId = ProjectId, Status = ProjectStatus.InProgress };
        var incident = new Incident { IncidentId = 1, ProjectId = ProjectId, Status = "WaitingReview" };

        _mockProjectRepo.SetupMockData(new List<Project> { project });
        _mockTaskRepo.SetupMockData(new List<ProjectTask>());
        _mockIncidentRepo.SetupMockData(new List<Incident> { incident });

        var command = new CompleteProjectCommand(ProjectId);
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        var ex = await act.Should().ThrowAsync<BusinessException>();
        ex.Which.ErrorCode.Should().Be("ERR_PENDING_INCIDENTS");
    }

    [Fact]
    public async Task Handle_ValidInProgressProject_ShouldCompleteAndSendNotifications()
    {
        var project = new Project { ProjectId = ProjectId, Name = "Dự án VIP", Status = ProjectStatus.InProgress };
        var user = new User { UserId = 1, FullName = "Nguyễn Văn A" };
        var member = new ProjectMember { ProjectId = ProjectId, UserId = 2 };

        _mockProjectRepo.SetupMockData(new List<Project> { project });
        _mockTaskRepo.SetupMockData(new List<ProjectTask>());
        _mockIncidentRepo.SetupMockData(new List<Incident>());
        _mockUserRepo.SetupMockData(new List<User> { user });
        _mockMemberRepo.SetupMockData(new List<ProjectMember> { member });

        var command = new CompleteProjectCommand(ProjectId);
        await _handler.Handle(command, CancellationToken.None);

        project.Status.Should().Be(ProjectStatus.Completed);
        _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        _mockNotificationService.Verify(n => n.SendNotificationAsync(
            member.UserId,
            It.IsAny<string>(),
            It.IsAny<string>(),
            It.IsAny<string>(),
            It.IsAny<string>(),
            ProjectId,
            It.IsAny<CancellationToken>()), Times.Once);
    }
}
