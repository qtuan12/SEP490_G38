using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace BPG.Infrastructure.Services;

public class ProgressRollupService : IProgressRollupService
{
    private readonly IUnitOfWork _unitOfWork;

    public ProgressRollupService(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task RecalculateParentTaskProgressAsync(long parentTaskId, CancellationToken ct = default)
    {
        var parentTask = await _unitOfWork.Repository<ProjectTask>()
            .Query()
            .FirstOrDefaultAsync(t => t.TaskId == parentTaskId, ct);

        if (parentTask == null) return;

        var allTasks = await _unitOfWork.Repository<ProjectTask>()
            .Query()
            .Where(t => t.PhaseId == parentTask.PhaseId && t.Status != BPG.Domain.Constants.TaskStatus.Obsolete)
            .ToListAsync(ct);

        double CalculateWeight(ProjectTask task)
        {
            var children = allTasks.Where(c => c.ParentTaskId == task.TaskId).ToList();
            if (children.Any())
            {
                return children.Sum(CalculateWeight);
            }
            var duration = (task.EndDate.ToDateTime(TimeOnly.MinValue) - task.StartDate.ToDateTime(TimeOnly.MinValue)).TotalDays + 1;
            return duration > 0 ? duration : 1;
        }

        var directChildren = allTasks.Where(t => t.ParentTaskId == parentTaskId).ToList();

        if (directChildren.Count == 0)
        {
            parentTask.ProgressPercent = 0;
            return;
        }

        double totalWeightedProgress = 0;
        double totalWeight = 0;

        foreach (var task in directChildren)
        {
            double weight = CalculateWeight(task);
            totalWeightedProgress += task.ProgressPercent * weight;
            totalWeight += weight;
        }

        if (totalWeight > 0)
        {
            var newProgress = (byte)Math.Round(totalWeightedProgress / totalWeight);
            parentTask.ProgressPercent = newProgress;
            
            if (parentTask.ParentTaskId.HasValue)
            {
                await RecalculateParentTaskProgressAsync(parentTask.ParentTaskId.Value, ct);
            }
        }
    }
}
