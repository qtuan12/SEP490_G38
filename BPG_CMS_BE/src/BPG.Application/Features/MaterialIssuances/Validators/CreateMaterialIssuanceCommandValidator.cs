using BPG.Application.Features.MaterialIssuances.Commands;
using FluentValidation;
using System.Linq;

namespace BPG.Application.Features.MaterialIssuances.Validators
{
    public class CreateMaterialIssuanceCommandValidator : AbstractValidator<CreateMaterialIssuanceCommand>
    {
        public CreateMaterialIssuanceCommandValidator()
        {
            RuleFor(x => x.TaskId)
                .GreaterThan(0).WithMessage("Mã công việc (TaskId) không hợp lệ.");

            RuleFor(x => x.Purpose)
                .NotEmpty().WithMessage("Mục đích xuất kho không được để trống.")
                .MaximumLength(500).WithMessage("Mục đích xuất kho không được vượt quá 500 ký tự.");

            RuleFor(x => x.Items)
                .NotEmpty().WithMessage("Danh sách vật tư xuất kho không được để trống.")
                .Must(items => items != null && items.Select(i => i.MaterialId).Distinct().Count() == items.Count)
                .WithMessage("Danh sách vật tư xuất không được chứa vật tư trùng lặp.");

            RuleForEach(x => x.Items).ChildRules(item =>
            {
                item.RuleFor(i => i.MaterialId)
                    .GreaterThan(0).WithMessage("Mã vật tư không hợp lệ.");

                item.RuleFor(i => i.UnitId)
                    .GreaterThan(0).WithMessage("Mã đơn vị tính không hợp lệ.");

                item.RuleFor(i => i.Quantity)
                    .GreaterThan(0).WithMessage("Số lượng xuất kho phải lớn hơn 0.");
            });
        }
    }
}
