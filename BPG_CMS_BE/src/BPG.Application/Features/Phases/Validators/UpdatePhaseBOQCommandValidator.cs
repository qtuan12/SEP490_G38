using FluentValidation;
using BPG.Application.Features.Phases.Commands;
using System.Linq;

namespace BPG.Application.Features.Phases.Validators;

public class UpdatePhaseBOQCommandValidator : AbstractValidator<UpdatePhaseBOQCommand>
{
    public UpdatePhaseBOQCommandValidator()
    {
        RuleFor(x => x.ProjectId)
            .GreaterThan(0).WithMessage("ProjectId không hợp lệ.");

        RuleFor(x => x.PhaseId)
            .GreaterThan(0).WithMessage("PhaseId không hợp lệ.");

        RuleFor(x => x.Items)
            .NotNull().WithMessage("Danh sách vật tư định mức không được để trống.")
            .Must(items => items == null || items.Select(i => i.MaterialId).Distinct().Count() == items.Count)
            .WithMessage("Danh sách vật tư định mức không được chứa vật tư trùng lặp.");

        RuleForEach(x => x.Items).ChildRules(item =>
        {
            item.RuleFor(i => i.MaterialId)
                .GreaterThan(0).WithMessage("MaterialId không hợp lệ.");

            item.RuleFor(i => i.Quantity)
                .GreaterThan(0).WithMessage("Số lượng vật tư định mức phải lớn hơn 0.")
                .PrecisionScale(18, 3, true).WithMessage("Số lượng chỉ được có tối đa 3 chữ số thập phân.");

            item.RuleFor(i => i.UnitId)
                .GreaterThan(0).WithMessage("UnitId không hợp lệ.");
        });
    }
}
