using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Application.Common.Extensions;
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

            var duration = (task.EndDate.ToDateTime(TimeOnly.MinValue) - task.StartDate.ToDateTime(TimeOnly.MinValue)).TotalDays + 1;
            var baseWeight = duration > 0 ? duration : 1;

            if (task.Weight.HasValue && task.Weight.Value > 0)
            {
                return baseWeight * (double)task.Weight.Value;
            }
            return baseWeight;
        }

        var directChildren = allTasks.Where(t => t.ParentTaskId == parentTaskId).ToList();

        // Find the base progress of the parent task (the latest progress update that wasn't an automatic rollup)
        byte baseProgress = 0;
        var baseLog = await _unitOfWork.Repository<TaskProgressLog>()
            .Query()
            .Where(l => l.TaskId == parentTaskId && (l.UpdateReason == null || !l.UpdateReason.Contains("Cập nhật tự động do công việc con")))
            .OrderByDescending(l => l.UpdatedAt)
            .FirstOrDefaultAsync(ct);
            
        if (baseLog != null)
        {
            baseProgress = baseLog.NewProgress;
        }

        if (directChildren.Count == 0)
        {
            if (parentTask.ProgressPercent != baseProgress)
            {
                var log = new TaskProgressLog
                {
                    TaskId = parentTask.TaskId,
                    OldProgress = parentTask.ProgressPercent,
                    NewProgress = baseProgress,
                    UpdateReason = "Cập nhật tự động do tất cả công việc con bị xóa",
                    UpdatedAt = DateTime.UtcNow
                };
                await _unitOfWork.Repository<TaskProgressLog>().AddAsync(log, ct);
                
                parentTask.ProgressPercent = baseProgress;
                if (baseProgress > 0 && baseProgress < 100 && parentTask.Status == BPG.Domain.Constants.TaskStatus.Assigned)
                {
                    parentTask.Status = BPG.Domain.Constants.TaskStatus.InProgress;
                }
                
                await _unitOfWork.SaveChangesAsync(ct);
                
                if (parentTask.ParentTaskId.HasValue)
                {
                    await RecalculateParentTaskProgressAsync(parentTask.ParentTaskId.Value, parentTask.TaskId, ct);
                }
            }
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
            var subtasksProgress = totalWeightedProgress / totalWeight;
            var newProgress = (byte)Math.Round(baseProgress + (100 - baseProgress) * (subtasksProgress / 100.0));
            
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
