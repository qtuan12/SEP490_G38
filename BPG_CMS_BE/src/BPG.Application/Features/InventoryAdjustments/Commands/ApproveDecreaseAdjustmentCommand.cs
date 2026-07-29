using BPG.Application.Common.Models;
using BPG.Application.Common.Authorization;
using BPG.Domain.Constants;
using FluentValidation;
using MediatR;

namespace BPG.Application.Features.InventoryAdjustments.Commands
{
    public class ApproveDecreaseAdjustmentCommand : IRequest<ApiResponse<bool>>, IProjectResourceRequirement
    {
        public long AdjustmentId { get; set; }
        public ProjectResource ProjectResource => ProjectResource.InventoryAdjustment(AdjustmentId);
        public string RequiredPermission => ProjectPermission.Approve;
        public bool IsApproved { get; set; }
        public string? RejectedReason { get; set; }
    }

    public class ApproveDecreaseAdjustmentCommandValidator : AbstractValidator<ApproveDecreaseAdjustmentCommand>
    {
        public ApproveDecreaseAdjustmentCommandValidator()
        {
            RuleFor(x => x.AdjustmentId).GreaterThan(0).WithMessage("ERR_VALIDATION");
            When(x => !x.IsApproved, () =>
            {
                RuleFor(x => x.RejectedReason).NotEmpty().WithMessage("Lý do từ chối không được để trống khi từ chối.");
            });
        }
    }
}
