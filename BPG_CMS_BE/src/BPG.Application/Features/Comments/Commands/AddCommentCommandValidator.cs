using FluentValidation;
using BPG.Application.Features.Comments.Commands;
using BPG.Domain.Constants;

namespace BPG.Application.Features.Comments.Commands
{
    public class AddCommentCommandValidator : AbstractValidator<AddCommentCommand>
    {
        public AddCommentCommandValidator()
        {
            RuleFor(x => x.LogId)
                .GreaterThan(0)
                .WithMessage(ValidationMessages.MustBeGreaterThanZero);

            RuleFor(x => x.Content)
                .NotEmpty()
                .WithMessage(ValidationMessages.Required)
                .MaximumLength(1000)
                .WithMessage(ValidationMessages.MaxLength);
        }
    }
}
