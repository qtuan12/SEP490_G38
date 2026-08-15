using BPG.Application.Features.Phases.Commands;
using FluentValidation;

namespace BPG.Application.Features.Phases.Validators;

public class ClonePhaseCommandValidator : AbstractValidator<ClonePhaseCommand>
{
    public ClonePhaseCommandValidator()
    {
        RuleFor(x => x.ProjectId).GreaterThan(0);
        RuleFor(x => x.PhaseId).GreaterThan(0);
    }
}
