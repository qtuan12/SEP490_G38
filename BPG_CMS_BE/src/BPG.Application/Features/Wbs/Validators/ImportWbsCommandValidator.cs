using BPG.Application.Features.Wbs.Commands;
using FluentValidation;
using System.IO;
using System.Linq;

namespace BPG.Application.Features.Wbs.Validators;

public class ImportWbsCommandValidator : AbstractValidator<ImportWbsCommand>
{
    private static readonly string[] AllowedExtensions = [".xlsx", ".xls"];

    public ImportWbsCommandValidator()
    {
        RuleFor(x => x.File)
            .NotNull().WithMessage("File không được để trống.")
            .Must(f => f != null && f.Length > 0).WithMessage("File không được rỗng.")
            .Must(f => f != null && AllowedExtensions.Contains(
                Path.GetExtension(f.FileName).ToLowerInvariant()))
            .WithMessage("Chỉ chấp nhận file Excel (.xlsx, .xls).");
    }
}
