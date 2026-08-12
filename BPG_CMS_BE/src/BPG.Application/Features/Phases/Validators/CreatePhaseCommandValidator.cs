using BPG.Application.Features.Phases.Commands;
using FluentValidation;

namespace BPG.Application.Features.Phases.Validators;

public class CreatePhaseCommandValidator : AbstractValidator<CreatePhaseCommand>
{
    public CreatePhaseCommandValidator()
    {
        RuleFor(x => x.ProjectId).GreaterThan(0);
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.OrderIndex).GreaterThanOrEqualTo(0);
        RuleFor(x => x.EndDate)
            .GreaterThanOrEqualTo(x => x.StartDate)
            .When(x => x.StartDate.HasValue && x.EndDate.HasValue)
            .WithMessage("Ngày kết thúc không được nhỏ hơn ngày bắt đầu.");
    }
}
