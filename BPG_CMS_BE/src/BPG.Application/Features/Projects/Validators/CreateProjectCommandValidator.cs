namespace BPG.Application.Features.Projects.Validators;

using FluentValidation;
using BPG.Application.Features.Projects.Commands;
using System;

public class CreateProjectCommandValidator : AbstractValidator<CreateProjectCommand>
{
    public CreateProjectCommandValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Tên dự án không được để trống.")
            .MaximumLength(255).WithMessage("Tên dự án không vượt quá 255 ký tự.");

        RuleFor(x => x.PlannedStart)
            .NotEmpty().WithMessage("Ngày bắt đầu không được để trống.")
            .GreaterThanOrEqualTo(DateOnly.FromDateTime(DateTime.Today)).WithMessage("Ngày bắt đầu không được trong quá khứ.");

        RuleFor(x => x.PlannedEnd)
            .NotEmpty().WithMessage("Ngày kết thúc không được để trống.")
            .GreaterThanOrEqualTo(x => x.PlannedStart).WithMessage("Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.");
    }
}
