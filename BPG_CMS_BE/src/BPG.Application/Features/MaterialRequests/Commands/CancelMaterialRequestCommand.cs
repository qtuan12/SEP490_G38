using MediatR;
using BPG.Application.Common.Models;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.MaterialRequests.Commands
{
    public record CancelMaterialRequestCommand(long RequestId, string Reason)
        : IRequest<ApiResponse<bool>>
    {
    }

    public class CancelMaterialRequestCommandHandler : IRequestHandler<CancelMaterialRequestCommand, ApiResponse<bool>>
    {
        private readonly IUnitOfWork _uow;
        private readonly ICurrentUserService _currentUserService;

        public CancelMaterialRequestCommandHandler(
            IUnitOfWork uow,
            ICurrentUserService currentUserService)
        {
            _uow = uow;
            _currentUserService = currentUserService;
        }

        public async Task<ApiResponse<bool>> Handle(CancelMaterialRequestCommand request, CancellationToken cancellationToken)
        {
            var currentUserId = _currentUserService.GetRequiredUserId();

            var mr = await _uow.Repository<MaterialRequest>().Query()
                .Include(x => x.Phase)
                .FirstOrDefaultAsync(x => x.RequestId == request.RequestId, cancellationToken);

            if (mr == null)
            {
                throw new NotFoundException(nameof(MaterialRequest), request.RequestId);
            }

            var isManager = _currentUserService.IsInAnyRole(BPG.Domain.Constants.UserRole.Admin, BPG.Domain.Constants.UserRole.TechnicalManager);
            var isProjectLeader = await _uow.Repository<ProjectMember>().Query()
                .AnyAsync(
                    m => m.ProjectId == mr.Phase.ProjectId
                        && m.UserId == currentUserId
                        && m.IsLeader,
                    cancellationToken);
            if (mr.CreatedBy != currentUserId && !isManager && !isProjectLeader)
            {
                throw new ForbiddenException("Báº¡n khÃ´ng cÃ³ quyá»n há»§y yÃªu cáº§u váº­t tÆ° nÃ y.");
            }

            // Chá»‰ cho phÃ©p há»§y khi Ä‘ang chá» duyá»‡t
            if (mr.Status != MaterialRequestStatus.Pending && mr.Status != MaterialRequestStatus.WaitingApproval)
            {
                throw new BusinessException("ERR_INVALID_STATUS_FOR_CANCEL", 
                    $"KhÃ´ng thá»ƒ há»§y yÃªu cáº§u váº­t tÆ° Ä‘ang á»Ÿ tráº¡ng thÃ¡i: {mr.Status}. Chá»‰ há»— trá»£ há»§y phiáº¿u á»Ÿ tráº¡ng thÃ¡i Chá» duyá»‡t (Pending) hoáº·c Chá» GiÃ¡m Ä‘á»‘c (WaitingApproval).");
            }

            mr.Status = MaterialRequestStatus.Cancelled;
            mr.AccountantNote = string.IsNullOrWhiteSpace(request.Reason) 
                ? "Há»§y yÃªu cáº§u" 
                : request.Reason.Trim();
            mr.UpdatedAt = DateTime.UtcNow;
            mr.UpdatedBy = currentUserId;

            _uow.Repository<MaterialRequest>().Update(mr);
            await _uow.SaveChangesAsync(cancellationToken);

            return ApiResponse<bool>.SuccessResult(true, "Há»§y yÃªu cáº§u váº­t tÆ° thÃ nh cÃ´ng.");
        }
    }
}



