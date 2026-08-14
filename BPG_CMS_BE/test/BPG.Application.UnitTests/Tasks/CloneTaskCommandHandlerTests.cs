using AutoMapper;
using BPG.Application.Common.Mappings;
using BPG.Application.Features.Tasks.Commands;
using BPG.Application.Features.Tasks.Handlers;
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

namespace BPG.Application.UnitTests.Tasks;

public class CloneTaskCommandHandlerTests
{
    private const long ProjectId = 10;
    private const long PhaseId = 20;
    private const long TaskId = 30;
    private const long ChildTaskId = 31;
    private const long CurrentUserId = 40;
    private const long GeneratedTaskId = 50;

    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly Mock<IGenericRepository<ProjectTask>> _taskRepository = new();
    private readonly Mock<IGenericRepository<ProjectMember>> _memberRepository = new();
    private readonly Mock<ICurrentUserService> _currentUserService = new();
    private readonly Mock<IProjectAccessService> _projectAccessService = new();
    private readonly CloneTaskCommandHandler _handler;

    public CloneTaskCommandHandlerTests()
    {
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
        _taskRepository.Setup(x => x.AddRangeAsync(
                It.IsAny<IEnumerable<ProjectTask>>(),
                It.IsAny<CancellationToken>()))
            .Callback<IEnumerable<ProjectTask>, CancellationToken>((tasks, _) =>
                tasks.Single(task => task.Name.EndsWith(" (Bản sao)")).TaskId = GeneratedTaskId)
            .Returns(Task.CompletedTask);

        _currentUserService.SetupUser(CurrentUserId, WbsUserRole.TechnicalManager);
        _projectAccessService.Setup(x => x.IsCurrentUserProjectLeaderAsync(
                It.IsAny<long>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        SetupTasks(
            TaskEntity(TaskId),
            TaskEntity(ChildTaskId, parentTaskId: TaskId));
        SetupMembers(new ProjectMember { ProjectId = ProjectId, UserId = CurrentUserId });

        var mapper = new MapperConfiguration(configuration =>
            configuration.AddProfile<MappingProfile>()).CreateMapper();
        _handler = new CloneTaskCommandHandler(
            _unitOfWork.Object,
            _currentUserService.Object,
            _projectAccessService.Object,
            ServiceStubFactory.ProgressRollupService(),
            new WbsCloneFactory(mapper));
    }

    [Fact]
    public async Task UTCID01_Handle_ValidRootTaskWithChildren_ShouldReturnClonedTaskId()
    {
        var result = await _handler.Handle(Command(), CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Data.Should().Be(GeneratedTaskId);
    }

    [Fact]
    public async Task UTCID02_Handle_TaskNotFound_ShouldThrowNotFoundException()
    {
        SetupTasks();

        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<NotFoundException>();
        exception.Which.ErrorCode.Should().Be(ErrorCodes.NotFound);
    }

    [Fact]
    public async Task UTCID03_Handle_ProjectInInvalidStatus_ShouldThrowInvalidTransition()
    {
        SetupTasks(TaskEntity(TaskId, projectStatus: ProjectStatus.Completed));

        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be(ErrorCodes.InvalidTransition);
    }

    [Fact]
    public async Task UTCID04_Handle_ApprovedPhase_ShouldThrowAlreadyApprovedException()
    {
        SetupTasks(TaskEntity(TaskId, phaseStatus: PhaseStatus.Approved));

        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<AlreadyApprovedException>();
        exception.Which.ErrorCode.Should().Be(ErrorCodes.AlreadyApproved);
    }

    [Fact]
    public async Task UTCID05_Handle_ProjectLeader_ShouldReturnClonedTaskId()
    {
        _currentUserService.SetupUser(CurrentUserId);
        _projectAccessService.Setup(x => x.IsCurrentUserProjectLeaderAsync(
                ProjectId,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var result = await _handler.Handle(Command(), CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Data.Should().Be(GeneratedTaskId);
    }

    [Fact]
    public async Task UTCID06_Handle_UserWithoutManagerOrLeaderPermission_ShouldThrowForbiddenException()
    {
        _currentUserService.SetupUser(CurrentUserId);

        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<ForbiddenException>();
        exception.Which.ErrorCode.Should().Be(ErrorCodes.Forbidden);
    }

    private static CloneTaskCommand Command() => new(TaskId);

    private static ProjectTask TaskEntity(
        long taskId,
        long? parentTaskId = null,
        string projectStatus = ProjectStatus.InProgress,
        string phaseStatus = PhaseStatus.InProgress) => new()
    {
        TaskId = taskId,
        PhaseId = PhaseId,
        ParentTaskId = parentTaskId,
        Name = $"Task {taskId}",
        OrderIndex = 1,
        StartDate = new DateOnly(2026, 8, 1),
        EndDate = new DateOnly(2026, 8, 31),
        Phase = new Phase
        {
            PhaseId = PhaseId,
            ProjectId = ProjectId,
            Status = phaseStatus,
            Project = new Project
            {
                ProjectId = ProjectId,
                Status = projectStatus
            }
        },
        Assignees = new List<TaskAssignee>(),
        Dependencies = new List<TaskDependency>()
    };

    private void SetupTasks(params ProjectTask[] tasks) =>
        _taskRepository.Setup(x => x.Query()).Returns(tasks.AsQueryable().BuildMock());

    private void SetupMembers(params ProjectMember[] members) =>
        _memberRepository.Setup(x => x.Query()).Returns(members.AsQueryable().BuildMock());
}
