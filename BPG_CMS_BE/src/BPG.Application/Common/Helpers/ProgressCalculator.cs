using System;
using System.Collections.Generic;
using System.Linq;
using BPG.Domain.Entities;
using TaskStatus = BPG.Domain.Constants.TaskStatus;

namespace BPG.Application.Common.Helpers;

public static class ProgressCalculator
{
    public static bool IsCompleted(string status)
    {
        return status == TaskStatus.Completed || status == TaskStatus.Approved || status == "Done" || status == "Accepted";
    }

    public static bool IsInProgress(string status)
    {
        return status == TaskStatus.InProgress;
    }

    public static decimal GetEffectiveProgress(ProjectTask task)
    {
        if (IsCompleted(task.Status)) return 100m;
        return task.ProgressPercent;
    }

    public static decimal GetEffectiveWeight(ProjectTask task)
    {
        if (task.Weight.HasValue && task.Weight.Value > 0)
        {
            return task.Weight.Value;
        }
        return 1.0m;
    }

    public static decimal CalculateWeightedProgress(IEnumerable<ProjectTask> tasks)
    {
        var validTasks = tasks.Where(t => t.Status != TaskStatus.Obsolete).ToList();
        if (!validTasks.Any()) return 0m;

        decimal totalWeight = validTasks.Sum(t => GetEffectiveWeight(t));
        if (totalWeight <= 0) return 0m;

        decimal weightedSum = validTasks.Sum(t => GetEffectiveWeight(t) * GetEffectiveProgress(t));
        return Math.Round(weightedSum / totalWeight, 1);
    }
}
