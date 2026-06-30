using BPG.Application.IRepositories;
using BPG.Application.Common.Models;
using BPG.Application.DTOs.Reports;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Reports.Queries.GetGanttChartData;

public record GetGanttChartDataQuery(long ProjectId) : IRequest<ApiResponse<GanttChartDataDto>>;

public class GetGanttChartDataQueryHandler : IRequestHandler<GetGanttChartDataQuery, ApiResponse<GanttChartDataDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetGanttChartDataQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<ApiResponse<GanttChartDataDto>> Handle(GetGanttChartDataQuery request, CancellationToken cancellationToken)
    {
        var phases = await _unitOfWork.Repository<Phase>()
            .Query()
            .Include(p => p.Tasks.Where(t => t.Status != "Obsolete"))
            .Where(p => p.ProjectId == request.ProjectId)
            .OrderBy(p => p.StartDate)
            .ToListAsync(cancellationToken);

        var currentDate = DateTime.UtcNow.Date;
        var dto = new GanttChartDataDto();

        foreach (var phase in phases)
        {
            var phaseDto = new GanttPhaseDto
            {
                PhaseId = phase.PhaseId,
                PhaseName = phase.Name,
                BaselineStart = phase.StartDate?.ToDateTime(TimeOnly.MinValue) ?? DateTime.MinValue,
                BaselineEnd = phase.EndDate?.ToDateTime(TimeOnly.MinValue) ?? DateTime.MinValue,
                Status = phase.Status
            };

            foreach (var task in phase.Tasks.OrderBy(t => t.StartDate))
            {
                var taskDto = new GanttTaskDto
                {
                    TaskId = task.TaskId,
                    TaskName = task.Name,
                    BaselineStart = task.StartDate.ToDateTime(TimeOnly.MinValue),
                    BaselineEnd = task.EndDate.ToDateTime(TimeOnly.MinValue),
                    Progress = task.ProgressPercent,
                    Status = task.Status,
                    IsDelayed = currentDate > task.EndDate.ToDateTime(TimeOnly.MinValue).Date && task.ProgressPercent < 100
                };
                phaseDto.Tasks.Add(taskDto);
            }

            dto.Phases.Add(phaseDto);
        }

        return ApiResponse<GanttChartDataDto>.SuccessResult(dto);
    }
}
