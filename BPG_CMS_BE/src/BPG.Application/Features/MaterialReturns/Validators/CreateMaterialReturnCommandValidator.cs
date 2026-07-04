using BPG.Application.Features.MaterialReturns.Commands;
using FluentValidation;
using System.Linq;

namespace BPG.Application.Features.MaterialReturns.Validators
{
    public class CreateMaterialReturnCommandValidator : AbstractValidator<CreateMaterialReturnCommand>
    {
        public CreateMaterialReturnCommandValidator()
        {
            RuleFor(x => x.OriginalIssuanceId)
                .GreaterThan(0).WithMessage("Mã phiếu xuất kho gốc (OriginalIssuanceId) không hợp lệ.");

            RuleFor(x => x.Reason)
                .NotEmpty().WithMessage("Lý do hoàn trả không được để trống.")
                .MaximumLength(500).WithMessage("Lý do hoàn trả không được vượt quá 500 ký tự.");

            RuleFor(x => x.Items)
                .NotEmpty().WithMessage("Danh sách vật tư hoàn trả không được để trống.")
                .Must(items => items != null && items.Select(i => i.MaterialId).Distinct().Count() == items.Count)
                .WithMessage("Danh sách vật tư hoàn trả không được chứa vật tư trùng lặp.");

            RuleForEach(x => x.Items).ChildRules(item =>
            {
                item.RuleFor(i => i.MaterialId)
                    .GreaterThan(0).WithMessage("Mã vật tư không hợp lệ.");

                item.RuleFor(i => i.UnitId)
                    .GreaterThan(0).WithMessage("Mã đơn vị tính không hợp lệ.");

                item.RuleFor(i => i.Quantity)
                    .GreaterThan(0).WithMessage("Số lượng hoàn trả phải lớn hơn 0.");
            });
        }
    }
}
