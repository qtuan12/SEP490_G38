using AutoMapper;
using BPG.Domain.Constants;
using BPG.Domain.Entities;

namespace BPG.Application.Features.Wbs.Services;

public sealed class WbsCloneFactory
{
    private readonly IMapper _mapper;

    public WbsCloneFactory(IMapper mapper)
    {
        _mapper = mapper;
    }

    public Phase ClonePhase(
        Phase source,
        int orderIndex,
        IReadOnlyCollection<ProjectTask> sourceTasks,
        IReadOnlySet<long> validAssigneeIds)
    {
        var clone = _mapper.Map<Phase>(source);
        clone.Name = BuildCopyName(source.Name);
        clone.OrderIndex = orderIndex;
        clone.Status = PhaseStatus.Draft;

        var taskMap = CloneTasks(
            sourceTasks,
            sourceTasks.Select(task => task.TaskId).ToHashSet(),
            targetPhaseId: 0,
            validAssigneeIds,
            preserveExternalParent: false,
            preserveExternalDependencies: false);

        foreach (var task in taskMap.Values)
        {
            task.Phase = clone;
            clone.Tasks.Add(task);
        }

        return clone;
    }

    public TaskCloneResult CloneTaskTree(
        IReadOnlyCollection<ProjectTask> phaseTasks,
        long sourceRootTaskId,
        int rootOrderIndex,
        IReadOnlySet<long> validAssigneeIds)
    {
        var childrenByParent = phaseTasks
            .Where(task => task.ParentTaskId.HasValue)
            .GroupBy(task => task.ParentTaskId!.Value)
            .ToDictionary(group => group.Key, group => group.ToList());

        var selectedTaskIds = new HashSet<long>();
        var pending = new Stack<long>();
        pending.Push(sourceRootTaskId);

        while (pending.TryPop(out var taskId) && selectedTaskIds.Add(taskId))
        {
            if (!childrenByParent.TryGetValue(taskId, out var children)) continue;
            foreach (var child in children)
                pending.Push(child.TaskId);
        }

        var taskMap = CloneTasks(
            phaseTasks,
            selectedTaskIds,
            phaseTasks.First(task => task.TaskId == sourceRootTaskId).PhaseId,
            validAssigneeIds,
            preserveExternalParent: true,
            preserveExternalDependencies: true);

        var root = taskMap[sourceRootTaskId];
        root.Name = BuildCopyName(root.Name);
        root.OrderIndex = rootOrderIndex;

        return new TaskCloneResult(root, taskMap.Values.ToList());
    }

    private Dictionary<long, ProjectTask> CloneTasks(
        IReadOnlyCollection<ProjectTask> phaseTasks,
        IReadOnlySet<long> selectedTaskIds,
        long targetPhaseId,
        IReadOnlySet<long> validAssigneeIds,
        bool preserveExternalParent,
        bool preserveExternalDependencies)
    {
        var selectedTasks = phaseTasks
            .Where(task => selectedTaskIds.Contains(task.TaskId))
            .ToList();
        var phaseTaskIds = phaseTasks.Select(task => task.TaskId).ToHashSet();
        var taskMap = selectedTasks.ToDictionary(
            source => source.TaskId,
            source => CreateTaskClone(source, targetPhaseId, validAssigneeIds));

        foreach (var source in selectedTasks)
        {
            var clone = taskMap[source.TaskId];

            if (source.ParentTaskId.HasValue
                && taskMap.TryGetValue(source.ParentTaskId.Value, out var clonedParent))
            {
                clone.ParentTask = clonedParent;
            }
            else if (preserveExternalParent)
            {
                clone.ParentTaskId = source.ParentTaskId;
            }

            foreach (var dependency in source.Dependencies
                         .GroupBy(item => item.PredecessorTaskId)
                         .Select(group => group.First()))
            {
                if (taskMap.TryGetValue(dependency.PredecessorTaskId, out var clonedPredecessor))
                {
                    clone.Dependencies.Add(new TaskDependency
                    {
                        Task = clone,
                        Predecessor = clonedPredecessor
                    });
                }
                else if (preserveExternalDependencies
                         && phaseTaskIds.Contains(dependency.PredecessorTaskId))
                {
                    clone.Dependencies.Add(new TaskDependency
                    {
                        Task = clone,
                        PredecessorTaskId = dependency.PredecessorTaskId
                    });
                }
            }
        }

        return taskMap;
    }

    private ProjectTask CreateTaskClone(
        ProjectTask source,
        long targetPhaseId,
        IReadOnlySet<long> validAssigneeIds)
    {
        var clone = _mapper.Map<ProjectTask>(source);
        clone.PhaseId = targetPhaseId;
        clone.Status = BPG.Domain.Constants.TaskStatus.New;
        clone.ProgressPercent = 0;
        clone.ObsoleteReason = null;
        clone.IsLocked = false;

        foreach (var userId in source.Assignees
                     .Select(assignee => assignee.UserId)
                     .Where(validAssigneeIds.Contains)
                     .Distinct())
        {
            clone.Assignees.Add(new TaskAssignee
            {
                UserId = userId,
                AssignedAt = DateTime.UtcNow
            });
        }

        if (clone.Assignees.Count > 0)
            clone.Status = BPG.Domain.Constants.TaskStatus.Assigned;

        clone.ProgressLogs.Add(new TaskProgressLog
        {
            OldProgress = 0,
            NewProgress = 0,
            UpdateReason = WbsCloneConstants.InitialProgressReason,
            UpdatedAt = DateTime.UtcNow
        });

        return clone;
    }

    private static string BuildCopyName(string name)
    {
        var baseLength = Math.Max(0, WbsCloneConstants.MaxNameLength - WbsCloneConstants.CopySuffix.Length);
        var baseName = name.Length > baseLength ? name[..baseLength] : name;
        return baseName + WbsCloneConstants.CopySuffix;
    }
}

public sealed record TaskCloneResult(ProjectTask Root, IReadOnlyList<ProjectTask> Tasks);
