using FluentValidation;
using BPG.Application.Features.Tasks.Commands;

namespace BPG.Application.Features.Tasks.Validators;

public class UpdateTaskCommandValidator : AbstractValidator<UpdateTaskCommand>
{
    public UpdateTaskCommandValidator()
    {
        RuleFor(x => x.TaskId).GreaterThan(0);
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.OrderIndex).GreaterThanOrEqualTo(0);
        RuleFor(x => x.StartDate).NotEmpty();
        RuleFor(x => x.EndDate)
            .NotEmpty()
            .GreaterThanOrEqualTo(x => x.StartDate)
            .WithMessage("Ngày kết thúc không được nhỏ hơn ngày bắt đầu.");
    }
}
