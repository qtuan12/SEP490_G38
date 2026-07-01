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
    public record RejectMaterialRequestCommand(long RequestId, string Reason) : IRequest<ApiResponse<bool>>;

    public class RejectMaterialRequestCommandHandler : IRequestHandler<RejectMaterialRequestCommand, ApiResponse<bool>>
    {
        private readonly IUnitOfWork _uow;
        private readonly ICurrentUserService _currentUserService;

        public RejectMaterialRequestCommandHandler(IUnitOfWork uow, ICurrentUserService currentUserService)
        {
            _uow = uow;
            _currentUserService = currentUserService;
        }

        public async Task<ApiResponse<bool>> Handle(RejectMaterialRequestCommand request, CancellationToken cancellationToken)
        {
            var currentUserId = _currentUserService.GetRequiredUserId();

            if (string.IsNullOrWhiteSpace(request.Reason))
            {
                throw new BusinessException("ERR_REJECTION_REASON_REQUIRED", "Bắt buộc phải nhập lý do từ chối yêu cầu.");
            }

            var mr = await _uow.Repository<MaterialRequest>().Query()
                .FirstOrDefaultAsync(x => x.RequestId == request.RequestId, cancellationToken);

            if (mr == null)
            {
                throw new NotFoundException(nameof(MaterialRequest), request.RequestId);
            }

            // Chỉ cho phép từ chối khi đang chờ duyệt hoặc chờ trình duyệt
            if (mr.Status != MaterialRequestStatus.Pending && mr.Status != MaterialRequestStatus.WaitingApproval)
            {
                throw new BusinessException("ERR_INVALID_STATUS_FOR_REJECT", 
                    $"Không thể từ chối yêu cầu vật tư đang ở trạng thái: {mr.Status}. Chỉ hỗ trợ từ chối phiếu ở trạng thái Chờ duyệt (Pending) hoặc Chờ Giám đốc (WaitingApproval).");
            }

            if (mr.Status == MaterialRequestStatus.Pending)
            {
                mr.CheckedBy = currentUserId;
                mr.AccountantNote = $"Từ chối: {request.Reason}";
            }
            else // WaitingApproval
            {
                mr.ApprovedBy = currentUserId;
                mr.ApprovalNote = $"Từ chối: {request.Reason}";
            }

            mr.Status = MaterialRequestStatus.Rejected;
            mr.UpdatedAt = DateTime.UtcNow;
            mr.UpdatedBy = currentUserId;

            _uow.Repository<MaterialRequest>().Update(mr);
            await _uow.SaveChangesAsync(cancellationToken);

            return ApiResponse<bool>.SuccessResult(true, "Từ chối yêu cầu vật tư thành công.");
        }
    }
}
