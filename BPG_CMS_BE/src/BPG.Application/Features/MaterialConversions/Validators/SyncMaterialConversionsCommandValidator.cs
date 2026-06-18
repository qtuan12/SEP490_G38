using BPG.Application.Features.MaterialConversions.Commands;
using FluentValidation;
using System.Linq;

namespace BPG.Application.Features.MaterialConversions.Validators;

public class SyncMaterialConversionsCommandValidator : AbstractValidator<SyncMaterialConversionsCommand>
{
    public SyncMaterialConversionsCommandValidator()
    {
        RuleFor(x => x.MaterialId)
            .GreaterThan(0).WithMessage("Mã vật tư không hợp lệ.");

        RuleFor(x => x.Conversions)
            .NotNull().WithMessage("Danh sách tỷ lệ quy đổi không được để trống.");

        RuleForEach(x => x.Conversions).ChildRules(conversion =>
        {
            conversion.RuleFor(c => c.AlternativeUnitId)
                .GreaterThan(0).WithMessage("Đơn vị thay thế không hợp lệ.");

            conversion.RuleFor(c => c.ConversionRate)
                .GreaterThan(0).WithMessage("Tỷ lệ quy đổi phải lớn hơn 0.");
        });

        // Luật Trùng lặp mảng
        RuleFor(x => x.Conversions)
            .Must(conversions => 
                conversions == null || 
                conversions.Select(c => c.AlternativeUnitId).Distinct().Count() == conversions.Count)
            .WithMessage("Không được cấu hình trùng lặp cùng một đơn vị thay thế cho một vật tư.");
    }
}
