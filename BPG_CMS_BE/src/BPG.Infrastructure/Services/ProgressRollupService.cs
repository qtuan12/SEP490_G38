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

    public async Task RecalculateParentTaskProgressAsync(long parentTaskId, long? triggeringChildTaskId = null, CancellationToken ct = default)
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
            if (task.Weight.HasValue && task.Weight.Value > 0)
            {
                return (double)task.Weight.Value;
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
            
            if (newProgress != parentTask.ProgressPercent)
            {
                string? reason = null;
                if (triggeringChildTaskId.HasValue)
                {
                    var triggerTask = allTasks.FirstOrDefault(t => t.TaskId == triggeringChildTaskId.Value);
                    if (triggerTask != null)
                    {
                        reason = $"Cập nhật tự động do công việc con '{triggerTask.Name}' thay đổi tiến độ";
                    }
                }

                var log = new TaskProgressLog
                {
                    TaskId = parentTask.TaskId,
                    OldProgress = parentTask.ProgressPercent,
                    NewProgress = newProgress,
                    UpdateReason = reason ?? "Cập nhật tự động do công việc con thay đổi",
                    UpdatedAt = DateTime.UtcNow
                };
                
                await _unitOfWork.Repository<TaskProgressLog>().AddAsync(log, ct);
                
                parentTask.ProgressPercent = newProgress;
                
                if (newProgress > 0 && newProgress < 100 && parentTask.Status == BPG.Domain.Constants.TaskStatus.Assigned)
                {
                    parentTask.Status = BPG.Domain.Constants.TaskStatus.InProgress;
                }
                else if (newProgress == 100 && parentTask.Status == BPG.Domain.Constants.TaskStatus.InProgress)
                {
                    parentTask.Status = BPG.Domain.Constants.TaskStatus.Completed;
                }
                
                _unitOfWork.Repository<ProjectTask>().Update(parentTask);
                
                if (parentTask.ParentTaskId.HasValue)
                {
                    await RecalculateParentTaskProgressAsync(parentTask.ParentTaskId.Value, triggeringChildTaskId, ct);
                }
            }
        }
    }
}
