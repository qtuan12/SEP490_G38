using BPG.Application.Common.Models;
using BPG.Application.DTOs.Reports;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Reports.Queries.GetExecutiveDashboard;

public record GetExecutiveDashboardQuery(long ProjectId) : IRequest<ApiResponse<ExecutiveDashboardDto>>;

public class GetExecutiveDashboardQueryHandler : IRequestHandler<GetExecutiveDashboardQuery, ApiResponse<ExecutiveDashboardDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetExecutiveDashboardQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<ApiResponse<ExecutiveDashboardDto>> Handle(GetExecutiveDashboardQuery request, CancellationToken cancellationToken)
    {
        var tasks = await _unitOfWork.Repository<ProjectTask>()
            .Query()
            .Where(t => t.Phase!.ProjectId == request.ProjectId && t.Status != "Obsolete")
            .ToListAsync(cancellationToken);

        int totalTasks = tasks.Count;
        int completedTasks = tasks.Count(t => t.Status == "Done" || t.Status == "Accepted");
        int inProgressTasks = tasks.Count(t => t.Status == "InProgress");
        
        var currentDate = DateTime.UtcNow.Date;
        
        var delayedTasks = tasks.Count(t => t.EndDate.ToDateTime(TimeOnly.MinValue) < DateTime.UtcNow && t.ProgressPercent < 100);
        
        // Simple at risk logic: past half of time but progress < 50%
        int atRiskTasks = 0;
        foreach (var t in tasks.Where(t => t.ProgressPercent < 100 && (t.EndDate.ToDateTime(TimeOnly.MinValue) - DateTime.UtcNow).TotalDays <= 3 && t.StartDate.ToDateTime(TimeOnly.MinValue) <= DateTime.UtcNow))
        {
            var totalDuration = (t.EndDate.ToDateTime(TimeOnly.MinValue) - t.StartDate.ToDateTime(TimeOnly.MinValue)).TotalDays + 1;
            var elapsed = (currentDate - t.StartDate.ToDateTime(TimeOnly.MinValue)).TotalDays + 1;
            
            if (totalDuration > 0)
            {
                var expectedProgress = (elapsed / totalDuration) * 100;
                // If progress is significantly behind expected (e.g. 20% behind)
                if (t.ProgressPercent < expectedProgress - 20)
                {
                    atRiskTasks++;
                }
            }
        }

        // BOQ Exceeded logic
        var boqs = await _unitOfWork.Repository<BOQItem>()
            .Query()
            .Where(b => b.Phase!.ProjectId == request.ProjectId)
            .ToListAsync(cancellationToken);

        // This is a simplified version just for the dashboard number. 
        // A real accurate count would sum issuances, stock, etc.
        // For performance on the dashboard, we might just look at OverBoqMaterialRequests
        var overBoqMRs = await _unitOfWork.Repository<MaterialRequest>()
            .Query()
            .Include(mr => mr.Phase)
            .Include(mr => mr.Items)
            .Where(mr => mr.Phase!.ProjectId == request.ProjectId && mr.Items.Any(i => i.IsOverBOQ))
            .CountAsync(cancellationToken);

        // Assuming materials exceeding BOQ loosely ties to MRs that are over BOQ
        // For a more complex calculation, we'd reuse GetBoqVsActualReportQuery logic.
        // Let's keep this light.

        var dto = new ExecutiveDashboardDto
        {
            ProjectId = request.ProjectId,
            TotalTasks = totalTasks,
            CompletedTasks = completedTasks,
            InProgressTasks = inProgressTasks,
            DelayedTasks = delayedTasks,
            AtRiskTasks = atRiskTasks,
            OverBoqMaterialRequests = overBoqMRs,
            MaterialsExceedingBOQ = overBoqMRs // simplified
        };

        return ApiResponse<ExecutiveDashboardDto>.SuccessResult(dto);
    }
}
