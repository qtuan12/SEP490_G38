using BPG.Application.Features.Suppliers.Commands;
using FluentValidation;

namespace BPG.Application.Features.Suppliers.Validators
{
    public class ImportSuppliersCommandValidator : AbstractValidator<ImportSuppliersCommand>
    {
        private static readonly string[] AllowedExtensions = [".xlsx", ".xls"];

        public ImportSuppliersCommandValidator()
        {
            RuleFor(x => x.File)
                .NotNull().WithMessage("File không được để trống.")
                .Must(f => f != null && f.Length > 0).WithMessage("File không được rỗng.")
                .Must(f => f != null && AllowedExtensions.Contains(
                    Path.GetExtension(f.FileName).ToLowerInvariant()))
                .WithMessage("Chỉ chấp nhận file Excel (.xlsx, .xls).");
        }
    }
}
