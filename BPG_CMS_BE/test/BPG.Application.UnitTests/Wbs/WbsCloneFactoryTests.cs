using AutoMapper;
using BPG.Application.Common.Mappings;
using BPG.Application.Features.Wbs.Services;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using FluentAssertions;
using WbsTaskStatus = BPG.Domain.Constants.TaskStatus;

namespace BPG.Application.UnitTests.Wbs;

public class WbsCloneFactoryTests
{
    private const long PhaseId = 20;
    private const long RootTaskId = 30;
    private const long ChildTaskId = 31;
    private const long ValidAssigneeId = 40;
    private const long RemovedMemberId = 41;

    private readonly WbsCloneFactory _factory;

    public WbsCloneFactoryTests()
    {
        var mapper = new MapperConfiguration(configuration =>
            configuration.AddProfile<MappingProfile>()).CreateMapper();
        _factory = new WbsCloneFactory(mapper);
    }

    [Fact]
    public void ClonePhase_PhaseWithTaskHierarchy_ShouldReturnResetDeepClone()
    {
        var source = Phase(new string('P', 200));
        var root = Task(RootTaskId, "Root task", status: WbsTaskStatus.Completed, progress: 100);
        root.Assignees.Add(Assignee(RootTaskId, ValidAssigneeId));
        root.Assignees.Add(Assignee(RootTaskId, RemovedMemberId));
        var child = Task(
            ChildTaskId,
            "Child task",
            parentTaskId: RootTaskId,
            status: WbsTaskStatus.Obsolete,
            progress: 75);
        child.ObsoleteReason = "No longer required";
        child.IsLocked = true;
        child.Assignees.Add(Assignee(ChildTaskId, RemovedMemberId));
        child.Dependencies.Add(new TaskDependency
        {
            TaskId = ChildTaskId,
            PredecessorTaskId = RootTaskId
        });

        var result = _factory.ClonePhase(
            source,
            orderIndex: 5,
            new[] { root, child },
            new HashSet<long> { ValidAssigneeId });

        result.Should().NotBeSameAs(source);
        result.PhaseId.Should().Be(0);
        result.ProjectId.Should().Be(source.ProjectId);
        result.Name.Should().HaveLength(200).And.EndWith(" (Bản sao)");
        result.Description.Should().Be(source.Description);
        result.OrderIndex.Should().Be(5);
        result.Status.Should().Be(PhaseStatus.Draft);
        result.CreatedAt.Should().Be(default);
        result.UpdatedAt.Should().BeNull();
        result.CreatedBy.Should().BeNull();
        result.UpdatedBy.Should().BeNull();
        result.IsDeleted.Should().BeFalse();
        result.Tasks.Should().HaveCount(2);

        var clonedRoot = result.Tasks.Single(task => task.Name == root.Name);
        var clonedChild = result.Tasks.Single(task => task.Name == child.Name);
        clonedRoot.Should().NotBeSameAs(root);
        clonedRoot.TaskId.Should().Be(0);
        clonedRoot.Phase.Should().BeSameAs(result);
        clonedRoot.Status.Should().Be(WbsTaskStatus.Assigned);
        clonedRoot.ProgressPercent.Should().Be(0);
        clonedRoot.Assignees.Select(assignee => assignee.UserId)
            .Should().Equal(ValidAssigneeId);
        clonedRoot.ProgressLogs.Should().ContainSingle(log =>
            log.OldProgress == 0
            && log.NewProgress == 0
            && log.UpdateReason == "Khởi tạo từ bản sao");

        clonedChild.ParentTask.Should().BeSameAs(clonedRoot);
        clonedChild.Status.Should().Be(WbsTaskStatus.New);
        clonedChild.ProgressPercent.Should().Be(0);
        clonedChild.ObsoleteReason.Should().BeNull();
        clonedChild.IsLocked.Should().BeFalse();
        clonedChild.Assignees.Should().BeEmpty();
        var clonedDependency = clonedChild.Dependencies.Should().ContainSingle().Which;
        clonedDependency.Task.Should().BeSameAs(clonedChild);
        clonedDependency.Predecessor.Should().BeSameAs(clonedRoot);

        source.PhaseId.Should().Be(PhaseId);
        root.TaskId.Should().Be(RootTaskId);
        root.ProgressPercent.Should().Be(100);
        child.TaskId.Should().Be(ChildTaskId);
        child.Status.Should().Be(WbsTaskStatus.Obsolete);
    }

    [Fact]
    public void CloneTaskTree_RootWithChildAndDependencies_ShouldReturnRemappedSubtree()
    {
        const long externalPredecessorId = 29;
        var externalPredecessor = Task(externalPredecessorId, "Earlier task");
        var root = Task(RootTaskId, "Root task", status: WbsTaskStatus.InProgress, progress: 60);
        root.Assignees.Add(Assignee(RootTaskId, ValidAssigneeId));
        root.Assignees.Add(Assignee(RootTaskId, RemovedMemberId));
        root.Dependencies.Add(new TaskDependency
        {
            TaskId = RootTaskId,
            PredecessorTaskId = externalPredecessorId
        });
        var child = Task(
            ChildTaskId,
            "Child task",
            parentTaskId: RootTaskId,
            status: WbsTaskStatus.Completed,
            progress: 100);
        child.IsLocked = true;
        child.Dependencies.Add(new TaskDependency
        {
            TaskId = ChildTaskId,
            PredecessorTaskId = RootTaskId
        });

        var result = _factory.CloneTaskTree(
            new[] { externalPredecessor, root, child },
            RootTaskId,
            rootOrderIndex: 7,
            new HashSet<long> { ValidAssigneeId });

        result.Tasks.Should().HaveCount(2);
        result.Root.Should().BeSameAs(result.Tasks.Single(task => task.Name == "Root task (Bản sao)"));
        result.Root.OrderIndex.Should().Be(7);
        result.Root.ParentTaskId.Should().BeNull();
        result.Root.Status.Should().Be(WbsTaskStatus.Assigned);
        result.Root.ProgressPercent.Should().Be(0);
        result.Root.Assignees.Select(assignee => assignee.UserId)
            .Should().Equal(ValidAssigneeId);
        result.Root.Dependencies.Should().ContainSingle()
            .Which.PredecessorTaskId.Should().Be(externalPredecessorId);

        var clonedChild = result.Tasks.Single(task => task.Name == child.Name);
        clonedChild.ParentTask.Should().BeSameAs(result.Root);
        clonedChild.OrderIndex.Should().Be(child.OrderIndex);
        clonedChild.Status.Should().Be(WbsTaskStatus.New);
        clonedChild.ProgressPercent.Should().Be(0);
        clonedChild.IsLocked.Should().BeFalse();
        var internalDependency = clonedChild.Dependencies.Should().ContainSingle().Which;
        internalDependency.Task.Should().BeSameAs(clonedChild);
        internalDependency.Predecessor.Should().BeSameAs(result.Root);

        result.Tasks.Should().NotContain(task => task.Name == externalPredecessor.Name);
        root.TaskId.Should().Be(RootTaskId);
        child.ParentTaskId.Should().Be(RootTaskId);
    }

    [Fact]
    public void CloneTaskTree_SourceSubtask_ShouldPreserveExternalParent()
    {
        const long parentTaskId = 25;
        var parent = Task(parentTaskId, "Parent task");
        var source = Task(RootTaskId, "Selected child", parentTaskId: parentTaskId);

        var result = _factory.CloneTaskTree(
            new[] { parent, source },
            RootTaskId,
            rootOrderIndex: 4,
            new HashSet<long>());

        result.Tasks.Should().ContainSingle();
        result.Root.Name.Should().Be("Selected child (Bản sao)");
        result.Root.ParentTask.Should().BeNull();
        result.Root.ParentTaskId.Should().Be(parentTaskId);
        result.Root.OrderIndex.Should().Be(4);
    }

    private static Phase Phase(string name) => new()
    {
        PhaseId = PhaseId,
        ProjectId = 10,
        Name = name,
        Description = "Foundation works",
        OrderIndex = 2,
        StartDate = new DateOnly(2026, 8, 1),
        EndDate = new DateOnly(2026, 8, 31),
        Status = PhaseStatus.Approved,
        CreatedAt = new DateTime(2026, 7, 1),
        UpdatedAt = new DateTime(2026, 7, 2),
        CreatedBy = 1,
        UpdatedBy = 2,
        IsDeleted = true
    };

    private static ProjectTask Task(
        long taskId,
        string name,
        long? parentTaskId = null,
        string status = WbsTaskStatus.New,
        byte progress = 0) => new()
    {
        TaskId = taskId,
        PhaseId = PhaseId,
        ParentTaskId = parentTaskId,
        IncidentId = 99,
        Name = name,
        Description = $"Description for {name}",
        OrderIndex = (int)taskId,
        StartDate = new DateOnly(2026, 8, 1),
        EndDate = new DateOnly(2026, 8, 31),
        Status = status,
        ProgressPercent = progress,
        IsLocked = progress > 0,
        Weight = 2,
        CreatedAt = new DateTime(2026, 7, 1),
        UpdatedAt = new DateTime(2026, 7, 2),
        CreatedBy = 1,
        UpdatedBy = 2,
        IsDeleted = true,
        Assignees = new List<TaskAssignee>(),
        ProgressLogs = new List<TaskProgressLog>
        {
            new() { OldProgress = 0, NewProgress = progress, UpdateReason = "Source history" }
        },
        Dependencies = new List<TaskDependency>()
    };

    private static TaskAssignee Assignee(long taskId, long userId) => new()
    {
        TaskId = taskId,
        UserId = userId,
        AssignedAt = new DateTime(2026, 7, 1)
    };
}
