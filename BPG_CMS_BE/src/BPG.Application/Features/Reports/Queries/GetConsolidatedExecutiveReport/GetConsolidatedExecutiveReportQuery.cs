using BPG.Application.Common.Models;
using BPG.Application.DTOs.Reports;
using BPG.Application.Features.Reports.Queries.GetBoqVsActualReport;
using BPG.Application.Features.Reports.Queries.GetConstructionProgressReport;
using BPG.Application.Features.Reports.Queries.GetExecutiveDashboard;
using BPG.Application.Features.Reports.Queries.GetIncidentReport;
using BPG.Application.Features.Reports.Queries.GetProcurementReport;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Reports.Queries.GetConsolidatedExecutiveReport;

public record GetConsolidatedExecutiveReportQuery(long ProjectId, DateTime? FromDate = null, DateTime? ToDate = null)
    : IRequest<ApiResponse<ConsolidatedExecutiveReportDto>>;

public class GetConsolidatedExecutiveReportQueryHandler : IRequestHandler<GetConsolidatedExecutiveReportQuery, ApiResponse<ConsolidatedExecutiveReportDto>>
{
    private readonly IMediator _mediator;
    private readonly IUnitOfWork _unitOfWork;

    public GetConsolidatedExecutiveReportQueryHandler(IMediator mediator, IUnitOfWork unitOfWork)
    {
        _mediator = mediator;
        _unitOfWork = unitOfWork;
    }

    public async Task<ApiResponse<ConsolidatedExecutiveReportDto>> Handle(GetConsolidatedExecutiveReportQuery request, CancellationToken cancellationToken)
    {
        var exec = (await _mediator.Send(new GetExecutiveDashboardQuery(request.ProjectId, request.FromDate, request.ToDate), cancellationToken)).Data
            ?? throw new BusinessException("ERR_REPORT_DATA_EMPTY", "Không tạo được dữ liệu dashboard tổng quan.");
        var progress = (await _mediator.Send(new GetConstructionProgressReportQuery(request.ProjectId, request.FromDate, request.ToDate), cancellationToken)).Data
            ?? throw new BusinessException("ERR_REPORT_DATA_EMPTY", "Không tạo được dữ liệu tiến độ thi công.");
        var boq = (await _mediator.Send(new GetBoqVsActualReportQuery(request.ProjectId, request.FromDate, request.ToDate), cancellationToken)).Data
            ?? throw new BusinessException("ERR_REPORT_DATA_EMPTY", "Không tạo được dữ liệu BOQ.");
        var incident = (await _mediator.Send(new GetIncidentReportQuery(request.ProjectId, request.FromDate, request.ToDate), cancellationToken)).Data
            ?? throw new BusinessException("ERR_REPORT_DATA_EMPTY", "Không tạo được dữ liệu sự cố.");
        var procurement = (await _mediator.Send(new GetProcurementReportQuery(request.ProjectId, request.FromDate, request.ToDate), cancellationToken)).Data
            ?? throw new BusinessException("ERR_REPORT_DATA_EMPTY", "Không tạo được dữ liệu mua sắm.");

        string projName = "Tất cả dự án (Tổng hợp toàn hệ thống)";
        if (request.ProjectId > 0)
        {
            var p = await _unitOfWork.Repository<Project>().GetByIdAsync(request.ProjectId, cancellationToken);
            if (p != null) projName = p.Name;
        }

        // Generate Analytical Executive Insights
        var insights = new List<string>();

        // 1. Progress insight
        if (progress.TotalTasks > 0)
        {
            insights.Add($"Tiến độ tổng thể đạt {progress.OverallProgressPercent}%, đã hoàn thành {progress.DoneTasks}/{progress.TotalTasks} công việc.");
            if (exec.DelayedTasks > 0)
            {
                insights.Add($"Cảnh báo: Có {exec.DelayedTasks} công việc đang trễ hạn và {exec.AtRiskTasks} công việc có nguy cơ trễ hạn cao.");
            }
        }
        else
        {
            insights.Add("Chưa có công việc nào được khởi tạo trong khoảng thời gian này.");
        }

        // 2. Financial / Procurement insight
        insights.Add($"Tổng chi phí mua sắm & phát sinh đã ghi nhận là {procurement.TotalCost:N0} VNĐ (Trong đó PO: {procurement.TotalPoCost:N0} VNĐ, Chi trực tiếp: {procurement.TotalDirectPurchaseCost:N0} VNĐ).");

        // 3. BOQ Variance insight
        if (boq.ExceedingItemsCount > 0)
        {
            insights.Add($"Có {boq.ExceedingItemsCount}/{boq.TotalBoqItemsCount} vật tư vượt định mức BOQ với tổng giá trị vượt {boq.TotalVarianceValue:N0} VNĐ.");
        }
        else
        {
            insights.Add("Tất cả vật tư đều tuân thủ tốt định mức BOQ, không ghi nhận tình trạng lãng phí vượt mức.");
        }

        // 4. Incident insight
        if (incident.TotalIncidents > 0)
        {
            var totalLoss = incident.Incidents.Sum(i => i.EstimatedMaterialLoss ?? 0m);
            insights.Add($"Ghi nhận {incident.TotalIncidents} vụ sự cố ({incident.OpenIncidents} chưa giải quyết), tổng thiệt hại vật tư ước tính {totalLoss:N0} VNĐ.");
        }
        else
        {
            insights.Add("Không ghi nhận sự cố công trình nào phát sinh trong kỳ báo cáo.");
        }

        var dto = new ConsolidatedExecutiveReportDto
        {
            ProjectId = request.ProjectId,
            ProjectName = projName,
            GeneratedAt = DateTime.UtcNow,
            FromDate = request.FromDate,
            ToDate = request.ToDate,
            ExecutiveMetrics = exec,
            ProgressSummary = progress,
            BoqSummary = boq,
            IncidentSummary = incident,
            ProcurementSummary = procurement,
            CrossProjectMatrix = exec.CrossProjectMatrix,
            ExecutiveInsights = insights
        };

        return ApiResponse<ConsolidatedExecutiveReportDto>.SuccessResult(dto);
    }
}
