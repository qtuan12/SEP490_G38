using FluentValidation;
using BPG.Application.Features.DailyLogs.Commands;
using BPG.Domain.Constants;

namespace BPG.Application.Features.DailyLogs.Commands
{
    public class CreateDailyLogCommandValidator : AbstractValidator<CreateDailyLogCommand>
    {
        public CreateDailyLogCommandValidator()
        {
            RuleFor(x => x.TaskId)
                .GreaterThan(0)
                .WithMessage(ValidationMessages.MustBeGreaterThanZero);

            RuleFor(x => x.NewProgressPercent)
                .InclusiveBetween((byte)0, (byte)100)
                .WithMessage("Tiến độ phải nằm trong khoảng từ 0% đến 100%.");

            RuleFor(x => x.Description)
                .NotEmpty()
                .WithMessage(ValidationMessages.Required)
                .MaximumLength(2000)
                .WithMessage(ValidationMessages.MaxLength);
        }
    }
}
