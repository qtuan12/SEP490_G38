using FluentValidation;

namespace BPG.Application.Features.Tasks.Validators;

public class AdjustTaskProgressCommandValidator : AbstractValidator<Commands.AdjustTaskProgressCommand>
{
    public AdjustTaskProgressCommandValidator()
    {
        RuleFor(x => x.TaskId).GreaterThan(0);
        RuleFor(x => x.NewProgress).InclusiveBetween((byte)0, (byte)100);
        RuleFor(x => x.UpdateReason).NotEmpty().MaximumLength(1000);
    }
}
