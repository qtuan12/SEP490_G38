using BPG.Domain.Common;
using BPG.Domain.Exceptions;
using BPG.Application.Common.Models;
using BPG.Application.Common.Extensions;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using BPG.Application.DTOs.Wbs;
using BPG.Application.Features.Wbs.Queries;

using BPG.Application.IServices;
using BPG.Domain.Constants;

namespace BPG.Application.Features.Wbs.Handlers;

public class GetWbsTreeQueryHandler : IRequestHandler<GetWbsTreeQuery, WbsTreeDto>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ICurrentUserService _currentUserService;
    private readonly IProjectAccessService _projectAccessService;

    public GetWbsTreeQueryHandler(
        IUnitOfWork unitOfWork,
        ICurrentUserService currentUserService,
        IProjectAccessService projectAccessService)
    {
        _unitOfWork = unitOfWork;
        _currentUserService = currentUserService;
        _projectAccessService = projectAccessService;
    }

    public async Task<WbsTreeDto> Handle(GetWbsTreeQuery request, CancellationToken ct)
    {
        var accessibleProjectIds = await _projectAccessService.GetAccessibleProjectIdsAsync(ct);
        if (!accessibleProjectIds.Contains(request.ProjectId))
        {
            throw new ForbiddenException("Bạn không có quyền truy cập vào WBS của dự án này.");
        }

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

        var boqItems = await _unitOfWork.Repository<BOQItem>()
            .Query()
            .AsNoTracking()
            .Include(b => b.Material)
            .Include(b => b.Unit)
            .Where(b => b.Phase.ProjectId == request.ProjectId && !b.IsDeleted)
            .ToListAsync(ct);

        var tasks = await _unitOfWork.Repository<ProjectTask>()
            .Query()
            .AsNoTracking()
            .AsSplitQuery()
            .Include(t => t.Assignees)
                .ThenInclude(a => a.User)
            .Include(t => t.Dependencies)
            .Include(t => t.ProgressLogs)
            .Include(t => t.DailyLogs)
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
                Status = phase.Status,
                Materials = boqItems
                    .Where(b => b.PhaseId == phase.PhaseId)
                    .Select(b => new PhaseMaterialItemDto
                    {
                        MaterialId = b.MaterialId,
                        Name = b.Material.Name,
                        Quantity = b.Quantity,
                        UnitId = b.UnitId,
                        Unit = b.Unit.UnitName,
                        ConversionRate = b.ConversionRate
                    })
                    .ToList()
            };

            // Get root tasks for this phase
            var rootTasks = tasks.Where(t => t.PhaseId == phase.PhaseId && t.ParentTaskId == null).ToList();
            phaseDto.Tasks = BuildTaskTree(rootTasks, tasks, project);

            // Tự động tính toán % Phase
            // Trọng số bằng số ngày thực hiện
            var leafTasks = tasks.Where(t => t.PhaseId == phase.PhaseId && !tasks.Any(c => c.ParentTaskId == t.TaskId) && t.Status != BPG.Domain.Constants.TaskStatus.Obsolete).ToList();
            if (leafTasks.Any())
            {
                double totalWeightedProgress = 0;
                double totalWeight = 0;
                foreach (var t in leafTasks)
                {
                    var duration = (t.EndDate.ToDateTime(TimeOnly.MinValue) - t.StartDate.ToDateTime(TimeOnly.MinValue)).TotalDays + 1;
                    double baseWeight = duration > 0 ? duration : 1;
                    double weight = (t.Weight.HasValue && t.Weight.Value > 0) ? baseWeight * (double)t.Weight.Value : baseWeight;
                    
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
                IsLocked = node.IsLocked,
                AssignedTo = node.Assignees != null && node.Assignees.Any() ? string.Join(",", node.Assignees.Select(a => a.UserId)) : string.Empty,
                AssignedName = node.Assignees != null && node.Assignees.Any() ? string.Join(", ", node.Assignees.Select(a => a.User?.FullName ?? "")) : string.Empty,
                Weight = node.Weight,
                PredecessorTaskIds = node.Dependencies != null ? node.Dependencies.Select(d => d.PredecessorTaskId).ToList() : new(),
                IsOutsourced = node.IsOutsourced,
                OutsourcedTeamName = node.OutsourcedTeamName,
                OutsourcedTeamContact = node.OutsourcedTeamContact,
                ObsoleteReason = node.ObsoleteReason
            };

            var firstProgressDate1 = node.ProgressLogs.Where(l => l.NewProgress > 0).OrderBy(l => l.CreatedAt).Select(l => l.CreatedAt).FirstOrDefault();
            var firstProgressDate2 = node.DailyLogs.Where(l => l.NewProgressPercent > 0).OrderBy(l => l.CreatedAt).Select(l => l.CreatedAt).FirstOrDefault();
            
            DateTime? actualStart = null;
            if (firstProgressDate1 != default && firstProgressDate2 != default) {
                actualStart = firstProgressDate1 < firstProgressDate2 ? firstProgressDate1 : firstProgressDate2;
            } else if (firstProgressDate1 != default) {
                actualStart = firstProgressDate1;
            } else if (firstProgressDate2 != default) {
                actualStart = firstProgressDate2;
            }

            var lastCompleteDate1 = node.ProgressLogs.Where(l => l.NewProgress == 100).OrderByDescending(l => l.CreatedAt).Select(l => l.CreatedAt).FirstOrDefault();
            var lastCompleteDate2 = node.DailyLogs.Where(l => l.NewProgressPercent == 100).OrderByDescending(l => l.CreatedAt).Select(l => l.CreatedAt).FirstOrDefault();

            DateTime? actualEnd = null;
            if (lastCompleteDate1 != default && lastCompleteDate2 != default) {
                actualEnd = lastCompleteDate1 > lastCompleteDate2 ? lastCompleteDate1 : lastCompleteDate2;
            } else if (lastCompleteDate1 != default) {
                actualEnd = lastCompleteDate1;
            } else if (lastCompleteDate2 != default) {
                actualEnd = lastCompleteDate2;
            }
            
            if (actualStart.HasValue) dto.ActualStartDate = DateOnly.FromDateTime(actualStart.Value);
            if (actualEnd.HasValue) dto.ActualEndDate = DateOnly.FromDateTime(actualEnd.Value);

            var taskDeadline = node.EndDate.ToDateTime(new TimeOnly(23, 59, 59));
            var projectStart = project.PlannedStart.ToDateTime(TimeOnly.MinValue);
            var today = VietnamTime.Now;

            if (node.Status != BPG.Domain.Constants.TaskStatus.Obsolete)
            {
                if (today > taskDeadline && node.ProgressPercent < 100)
                {
                    dto.IsOverdue = true;
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

                    if (!dto.IsOverdue && dto.DaysLeft <= 1 && node.ProgressPercent < 90)
                    {
                        dto.IsAtRisk = true;
                    }
                }
            }

            var children = allTasks.Where(t => t.ParentTaskId == node.TaskId).ToList();
            if (children.Any())
            {
                dto.SubTasks = BuildTaskTree(children, allTasks, project);

                // For parent tasks, derive ActualStartDate and ActualEndDate from subtasks
                var childStarts = dto.SubTasks.Where(c => c.ActualStartDate.HasValue).Select(c => c.ActualStartDate.Value).ToList();
                if (childStarts.Any())
                {
                    dto.ActualStartDate = childStarts.Min();
                }

                if (dto.ProgressPercent == 100)
                {
                    var childEnds = dto.SubTasks.Where(c => c.ActualEndDate.HasValue).Select(c => c.ActualEndDate.Value).ToList();
                    if (childEnds.Any())
                    {
                        dto.ActualEndDate = childEnds.Max();
                    }
                }
            }

            result.Add(dto);
        }
        return result;
    }
}
