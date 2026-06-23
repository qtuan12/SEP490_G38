using BPG.Domain.Entities;
using System;
using System.Collections.Generic;
using System.Linq;

namespace BPG.Application.Common.Extensions
{
    public static class ProjectTaskExtensions
    {
        public static double CalculateWeight(this ProjectTask task, IEnumerable<ProjectTask> allTasks)
        {
            var children = allTasks.Where(t => t.ParentTaskId == task.TaskId && t.Status != BPG.Domain.Constants.TaskStatus.Obsolete).ToList();
            if (children.Any())
            {
                return children.Sum(c => c.CalculateWeight(allTasks));
            }
            if (task.Weight.HasValue && task.Weight.Value > 0)
            {
                return (double)task.Weight.Value;
            }
            var duration = (task.EndDate.ToDateTime(TimeOnly.MinValue) - task.StartDate.ToDateTime(TimeOnly.MinValue)).TotalDays + 1;
            return duration > 0 ? duration : 1;
        }
    }
}
