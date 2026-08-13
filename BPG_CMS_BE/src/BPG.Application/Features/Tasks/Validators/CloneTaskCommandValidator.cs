using BPG.Application.Features.Tasks.Commands;
using FluentValidation;

namespace BPG.Application.Features.Tasks.Validators;

public class CloneTaskCommandValidator : AbstractValidator<CloneTaskCommand>
{
    public CloneTaskCommandValidator()
    {
        RuleFor(x => x.TaskId).GreaterThan(0);
    }
}
