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

    public static decimal GetWbsEffectiveWeight(ProjectTask task)
    {
        var durationDays = task.EndDate.DayNumber - task.StartDate.DayNumber + 1;
        var durationWeight = Math.Max(1, durationDays);
        return task.Weight.HasValue && task.Weight.Value > 0m
            ? durationWeight * task.Weight.Value
            : durationWeight;
    }

    public static decimal CalculateWbsWeightedProgress(
        IEnumerable<ProjectTask> tasks,
        Func<ProjectTask, decimal>? progressSelector = null)
    {
        var validTasks = tasks.Where(t => t.Status != TaskStatus.Obsolete).ToList();
        if (validTasks.Count == 0) return 0m;

        var totalWeight = validTasks.Sum(GetWbsEffectiveWeight);
        if (totalWeight <= 0m) return 0m;

        progressSelector ??= GetEffectiveProgress;
        return Math.Round(
            validTasks.Sum(t => GetWbsEffectiveWeight(t) * progressSelector(t)) / totalWeight,
            1);
    }

    public static decimal CalculateExpectedTaskProgress(ProjectTask task, DateTime now)
    {
        var sDate = task.StartDate.ToDateTime(TimeOnly.MinValue);
        var eDate = task.EndDate.ToDateTime(TimeOnly.MaxValue);
        var totalDays = (eDate - sDate).TotalDays;

        if (totalDays <= 0) return 100m;
        if (now < sDate) return 0m;
        if (now >= eDate) return 100m;

        var elapsedDays = (now - sDate).TotalDays;
        return Math.Min(100m, Math.Max(0m, Math.Round((decimal)(elapsedDays / totalDays) * 100m, 1)));
    }

    public static decimal CalculateWeightedExpectedProgress(IEnumerable<ProjectTask> tasks, DateTime now)
    {
        var validTasks = tasks.Where(t => t.Status != TaskStatus.Obsolete).ToList();
        if (!validTasks.Any()) return 0m;

        decimal totalWeight = validTasks.Sum(t => GetEffectiveWeight(t));
        if (totalWeight <= 0) return 0m;

        decimal weightedSum = validTasks.Sum(t => GetEffectiveWeight(t) * CalculateExpectedTaskProgress(t, now));
        return Math.Round(weightedSum / totalWeight, 1);
    }

    public static decimal CalculateWbsWeightedExpectedProgress(IEnumerable<ProjectTask> tasks, DateTime asOf)
    {
        var validTasks = tasks.Where(t => t.Status != TaskStatus.Obsolete).ToList();
        if (validTasks.Count == 0) return 0m;

        var totalWeight = validTasks.Sum(GetWbsEffectiveWeight);
        if (totalWeight <= 0m) return 0m;

        return Math.Round(
            validTasks.Sum(t => GetWbsEffectiveWeight(t) * CalculateExpectedTaskProgress(t, asOf)) / totalWeight,
            1);
    }
}
