using BPG.Application.Features.Units.Commands;
using FluentValidation;

namespace BPG.Application.Features.Units.Validators;

public class CreateUnitCommandValidator : AbstractValidator<CreateUnitCommand>
{
    public CreateUnitCommandValidator()
    {
        RuleFor(x => x.UnitCode)
            .NotEmpty().WithMessage("Mã đơn vị không được để trống.")
            .MaximumLength(50).WithMessage("Mã đơn vị không được vượt quá 50 ký tự.");

        RuleFor(x => x.UnitName)
            .NotEmpty().WithMessage("Tên đơn vị không được để trống.")
            .MaximumLength(255).WithMessage("Tên đơn vị không được vượt quá 255 ký tự.");
    }
}
