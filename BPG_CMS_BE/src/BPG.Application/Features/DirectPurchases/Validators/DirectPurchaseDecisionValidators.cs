using BPG.Application.Features.DirectPurchases.Commands;
using FluentValidation;

namespace BPG.Application.Features.DirectPurchases.Validators
{
    /// <summary>Kế toán soát hóa đơn. Từ chối thì bắt buộc nêu lý do vì người lập phiếu mất tiền hoàn.</summary>
    public class AuditDirectPurchaseCommandValidator : AbstractValidator<AuditDirectPurchaseCommand>
    {
        public AuditDirectPurchaseCommandValidator()
        {
            RuleFor(x => x.DirectPurchaseId)
                .GreaterThan(0).WithMessage("Phiếu mua khẩn cấp không hợp lệ.");

            RuleFor(x => x.AuditNote)
                .NotEmpty().When(x => !x.Approve)
                .WithMessage("Vui lòng nhập lý do khi từ chối kiểm toán.")
                .MaximumLength(500).WithMessage("Ghi chú kiểm toán tối đa 500 ký tự.");
        }
    }

    /// <summary>Giám đốc duyệt chi.</summary>
    public class ApproveDirectPurchaseByDirectorCommandValidator : AbstractValidator<ApproveDirectPurchaseByDirectorCommand>
    {
        public ApproveDirectPurchaseByDirectorCommandValidator()
        {
            RuleFor(x => x.DirectPurchaseId)
                .GreaterThan(0).WithMessage("Phiếu mua khẩn cấp không hợp lệ.");

            RuleFor(x => x.ApprovalNote)
                .MaximumLength(500).WithMessage("Ghi chú duyệt chi tối đa 500 ký tự.");
        }
    }

    /// <summary>Giám đốc từ chối duyệt chi. Lý do bắt buộc vì vật tư đã nhập kho mà không được hoàn tiền.</summary>
    public class RejectDirectPurchaseByDirectorCommandValidator : AbstractValidator<RejectDirectPurchaseByDirectorCommand>
    {
        public RejectDirectPurchaseByDirectorCommandValidator()
        {
            RuleFor(x => x.DirectPurchaseId)
                .GreaterThan(0).WithMessage("Phiếu mua khẩn cấp không hợp lệ.");

            RuleFor(x => x.Reason)
                .NotEmpty().WithMessage("Vui lòng nhập lý do khi từ chối duyệt chi.")
                .MaximumLength(500).WithMessage("Lý do từ chối tối đa 500 ký tự.");
        }
    }
}
