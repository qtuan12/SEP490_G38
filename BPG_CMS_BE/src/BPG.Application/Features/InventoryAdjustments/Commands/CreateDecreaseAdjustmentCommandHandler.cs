using BPG.Domain.Exceptions;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Application.Common.Models;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.InventoryAdjustments.Commands
{
    public class CreateDecreaseAdjustmentCommandHandler : IRequestHandler<CreateDecreaseAdjustmentCommand, ApiResponse<long>>
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly ICurrentUserService _currentUserService;

        public CreateDecreaseAdjustmentCommandHandler(IUnitOfWork unitOfWork, ICurrentUserService currentUserService)
        {
            _unitOfWork = unitOfWork;
            _currentUserService = currentUserService;
        }

        public async Task<ApiResponse<long>> Handle(CreateDecreaseAdjustmentCommand request, CancellationToken cancellationToken)
        {
            var project = await _unitOfWork.Repository<Project>().GetByIdAsync(request.ProjectId);
            if (project == null) throw new NotFoundException(nameof(Project), request.ProjectId);

            var incident = await _unitOfWork.Repository<Incident>().GetByIdAsync(request.IncidentId);
            if (incident == null) throw new NotFoundException(nameof(Incident), request.IncidentId);
            if (incident.ProjectId != request.ProjectId) throw new BusinessException("ERR_INVALID_INCIDENT", "Sự cố không thuộc dự án này");

            var adjustment = new InventoryAdjustment
            {
                ProjectId = request.ProjectId,
                IncidentId = request.IncidentId,
                AdjustmentType = InventoryAdjustmentType.Decrease,
                Reason = request.Reason,
                Description = request.Description,
                Status = InventoryAdjustmentStatus.Pending // Accountant creates, must be approved by Director
            };

            foreach (var item in request.Items)
            {
                var material = await _unitOfWork.Repository<MaterialCatalog>().GetByIdAsync(item.MaterialId);
                if (material == null) throw new NotFoundException(nameof(MaterialCatalog), item.MaterialId);

                adjustment.Items.Add(new AdjustmentItem
                {
                    MaterialId = item.MaterialId,
                    UnitId = material.BaseUnitId,
                    Quantity = item.Quantity,
                    ConversionRate = 1
                });
            }

            await _unitOfWork.Repository<InventoryAdjustment>().AddAsync(adjustment);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            // Note: Decrease does not update CurrentInventory nor create InventoryTransaction yet.
            // It waits for Approval.

            // Optional: send notification to Director here...

            return ApiResponse<long>.SuccessResult(adjustment.AdjustmentId, "Tạo phiếu điều chỉnh giảm tồn thành công, chờ phê duyệt");
        }
    }
}
