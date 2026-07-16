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
    public record CancelMaterialRequestCommand(long RequestId, string Reason) : IRequest<ApiResponse<bool>>;

    public class CancelMaterialRequestCommandHandler : IRequestHandler<CancelMaterialRequestCommand, ApiResponse<bool>>
    {
        private readonly IUnitOfWork _uow;
        private readonly ICurrentUserService _currentUserService;

        public CancelMaterialRequestCommandHandler(IUnitOfWork uow, ICurrentUserService currentUserService)
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

            // Kiểm tra phân quyền: Phải là người tạo hoặc Project Leader của dự án
            var isLeader = await _uow.Repository<ProjectMember>().Query()
                .AnyAsync(pm => pm.ProjectId == mr.Phase.ProjectId && pm.UserId == currentUserId && pm.IsLeader, cancellationToken);

            if (mr.CreatedBy != currentUserId && !isLeader)
            {
                throw new ForbiddenException("Bạn không có quyền hủy yêu cầu vật tư này.");
            }

            // Chỉ cho phép hủy khi đang chờ duyệt
            if (mr.Status != MaterialRequestStatus.Pending && mr.Status != MaterialRequestStatus.WaitingApproval)
            {
                throw new BusinessException("ERR_INVALID_STATUS_FOR_CANCEL", 
                    $"Không thể hủy yêu cầu vật tư đang ở trạng thái: {mr.Status}. Chỉ hỗ trợ hủy phiếu ở trạng thái Chờ duyệt (Pending) hoặc Chờ Giám đốc (WaitingApproval).");
            }

            mr.Status = MaterialRequestStatus.Cancelled;
            mr.AccountantNote = string.IsNullOrWhiteSpace(request.Reason) 
                ? "Hủy yêu cầu" 
                : request.Reason.Trim();
            mr.UpdatedAt = DateTime.UtcNow;
            mr.UpdatedBy = currentUserId;

            _uow.Repository<MaterialRequest>().Update(mr);
            await _uow.SaveChangesAsync(cancellationToken);

            return ApiResponse<bool>.SuccessResult(true, "Hủy yêu cầu vật tư thành công.");
        }
    }
}
