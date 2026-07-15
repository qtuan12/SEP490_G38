using BPG.Application.DTOs.MaterialCatalogs;
using FluentValidation;
using MediatR;

namespace BPG.Application.Features.MaterialCatalogs.Commands;

public record UpdateMaterialCatalogCommand(
    long MaterialId,
    long CategoryId,
    int BaseUnitId,
    string Code,
    string Name,
    string? Specification
) : IRequest<MaterialCatalogDto>;

public class UpdateMaterialCatalogCommandValidator : AbstractValidator<UpdateMaterialCatalogCommand>
{
    public UpdateMaterialCatalogCommandValidator()
    {
        RuleFor(v => v.Code)
            .NotEmpty().WithMessage("Mã vật tư không được để trống.")
            .MaximumLength(50).WithMessage("Mã vật tư không vượt quá 50 ký tự.");

        RuleFor(v => v.Name)
            .NotEmpty().WithMessage("Tên vật tư không được để trống.")
            .MaximumLength(200).WithMessage("Tên vật tư không vượt quá 200 ký tự.");
    }
}
