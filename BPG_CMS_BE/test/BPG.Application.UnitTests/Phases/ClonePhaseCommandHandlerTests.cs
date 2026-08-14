using AutoMapper;
using BPG.Application.Common.Mappings;
using BPG.Application.Features.Phases.Commands;
using BPG.Application.Features.Phases.Handlers;
using BPG.Application.Features.Wbs.Services;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Application.UnitTests.Helpers;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using MockQueryable;
using Moq;
using System.Data;
using WbsUserRole = BPG.Domain.Constants.UserRole;

namespace BPG.Application.UnitTests.Phases;

public class ClonePhaseCommandHandlerTests
{
    private const long ProjectId = 10;
    private const long PhaseId = 20;
    private const long CurrentUserId = 30;
    private const long GeneratedPhaseId = 40;

    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly Mock<IGenericRepository<Phase>> _phaseRepository = new();
    private readonly Mock<IGenericRepository<ProjectTask>> _taskRepository = new();
    private readonly Mock<IGenericRepository<ProjectMember>> _memberRepository = new();
    private readonly Mock<ICurrentUserService> _currentUserService = new();
    private readonly ClonePhaseCommandHandler _handler;

    public ClonePhaseCommandHandlerTests()
    {
        _unitOfWork.Setup(x => x.Repository<Phase>()).Returns(_phaseRepository.Object);
        _unitOfWork.Setup(x => x.Repository<ProjectTask>()).Returns(_taskRepository.Object);
        _unitOfWork.Setup(x => x.Repository<ProjectMember>()).Returns(_memberRepository.Object);
        _unitOfWork.Setup(x => x.BeginTransactionAsync(
                IsolationLevel.Serializable,
                It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        _unitOfWork.Setup(x => x.ExecuteSqlAsync(
                It.IsAny<FormattableString>(),
                It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        _unitOfWork.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);
        _unitOfWork.Setup(x => x.CommitTransactionAsync(It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        _phaseRepository.Setup(x => x.AddAsync(It.IsAny<Phase>(), It.IsAny<CancellationToken>()))
            .Callback<Phase, CancellationToken>((phase, _) => phase.PhaseId = GeneratedPhaseId)
            .Returns(Task.CompletedTask);

        _currentUserService.SetupUser(CurrentUserId, WbsUserRole.TechnicalManager);
        SetupPhases(Phase());
        SetupTasks(
            TaskEntity(101),
            TaskEntity(102, parentTaskId: 101));
        SetupMembers(new ProjectMember { ProjectId = ProjectId, UserId = CurrentUserId });

        var mapper = new MapperConfiguration(configuration =>
            configuration.AddProfile<MappingProfile>()).CreateMapper();
        _handler = new ClonePhaseCommandHandler(
            _unitOfWork.Object,
            _currentUserService.Object,
            new WbsCloneFactory(mapper));
    }

    [Fact]
    public async Task UTCID01_Handle_ValidPhaseWithTaskHierarchy_ShouldReturnClonedPhaseId()
    {
        var result = await _handler.Handle(Command(), CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Data.Should().Be(GeneratedPhaseId);
    }

    [Fact]
    public async Task UTCID02_Handle_UserWithoutTechnicalManagerRole_ShouldThrowForbiddenException()
    {
        _currentUserService.SetupUser(CurrentUserId);

        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<ForbiddenException>();
        exception.Which.ErrorCode.Should().Be(ErrorCodes.Forbidden);
    }

    [Fact]
    public async Task UTCID03_Handle_PhaseNotFoundInProject_ShouldThrowNotFoundException()
    {
        SetupPhases();

        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<NotFoundException>();
        exception.Which.ErrorCode.Should().Be(ErrorCodes.NotFound);
    }

    [Fact]
    public async Task UTCID04_Handle_ProjectInInvalidStatus_ShouldThrowInvalidTransition()
    {
        SetupPhases(Phase(ProjectStatus.Completed));

        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be(ErrorCodes.InvalidTransition);
    }

    private static ClonePhaseCommand Command() => new(ProjectId, PhaseId);

    private static Phase Phase(string projectStatus = ProjectStatus.InProgress) => new()
    {
        PhaseId = PhaseId,
        ProjectId = ProjectId,
        Name = "Foundation",
        OrderIndex = 1,
        Status = PhaseStatus.InProgress,
        Project = new Project
        {
            ProjectId = ProjectId,
            Status = projectStatus
        }
    };

    private static ProjectTask TaskEntity(long taskId, long? parentTaskId = null) => new()
    {
        TaskId = taskId,
        PhaseId = PhaseId,
        ParentTaskId = parentTaskId,
        Name = $"Task {taskId}",
        StartDate = new DateOnly(2026, 8, 1),
        EndDate = new DateOnly(2026, 8, 31),
        Assignees = new List<TaskAssignee>(),
        Dependencies = new List<TaskDependency>()
    };

    private void SetupPhases(params Phase[] phases) =>
        _phaseRepository.Setup(x => x.Query()).Returns(phases.AsQueryable().BuildMock());

    private void SetupTasks(params ProjectTask[] tasks) =>
        _taskRepository.Setup(x => x.Query()).Returns(tasks.AsQueryable().BuildMock());

    private void SetupMembers(params ProjectMember[] members) =>
        _memberRepository.Setup(x => x.Query()).Returns(members.AsQueryable().BuildMock());
}
