using FluentValidation;
using BPG.Application.Features.Comments.Commands;
using BPG.Domain.Constants;

namespace BPG.Application.Features.Comments.Commands
{
    public class UpdateCommentCommandValidator : AbstractValidator<UpdateCommentCommand>
    {
        public UpdateCommentCommandValidator()
        {
            RuleFor(x => x.CommentId)
                .GreaterThan(0)
                .WithMessage(ValidationMessages.MustBeGreaterThanZero);

            RuleFor(x => x.Content)
                .NotEmpty()
                .WithMessage(ValidationMessages.Required)
                .MaximumLength(1000)
                .WithMessage(string.Format(ValidationMessages.MaxLength, 1000));
        }
    }
}
