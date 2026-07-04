using BPG.Application.Common.Models;
using BPG.Application.Features.Surplus.DTOs;
using BPG.Application.Features.Surplus.Queries;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Surplus.Handlers;

public class GetSurplusActionListQueryHandler : IRequestHandler<GetSurplusActionListQuery, ApiResponse<SurplusActionListDto>>
{
    private readonly IUnitOfWork _uow;

    public GetSurplusActionListQueryHandler(IUnitOfWork uow) => _uow = uow;

    public async Task<ApiResponse<SurplusActionListDto>> Handle(GetSurplusActionListQuery request, CancellationToken ct)
    {
        var item = await _uow.Repository<SurplusRequestItem>().Query()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.SurplusRequestItemId == request.SurplusRequestItemId, ct)
            ?? throw new NotFoundException(nameof(SurplusRequestItem), request.SurplusRequestItemId);

        var returns = await _uow.Repository<SurplusReturnSupplier>().Query()
            .Include(r => r.Supplier)
            .Where(r => r.SurplusRequestItemId == request.SurplusRequestItemId)
            .AsNoTracking()
            .Select(r => new SurplusReturnSupplierDto
            {
                SurplusReturnSupplierId = r.SurplusReturnSupplierId,
                SurplusRequestItemId = r.SurplusRequestItemId,
                SupplierId = r.SupplierId,
                SupplierName = r.Supplier != null ? r.Supplier.SupplierName : null,
                ReturnQuantity = r.ReturnQuantity,
                RefundAmount = r.RefundAmount,
                Note = r.Note,
                CreatedAt = r.CreatedAt
            }).ToListAsync(ct);

        var transfers = await _uow.Repository<SurplusTransfer>().Query()
            .Include(t => t.FromProject)
            .Include(t => t.ToProject)
            .Include(t => t.Approver)
            .Where(t => t.SurplusRequestItemId == request.SurplusRequestItemId)
            .AsNoTracking()
            .Select(t => new SurplusTransferDto
            {
                SurplusTransferId = t.SurplusTransferId,
                SurplusRequestItemId = t.SurplusRequestItemId,
                FromProjectId = t.FromProjectId,
                FromProjectName = t.FromProject.Name,
                ToProjectId = t.ToProjectId,
                ToProjectName = t.ToProject.Name,
                TransferQuantity = t.TransferQuantity,
                Status = t.Status,
                ApproverName = t.Approver != null ? t.Approver.FullName : null,
                ApprovedAt = t.ApprovedAt,
                DispatchedAt = t.DispatchedAt,
                ReceivedAt = t.ReceivedAt,
                CreatedAt = t.CreatedAt
            }).ToListAsync(ct);

        var liquidations = await _uow.Repository<SurplusLiquidation>().Query()
            .Where(l => l.SurplusRequestItemId == request.SurplusRequestItemId)
            .AsNoTracking()
            .Select(l => new SurplusLiquidationDto
            {
                SurplusLiquidationId = l.SurplusLiquidationId,
                SurplusRequestItemId = l.SurplusRequestItemId,
                BuyerName = l.BuyerName,
                LiquidationQuantity = l.LiquidationQuantity,
                TotalAmount = l.TotalAmount,
                CreatedAt = l.CreatedAt
            }).ToListAsync(ct);

        var dto = new SurplusActionListDto
        {
            SurplusRequestItemId = request.SurplusRequestItemId,
            Returns = returns,
            Transfers = transfers,
            Liquidations = liquidations
        };

        return ApiResponse<SurplusActionListDto>.SuccessResult(dto);
    }
}
