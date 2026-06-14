using BPG.Application.Features.Suppliers.Commands;
using FluentValidation;

namespace BPG.Application.Features.Suppliers.Validators
{
    public class CreateSupplierCommandValidator : AbstractValidator<CreateSupplierCommand>
    {
        public CreateSupplierCommandValidator()
        {
            RuleFor(x => x.SupplierName)
                .NotEmpty().WithMessage("Tên nhà cung cấp không được để trống.")
                .MaximumLength(200).WithMessage("Tên nhà cung cấp không được vượt quá 200 ký tự.");

            RuleFor(x => x.CollaborationStatus)
                .NotEmpty().WithMessage("Trạng thái hợp tác không được để trống.")
                .Must(x => x == "Active" || x == "Inactive")
                .WithMessage("Trạng thái hợp tác chỉ được phép là 'Active' hoặc 'Inactive'.");

            RuleFor(x => x.Rating)
                .InclusiveBetween(1, 5).WithMessage("Đánh giá phải nằm trong khoảng từ 1 đến 5.")
                .When(x => x.Rating.HasValue);
        }
    }
}
