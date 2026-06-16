using BPG.Domain.Exceptions;
using BPG.Application.Common.Models;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Wbs.Queries.GetWbsTree;

public record GetWbsTreeQuery(long ProjectId) : IRequest<WbsTreeDto>;

public class GetWbsTreeQueryHandler : IRequestHandler<GetWbsTreeQuery, WbsTreeDto>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetWbsTreeQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<WbsTreeDto> Handle(GetWbsTreeQuery request, CancellationToken ct)
    {
        var project = await _unitOfWork.Repository<Project>()
            .Query()
            .FirstOrDefaultAsync(p => p.ProjectId == request.ProjectId, ct);

        if (project == null)
            throw new NotFoundException("Project", request.ProjectId);

        var phases = await _unitOfWork.Repository<Phase>()
            .Query()
            .Where(p => p.ProjectId == request.ProjectId)
            .OrderBy(p => p.OrderIndex)
            .ToListAsync(ct);

        var tasks = await _unitOfWork.Repository<ProjectTask>()
            .Query()
            .Where(t => t.Phase.ProjectId == request.ProjectId)
            .OrderBy(t => t.OrderIndex)
            .ToListAsync(ct);

        var result = new WbsTreeDto { ProjectId = request.ProjectId };

        foreach (var phase in phases)
        {
            var phaseDto = new WbsPhaseDto
            {
                PhaseId = phase.PhaseId,
                ProjectId = phase.ProjectId,
                Name = phase.Name,
                Description = phase.Description,
                OrderIndex = phase.OrderIndex,
                StartDate = phase.StartDate,
                EndDate = phase.EndDate,
                Status = phase.Status
            };

            // Get root tasks for this phase
            var rootTasks = tasks.Where(t => t.PhaseId == phase.PhaseId && t.ParentTaskId == null).ToList();
            phaseDto.Tasks = BuildTaskTree(rootTasks, tasks, project);

            // Tự động tính toán % Phase
            // Trọng số bằng số ngày thực hiện
            var activeTasks = tasks.Where(t => t.PhaseId == phase.PhaseId && t.ParentTaskId == null && t.Status != BPG.Domain.Constants.TaskStatus.Obsolete).ToList();
            if (activeTasks.Any())
            {
                double totalWeightedProgress = 0;
                double totalWeight = 0;
                foreach (var t in activeTasks)
                {
                    double weight = CalculateWeight(t, tasks);
                    totalWeightedProgress += t.ProgressPercent * weight;
                    totalWeight += weight;
                }
                phaseDto.ProgressPercent = totalWeight > 0 ? (byte)Math.Round(totalWeightedProgress / totalWeight) : (byte)0;
            }
            else
            {
                phaseDto.ProgressPercent = 0;
            }

            result.Phases.Add(phaseDto);
        }

        return result;
    }

    private double CalculateWeight(ProjectTask task, List<ProjectTask> allTasks)
    {
        var children = allTasks.Where(t => t.ParentTaskId == task.TaskId && t.Status != BPG.Domain.Constants.TaskStatus.Obsolete).ToList();
        if (children.Any())
        {
            return children.Sum(c => CalculateWeight(c, allTasks));
        }
        var duration = (task.EndDate.ToDateTime(TimeOnly.MinValue) - task.StartDate.ToDateTime(TimeOnly.MinValue)).TotalDays + 1;
        return duration > 0 ? duration : 1;
    }

    private List<WbsTaskDto> BuildTaskTree(List<ProjectTask> nodes, List<ProjectTask> allTasks, Project project)
    {
        var result = new List<WbsTaskDto>();
        foreach (var node in nodes)
        {
            var dto = new WbsTaskDto
            {
                TaskId = node.TaskId,
                PhaseId = node.PhaseId,
                ParentTaskId = node.ParentTaskId,
                Name = node.Name,
                Description = node.Description,
                OrderIndex = node.OrderIndex,
                StartDate = node.StartDate,
                EndDate = node.EndDate,
                Status = node.Status,
                ProgressPercent = node.ProgressPercent,
                IsLocked = node.IsLocked
            };

            var taskDeadline = node.EndDate.ToDateTime(new TimeOnly(23, 59, 59));
            var projectStart = project.StartDate.ToDateTime(TimeOnly.MinValue);
            var today = DateTime.Now;

            if (node.Status != BPG.Domain.Constants.TaskStatus.Obsolete)
            {
                if (today > taskDeadline && node.ProgressPercent < 100)
                {
                    dto.IsOverdue = true;
                }
                
                var totalMs = (taskDeadline - projectStart).TotalMilliseconds;
                var passedMs = (today - projectStart).TotalMilliseconds;
                double expected = totalMs > 0 ? Math.Min(100, Math.Max(0, (passedMs / totalMs) * 100)) : 0;

                if (!dto.IsOverdue && node.ProgressPercent < 100 && node.ProgressPercent < expected - 1)
                {
                    dto.IsAtRisk = true;
                }

                if (node.ProgressPercent < 100)
                {
                    var daysLeft = (taskDeadline - today).TotalDays;
                    if (daysLeft >= 0)
                    {
                        dto.DaysLeft = (int)Math.Floor(daysLeft);
                    }
                    else
                    {
                        dto.DaysLeft = (int)Math.Ceiling(daysLeft);
                    }
                }
            }

            var children = allTasks.Where(t => t.ParentTaskId == node.TaskId).ToList();
            if (children.Any())
            {
                dto.SubTasks = BuildTaskTree(children, allTasks, project);
            }

            result.Add(dto);
        }
        return result;
    }
}
