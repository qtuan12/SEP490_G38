using BPG.Application.IRepositories;
using BPG.Application.Common.Models;
using BPG.Application.DTOs.Surplus;
using BPG.Application.Features.Surplus.Queries;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Surplus.Handlers;

public class GetIncomingTransfersQueryHandler : IRequestHandler<GetIncomingTransfersQuery, ApiResponse<List<IncomingSurplusTransferDto>>>
{
    private readonly IUnitOfWork _uow;

    public GetIncomingTransfersQueryHandler(IUnitOfWork uow)
    {
        _uow = uow;
    }

    public async Task<ApiResponse<List<IncomingSurplusTransferDto>>> Handle(GetIncomingTransfersQuery request, CancellationToken ct)
    {
        var transfers = await _uow.Repository<SurplusTransfer>().Query()
            .Include(t => t.FromProject)
            .Include(t => t.ToProject)
            .Include(t => t.SurplusRequestItem)
                .ThenInclude(i => i.Material)
            .Include(t => t.SurplusRequestItem)
                .ThenInclude(i => i.Unit)
            .Include(t => t.Approver)
            .Where(t => t.ToProjectId == request.ProjectId)
            .OrderByDescending(t => t.CreatedAt)
            .Select(t => new IncomingSurplusTransferDto
            {
                SurplusTransferId = t.SurplusTransferId,
                SurplusRequestItemId = t.SurplusRequestItemId,
                FromProjectId = t.FromProjectId,
                FromProjectName = t.FromProject.Name,
                ToProjectId = t.ToProjectId,
                ToProjectName = t.ToProject.Name,
                TransferQuantity = t.TransferQuantity,
                Status = t.Status.ToString(),
                ApproverName = t.Approver != null ? t.Approver.FullName : null,
                ApprovedAt = t.ApprovedAt,
                DispatchedAt = t.DispatchedAt,
                ReceivedAt = t.ReceivedAt,
                CreatedAt = t.CreatedAt,
                MaterialId = t.SurplusRequestItem.MaterialId,
                MaterialCode = t.SurplusRequestItem.Material.Code,
                MaterialName = t.SurplusRequestItem.Material.Name,
                UnitId = t.SurplusRequestItem.UnitId,
                UnitName = t.SurplusRequestItem.Unit.UnitName
            })
            .ToListAsync(ct);

        return ApiResponse<List<IncomingSurplusTransferDto>>.SuccessResult(transfers);
    }
}
