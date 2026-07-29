using BPG.Application.Common.Models;
using BPG.Domain.Constants;
using FluentValidation;
using MediatR;

namespace BPG.Application.Features.InventoryAdjustments.Commands
{
    public class ApproveDecreaseAdjustmentCommand : IRequest<ApiResponse<bool>>
    {
        public long AdjustmentId { get; set; }
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
                RuleFor(x => x.RejectedReason).NotEmpty().WithMessage("LÃ½ do tá»« chá»‘i khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng khi tá»« chá»‘i.");
            });
        }
    }
}

