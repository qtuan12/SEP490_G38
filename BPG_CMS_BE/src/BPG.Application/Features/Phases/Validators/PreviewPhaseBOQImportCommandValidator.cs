using BPG.Application.Features.Phases.Commands;
using FluentValidation;

namespace BPG.Application.Features.Phases.Validators;

public class PreviewPhaseBOQImportCommandValidator : AbstractValidator<PreviewPhaseBOQImportCommand>
{
    public PreviewPhaseBOQImportCommandValidator()
    {
        RuleFor(x => x.ProjectId)
            .GreaterThan(0).WithMessage("ProjectId không hợp lệ.");

        RuleFor(x => x.PhaseId)
            .GreaterThan(0).WithMessage("PhaseId không hợp lệ.");

        RuleFor(x => x.Rows)
            .NotNull().WithMessage("Dữ liệu import không được để trống.")
            .NotEmpty().WithMessage("File Excel không có dòng dữ liệu BOQ.")
            .Must(rows => rows == null || rows.Count <= 1000)
            .WithMessage("Mỗi lần chỉ được import tối đa 1000 dòng BOQ.");
    }
}
