using BPG.Application.Features.DirectPurchases.Commands;
using FluentValidation;

namespace BPG.Application.Features.DirectPurchases.Validators
{
    /// <summary>
    /// Chỉ kiểm phần hình dạng dữ liệu của phiếu nháp. Nháp là bản lưu dở nên KHÔNG bắt buộc
    /// phải có vật tư, có lý do hay có ảnh hóa đơn — những ràng buộc đó thuộc bước Gửi phiếu.
    /// Nhưng dòng nào đã nhập thì phải hợp lệ, tránh ghi số lượng/đơn giá rác vào TotalAmount.
    /// </summary>
    public class CreateDirectPurchaseRequestCommandValidator : AbstractValidator<CreateDirectPurchaseRequestCommand>
    {
        public CreateDirectPurchaseRequestCommandValidator()
        {
            RuleFor(x => x.ProjectId)
                .GreaterThan(0).WithMessage("Dự án không hợp lệ.");

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
