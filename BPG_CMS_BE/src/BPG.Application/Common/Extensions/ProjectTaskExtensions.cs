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
            var children = allTasks.Where(c => c.ParentTaskId == task.TaskId).ToList();
            if (children.Any())
            {
                return children.Sum(c => c.CalculateWeight(allTasks));
            }

            var duration = (task.EndDate.ToDateTime(TimeOnly.MinValue) - task.StartDate.ToDateTime(TimeOnly.MinValue)).TotalDays + 1;
            var baseWeight = duration > 0 ? duration : 1;

            if (task.Weight.HasValue && task.Weight.Value > 0)
            {
                return baseWeight * (double)task.Weight.Value;
            }
            return baseWeight;
        }
    }
}
