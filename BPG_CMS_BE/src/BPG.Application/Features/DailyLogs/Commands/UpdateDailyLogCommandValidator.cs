using FluentValidation;
using BPG.Application.Features.DailyLogs.Commands;
using BPG.Domain.Constants;

namespace BPG.Application.Features.DailyLogs.Commands
{
    public class UpdateDailyLogCommandValidator : AbstractValidator<UpdateDailyLogCommand>
    {
        public UpdateDailyLogCommandValidator()
        {
            RuleFor(x => x.LogId)
                .GreaterThan(0)
                .WithMessage(ValidationMessages.MustBeGreaterThanZero);

            RuleFor(x => x.Description)
                .NotEmpty()
                .WithMessage(ValidationMessages.Required)
                .MaximumLength(2000)
                .WithMessage(ValidationMessages.MaxLength);
        }
    }
}
