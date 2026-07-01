using FluentValidation;
using BPG.Application.Features.MaterialRequests.Commands;
using System.Linq;

namespace BPG.Application.Features.MaterialRequests.Validators
{
    public class CreateMaterialRequestCommandValidator : AbstractValidator<CreateMaterialRequestCommand>
    {
        public CreateMaterialRequestCommandValidator()
        {
            RuleFor(x => x.PhaseId)
                .GreaterThan(0).WithMessage("PhaseId không hợp lệ.");

            RuleFor(x => x.Reason)
                .MaximumLength(500).WithMessage("Lý do yêu cầu tối đa 500 ký tự.");

            RuleFor(x => x.Type)
                .Must(t => t == "normal" || t == "emergency")
                .WithMessage("Hình thức yêu cầu không hợp lệ (Chỉ hỗ trợ 'normal' hoặc 'emergency').");

            RuleFor(x => x.InvoiceImage)
                .NotEmpty().When(x => x.Type == "emergency")
                .WithMessage("Mua ngoài khẩn cấp bắt buộc phải tải ảnh hóa đơn.");

            RuleFor(x => x.Items)
                .NotEmpty().WithMessage("Danh sách vật tư yêu cầu không được để trống.")
                .Must(items => items != null && items.Select(i => i.Name.Trim().ToLower()).Distinct().Count() == items.Count)
                .WithMessage("Danh sách vật tư yêu cầu không được chứa sản phẩm trùng lặp.");

            RuleForEach(x => x.Items).ChildRules(item =>
            {
                item.RuleFor(i => i.Name)
                    .NotEmpty().WithMessage("Tên vật tư không được để trống.");

                item.RuleFor(i => i.Quantity)
                    .GreaterThan(0).WithMessage("Số lượng vật tư phải lớn hơn 0.");

                item.RuleFor(i => i.Unit)
                    .NotEmpty().WithMessage("Đơn vị tính không được để trống.");
            });
        }
    }
}
