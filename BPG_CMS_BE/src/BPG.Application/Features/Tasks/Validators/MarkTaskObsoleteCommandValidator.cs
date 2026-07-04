using FluentValidation;
using BPG.Application.Features.Tasks.Commands;

namespace BPG.Application.Features.Tasks.Validators;

public class MarkTaskObsoleteCommandValidator : AbstractValidator<MarkTaskObsoleteCommand>
{
    public MarkTaskObsoleteCommandValidator()
    {
        RuleFor(x => x.TaskId).GreaterThan(0);
        RuleFor(x => x.ObsoleteReason).NotEmpty().MaximumLength(1000);
    }
}
