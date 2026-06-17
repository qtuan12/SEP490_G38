using BPG.Domain.Exceptions;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using FluentValidation;
using MediatR;

namespace BPG.Application.Features.MaterialCategories.Commands;

public record DeleteMaterialCategoryCommand(long CategoryId) : IRequest<bool>;

public class DeleteMaterialCategoryCommandValidator : AbstractValidator<DeleteMaterialCategoryCommand>
{
    public DeleteMaterialCategoryCommandValidator()
    {
        RuleFor(v => v.CategoryId).GreaterThan(0).WithMessage("ID loại vật tư không hợp lệ.");
    }
}

public class DeleteMaterialCategoryCommandHandler : IRequestHandler<DeleteMaterialCategoryCommand, bool>
{
    private readonly IUnitOfWork _unitOfWork;

    public DeleteMaterialCategoryCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<bool> Handle(DeleteMaterialCategoryCommand request, CancellationToken cancellationToken)
    {
        var repository = _unitOfWork.Repository<MaterialCategory>();

        var entity = await repository.GetByIdAsync(request.CategoryId);
        if (entity == null || entity.IsDeleted)
        {
            throw new NotFoundException(nameof(MaterialCategory), request.CategoryId);
        }

        // Soft delete
        entity.IsDeleted = true;

        repository.Update(entity);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return true;
    }
}
