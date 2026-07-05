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
    public record ProcessMaterialRequestByAccountantCommand(long RequestId, string? Note) : IRequest<ApiResponse<bool>>;

    public class ProcessMaterialRequestByAccountantCommandHandler : IRequestHandler<ProcessMaterialRequestByAccountantCommand, ApiResponse<bool>>
    {
        private readonly IUnitOfWork _uow;
        private readonly ICurrentUserService _currentUserService;

        public ProcessMaterialRequestByAccountantCommandHandler(IUnitOfWork uow, ICurrentUserService currentUserService)
        {
            _uow = uow;
            _currentUserService = currentUserService;
        }

        public async Task<ApiResponse<bool>> Handle(ProcessMaterialRequestByAccountantCommand request, CancellationToken cancellationToken)
        {
            var currentUserId = _currentUserService.GetRequiredUserId();

            var mr = await _uow.Repository<MaterialRequest>().Query()
                .Include(x => x.Items)
                .FirstOrDefaultAsync(x => x.RequestId == request.RequestId, cancellationToken);

            if (mr == null)
            {
                throw new NotFoundException(nameof(MaterialRequest), request.RequestId);
            }

            if (mr.Status != MaterialRequestStatus.Pending)
            {
                throw new BusinessException("ERR_INVALID_STATUS_FOR_PROCESS", 
                    $"Phiếu yêu cầu vật tư đang ở trạng thái: {mr.Status}. Chỉ hỗ trợ xử lý phiếu ở trạng thái Chờ duyệt (Pending).");
            }

            await _uow.BeginTransactionAsync(cancellationToken);
            try
            {
                if (mr.BOQCheckStatus == BOQCheckStatus.WithinBOQ)
                {
                    // 1. Phê duyệt trực tiếp và cập nhật thông tin kiểm tra/phê duyệt
                    mr.Status = MaterialRequestStatus.Approved;
                    mr.CheckedBy = currentUserId;
                    mr.ApprovedBy = currentUserId;
                    mr.AccountantNote = request.Note;
                    mr.UpdatedAt = DateTime.UtcNow;
                    mr.UpdatedBy = currentUserId;

                    _uow.Repository<MaterialRequest>().Update(mr);
                }
                else
                {
                    // Trình Giám đốc phê duyệt (WaitingApproval)
                    mr.Status = MaterialRequestStatus.WaitingApproval;
                    mr.CheckedBy = currentUserId;
                    mr.AccountantNote = request.Note;
                    mr.UpdatedAt = DateTime.UtcNow;
                    mr.UpdatedBy = currentUserId;

                    _uow.Repository<MaterialRequest>().Update(mr);
                }

                await _uow.SaveChangesAsync(cancellationToken);
                await _uow.CommitTransactionAsync(cancellationToken);

                string message = mr.Status == MaterialRequestStatus.Approved 
                    ? "Kế toán phê duyệt yêu cầu trong định mức thành công." 
                    : "Kế toán trình Giám đốc xem xét yêu cầu vượt định mức thành công.";

                return ApiResponse<bool>.SuccessResult(true, message);
            }
            catch (Exception)
            {
                await _uow.RollbackTransactionAsync(cancellationToken);
                throw;
            }
        }
    }
}
