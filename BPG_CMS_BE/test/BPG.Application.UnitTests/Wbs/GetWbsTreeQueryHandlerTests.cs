using BPG.Application.Features.Wbs.Handlers;
using BPG.Application.Features.Wbs.Queries;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using MockQueryable;
using Moq;

namespace BPG.Application.UnitTests.Wbs;

public class GetWbsTreeQueryHandlerTests
{
    private const long ProjectId = 10;

    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IGenericRepository<Project>> _projectRepo = new();
    private readonly Mock<IGenericRepository<Phase>> _phaseRepo = new();
    private readonly Mock<IGenericRepository<ProjectTask>> _taskRepo = new();
    private readonly Mock<IGenericRepository<BOQItem>> _boqRepo = new();
    private readonly Mock<IProjectAccessService> _projectAccess = new();
    private readonly GetWbsTreeQueryHandler _handler;

    public GetWbsTreeQueryHandlerTests()
    {
        _uow.Setup(x => x.Repository<Project>()).Returns(_projectRepo.Object);
        _uow.Setup(x => x.Repository<Phase>()).Returns(_phaseRepo.Object);
        _uow.Setup(x => x.Repository<ProjectTask>()).Returns(_taskRepo.Object);
        _uow.Setup(x => x.Repository<BOQItem>()).Returns(_boqRepo.Object);

        _projectAccess.Setup(x => x.GetAccessibleProjectIdsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new HashSet<long> { ProjectId });

        SetupProjects(Project());
        SetupPhases();
        SetupTasks();
        SetupBoqItems();

        _handler = new GetWbsTreeQueryHandler(
            _uow.Object,
            Mock.Of<ICurrentUserService>(),
            _projectAccess.Object);
    }

    [Fact]
    public async Task UTCID01_Handle_AccessibleProjectWithHierarchy_ShouldReturnMappedTree()
    {
        var phase = Phase(20, orderIndex: 1);
        var root = Task(30, phase, "Root", progress: 25);
        var child = Task(31, phase, "Child", progress: 50, parentTaskId: root.TaskId);
        root.Assignees.Add(new TaskAssignee
        {
            TaskId = root.TaskId,
            UserId = 99,
            User = new User { UserId = 99, FullName = "Site Engineer" }
        });
        root.Dependencies.Add(new TaskDependency { TaskId = root.TaskId, PredecessorTaskId = 77 });

        SetupPhases(phase);
        SetupTasks(root, child);
        SetupBoqItems(new BOQItem
        {
            BOQItemId = 1,
            PhaseId = phase.PhaseId,
            Phase = phase,
            MaterialId = 50,
            Material = new MaterialCatalog { MaterialId = 50, Name = "Cement" },
            UnitId = 2,
            Unit = new Unit { UnitId = 2, UnitName = "Bag" },
            Quantity = 100,
            ConversionRate = 1
        });

        var result = await _handler.Handle(new GetWbsTreeQuery(ProjectId), CancellationToken.None);

        result.ProjectId.Should().Be(ProjectId);
        result.Phases.Should().ContainSingle();
        var phaseDto = result.Phases.Single();
        phaseDto.Tasks.Should().ContainSingle();
        phaseDto.Materials.Should().ContainSingle(x => x.Name == "Cement" && x.Quantity == 100);
        var taskDto = phaseDto.Tasks.Single();
        taskDto.Name.Should().Be("Root");
        taskDto.AssignedTo.Should().Be("99");
        taskDto.AssignedName.Should().Be("Site Engineer");
        taskDto.PredecessorTaskIds.Should().Equal(77);
        taskDto.SubTasks.Should().ContainSingle(x => x.Name == "Child");
    }

    [Fact]
    public async Task UTCID02_Handle_InaccessibleProject_ShouldThrowForbiddenException()
    {
        _projectAccess.Setup(x => x.GetAccessibleProjectIdsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new HashSet<long>());

        Func<Task> act = () => _handler.Handle(new GetWbsTreeQuery(ProjectId), CancellationToken.None);

        await act.Should().ThrowAsync<ForbiddenException>();
    }

    [Fact]
    public async Task UTCID03_Handle_ProjectNotFound_ShouldThrowNotFoundException()
    {
        SetupProjects();

        Func<Task> act = () => _handler.Handle(new GetWbsTreeQuery(ProjectId), CancellationToken.None);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task UTCID04_Handle_WeightedRootTasks_ShouldCalculatePhaseProgress()
    {
        var phase = Phase(20);
        var shortTask = Task(30, phase, "Short", progress: 100, start: new DateOnly(2026, 8, 1), end: new DateOnly(2026, 8, 1));
        var longTask = Task(31, phase, "Long", progress: 0, start: new DateOnly(2026, 8, 1), end: new DateOnly(2026, 8, 3));
        SetupPhases(phase);
        SetupTasks(shortTask, longTask);

        var result = await _handler.Handle(new GetWbsTreeQuery(ProjectId), CancellationToken.None);

        result.Phases.Single().ProgressPercent.Should().Be(25);
    }

    private static Project Project() => new()
    {
        ProjectId = ProjectId,
        PlannedStart = new DateOnly(2026, 1, 1),
        PlannedEnd = new DateOnly(2026, 12, 31)
    };

    private static Phase Phase(long id, int orderIndex = 1) => new()
    {
        PhaseId = id,
        ProjectId = ProjectId,
        Name = $"Phase {id}",
        OrderIndex = orderIndex,
        Project = Project()
    };

    private static ProjectTask Task(
        long id,
        Phase phase,
        string name,
        byte progress,
        long? parentTaskId = null,
        DateOnly? start = null,
        DateOnly? end = null) => new()
    {
        TaskId = id,
        PhaseId = phase.PhaseId,
        Phase = phase,
        ParentTaskId = parentTaskId,
        Name = name,
        StartDate = start ?? new DateOnly(2026, 8, 1),
        EndDate = end ?? new DateOnly(2026, 8, 2),
        ProgressPercent = progress,
        Status = BPG.Domain.Constants.TaskStatus.InProgress,
        Assignees = new List<TaskAssignee>(),
        Dependencies = new List<TaskDependency>()
    };

    private void SetupProjects(params Project[] projects) =>
        _projectRepo.Setup(x => x.Query()).Returns(projects.AsQueryable().BuildMock());

    private void SetupPhases(params Phase[] phases) =>
        _phaseRepo.Setup(x => x.Query()).Returns(phases.AsQueryable().BuildMock());

    private void SetupTasks(params ProjectTask[] tasks) =>
        _taskRepo.Setup(x => x.Query()).Returns(tasks.AsQueryable().BuildMock());

    private void SetupBoqItems(params BOQItem[] items) =>
        _boqRepo.Setup(x => x.Query()).Returns(items.AsQueryable().BuildMock());
}
