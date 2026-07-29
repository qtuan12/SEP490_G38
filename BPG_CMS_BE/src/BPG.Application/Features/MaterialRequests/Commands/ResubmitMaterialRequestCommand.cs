using MediatR;
using BPG.Application.Common.Models;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.MaterialRequests.Commands
{
    public record ResubmitMaterialRequestCommand(
        long RequestId,
        string Reason,
        List<MaterialRequestItemInput> Items
    ) : IRequest<ApiResponse<bool>>
    {
    }

    public class ResubmitMaterialRequestCommandHandler : IRequestHandler<ResubmitMaterialRequestCommand, ApiResponse<bool>>
    {
        private readonly IUnitOfWork _uow;
        private readonly ICurrentUserService _currentUserService;

        public ResubmitMaterialRequestCommandHandler(IUnitOfWork uow, ICurrentUserService currentUserService)
        {
            _uow = uow;
            _currentUserService = currentUserService;
        }

        public async Task<ApiResponse<bool>> Handle(ResubmitMaterialRequestCommand request, CancellationToken cancellationToken)
        {
            var currentUserId = _currentUserService.GetRequiredUserId();

            if (request.Items == null || !request.Items.Any())
            {
                throw new BusinessException("ERR_ITEMS_REQUIRED", "Pháº£i cÃ³ Ã­t nháº¥t 1 váº­t tÆ° trong Ä‘á» xuáº¥t.");
            }

            var mr = await _uow.Repository<MaterialRequest>().Query()
                .Include(x => x.Phase)
                .Include(x => x.Items)
                .FirstOrDefaultAsync(x => x.RequestId == request.RequestId, cancellationToken);

            if (mr == null)
            {
                throw new NotFoundException(nameof(MaterialRequest), request.RequestId);
            }

            // Chá»‰ ngÆ°á»i táº¡o má»›i Ä‘Æ°á»£c gá»­i láº¡i
            if (mr.CreatedBy != currentUserId)
            {
                throw new ForbiddenException("Báº¡n khÃ´ng cÃ³ quyá»n gá»­i láº¡i yÃªu cáº§u váº­t tÆ° nÃ y. Chá»‰ ngÆ°á»i táº¡o phiáº¿u má»›i Ä‘Æ°á»£c thá»±c hiá»‡n.");
            }

            // Chá»‰ cho phÃ©p gá»­i láº¡i khi Ä‘ang á»Ÿ tráº¡ng thÃ¡i Rejected
            if (mr.Status != MaterialRequestStatus.Rejected)
            {
                throw new BusinessException("ERR_INVALID_STATUS_FOR_RESUBMIT",
                    $"Chá»‰ cÃ³ thá»ƒ gá»­i láº¡i yÃªu cáº§u Ä‘ang á»Ÿ tráº¡ng thÃ¡i Tá»« chá»‘i (Rejected). Tráº¡ng thÃ¡i hiá»‡n táº¡i: {mr.Status}.");
            }

            // Kiá»ƒm tra phase chÆ°a bá»‹ Ä‘Ã³ng bÄƒng
            if (mr.Phase.Status == PhaseStatus.Approved)
            {
                throw new BusinessException("ERR_PHASE_FROZEN", "Giai Ä‘oáº¡n Ä‘Ã£ Ä‘Æ°á»£c nghiá»‡m thu vÃ  Ä‘Ã³ng bÄƒng, khÃ´ng thá»ƒ gá»­i láº¡i yÃªu cáº§u váº­t tÆ°.");
            }

            // Xá»­ lÃ½ danh sÃ¡ch váº­t tÆ° má»›i
            bool anyItemOverBOQ = false;
            var newItems = new List<MaterialRequestItem>();

            foreach (var item in request.Items)
            {
                var materialNameTrim = item.Name.Trim();
                var material = await _uow.Repository<MaterialCatalog>().Query()
                    .FirstOrDefaultAsync(m => m.Name == materialNameTrim, cancellationToken);
                if (material == null)
                {
                    throw new NotFoundException(nameof(MaterialCatalog), item.Name);
                }

                var unitNameTrim = item.Unit.Trim();
                var unit = await _uow.Repository<BPG.Domain.Entities.Unit>().Query()
                    .FirstOrDefaultAsync(u => u.UnitName == unitNameTrim, cancellationToken);
                if (unit == null)
                {
                    throw new NotFoundException(nameof(BPG.Domain.Entities.Unit), item.Unit);
                }

                decimal conversionRate = 1.0m;
                if (material.BaseUnitId != unit.UnitId)
                {
                    var conversion = await _uow.Repository<MaterialConversion>().Query()
                        .FirstOrDefaultAsync(c => c.MaterialId == material.MaterialId && c.AlternativeUnitId == unit.UnitId, cancellationToken);
                    if (conversion == null)
                    {
                        throw new BusinessException("ERR_INVALID_UNIT",
                            $"ÄÆ¡n vá»‹ tÃ­nh '{item.Unit}' khÃ´ng Ä‘Æ°á»£c há»— trá»£ cho váº­t tÆ° '{material.Name}'.");
                    }
                    conversionRate = conversion.ConversionRate;
                }

                decimal qtyInBase = item.Quantity / (conversionRate == 0 ? 1m : conversionRate);

                var boq = await _uow.Repository<BOQItem>().Query()
                    .FirstOrDefaultAsync(b => b.PhaseId == mr.Phase.PhaseId && b.MaterialId == material.MaterialId && !b.IsDeleted, cancellationToken);

                bool isOverBOQ = false;
                if (boq == null)
                {
                    isOverBOQ = true;
                    anyItemOverBOQ = true;
                }
                else
                {
                    decimal boqLimitInBase = boq.Quantity / (boq.ConversionRate == 0 ? 1m : boq.ConversionRate);

                    // TÃ­nh lÅ©y káº¿ sá»‘ lÆ°á»£ng Ä‘Ã£ yÃªu cáº§u á»Ÿ cÃ¡c phiáº¿u KHÃC (khÃ´ng tÃ­nh phiáº¿u Ä‘ang resubmit nÃ y)
                    var totalRequestedBeforeInBase = await _uow.Repository<MaterialRequestItem>().Query()
                        .Where(ri => ri.Request.PhaseId == mr.Phase.PhaseId &&
                                     ri.MaterialId == material.MaterialId &&
                                     ri.RequestId != mr.RequestId &&
                                     ri.Request.Status != MaterialRequestStatus.Rejected &&
                                     ri.Request.Status != MaterialRequestStatus.Cancelled &&
                                     !ri.Request.IsDeleted)
                        .SumAsync(ri => ri.Quantity / (ri.ConversionRate == 0 ? 1m : ri.ConversionRate), cancellationToken);

                    if (totalRequestedBeforeInBase + qtyInBase > boqLimitInBase)
                    {
                        isOverBOQ = true;
                        anyItemOverBOQ = true;
                    }
                }

                newItems.Add(new MaterialRequestItem
                {
                    RequestId = mr.RequestId,
                    MaterialId = material.MaterialId,
                    UnitId = unit.UnitId,
                    Quantity = item.Quantity,
                    ConversionRate = conversionRate,
                    IsOverBOQ = isOverBOQ,
                    Explanation = isOverBOQ ? "YÃªu cáº§u vÆ°á»£t quÃ¡ háº¡n má»©c Ä‘á»‹nh má»©c BOQ cá»§a Phase." : null
                });
            }

            // XÃ³a cÃ¡c item cÅ©
            var oldItems = mr.Items.ToList();
            _uow.Repository<MaterialRequestItem>().RemoveRange(oldItems);

            // Cáº­p nháº­t phiáº¿u: reset vá» Pending Ä‘á»ƒ báº¯t Ä‘áº§u láº¡i quy trÃ¬nh duyá»‡t
            mr.Status = MaterialRequestStatus.Pending;
            mr.BOQCheckStatus = anyItemOverBOQ ? BOQCheckStatus.OverBOQ : BOQCheckStatus.WithinBOQ;
            mr.Reason = request.Reason.Trim();
            mr.CheckedBy = null;
            mr.ApprovedBy = null;
            mr.AccountantNote = null;
            mr.ApprovalNote = null;
            mr.UpdatedAt = DateTime.UtcNow;
            mr.UpdatedBy = currentUserId;

            _uow.Repository<MaterialRequest>().Update(mr);
            await _uow.SaveChangesAsync(cancellationToken);

            // ThÃªm cÃ¡c item má»›i
            foreach (var newItem in newItems)
            {
                newItem.RequestId = mr.RequestId;
            }
            await _uow.Repository<MaterialRequestItem>().AddRangeAsync(newItems, cancellationToken);
            await _uow.SaveChangesAsync(cancellationToken);

            return ApiResponse<bool>.SuccessResult(true, "ÄÃ£ gá»­i láº¡i yÃªu cáº§u váº­t tÆ° thÃ nh cÃ´ng. Phiáº¿u Ä‘ang chá» Káº¿ toÃ¡n xem xÃ©t.");
        }
    }
}

