using BPG.Application.Features.DirectPurchases.Commands;
using FluentValidation;

namespace BPG.Application.Features.DirectPurchases.Validators
{
    /// <summary>
    /// Cùng bộ luật với lúc tạo nháp. Không có ProjectId vì sửa nháp không cho đổi dự án.
    /// </summary>
    public class UpdateDirectPurchaseDraftCommandValidator : AbstractValidator<UpdateDirectPurchaseDraftCommand>
    {
        public UpdateDirectPurchaseDraftCommandValidator()
        {
            RuleFor(x => x.DirectPurchaseId)
                .GreaterThan(0).WithMessage("Phiếu mua khẩn cấp không hợp lệ.");

            RuleFor(x => x.PhaseId)
                .GreaterThan(0).WithMessage("Giai đoạn không hợp lệ.");

            RuleFor(x => x.TaskId)
                .GreaterThan(0).When(x => x.TaskId.HasValue)
                .WithMessage("Công việc không hợp lệ.");

            RuleFor(x => x.Reason)
                .MaximumLength(500).WithMessage("Lý do mua khẩn cấp tối đa 500 ký tự.");

            RuleForEach(x => x.Items).SetValidator(new DirectPurchaseItemInputValidator());
        }
    }
}
