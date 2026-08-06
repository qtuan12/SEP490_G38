namespace BPG.Application.Features.Projects.Validators;

using BPG.Domain.Common;
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
            .Must(date => date >= VietnamTime.Today).WithMessage("Ngày bắt đầu không được trong quá khứ.");

        RuleFor(x => x.PlannedEnd)
            .NotEmpty().WithMessage("Ngày kết thúc không được để trống.")
            .Must((cmd, end) => end > cmd.PlannedStart).WithMessage("Ngày kết thúc phải lớn hơn ngày bắt đầu.");
    }
}
