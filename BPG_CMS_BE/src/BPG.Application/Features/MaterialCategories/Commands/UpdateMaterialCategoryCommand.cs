using AutoMapper;
using BPG.Application.Features.MaterialCategories.DTOs;
using BPG.Application.IRepositories;
using BPG.Domain.Exceptions;
using BPG.Domain.Entities;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.MaterialCategories.Commands;

public record UpdateMaterialCategoryCommand : IRequest<MaterialCategoryDto>
{
    public long CategoryId { get; init; }
    public string CategoryName { get; init; } = string.Empty;
    public string? Description { get; init; }
}

public class UpdateMaterialCategoryCommandValidator : AbstractValidator<UpdateMaterialCategoryCommand>
{
    public UpdateMaterialCategoryCommandValidator()
    {
        RuleFor(v => v.CategoryId).GreaterThan(0).WithMessage("ID loại vật tư không hợp lệ.");
        RuleFor(v => v.CategoryName)
            .NotEmpty().WithMessage("Tên loại vật tư không được để trống.")
            .MaximumLength(200).WithMessage("Tên loại vật tư không được vượt quá 200 ký tự.");
    }
}

public class UpdateMaterialCategoryCommandHandler : IRequestHandler<UpdateMaterialCategoryCommand, MaterialCategoryDto>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;

    public UpdateMaterialCategoryCommandHandler(IUnitOfWork unitOfWork, IMapper mapper)
    {
        _unitOfWork = unitOfWork;
        _mapper = mapper;
    }

    public async Task<MaterialCategoryDto> Handle(UpdateMaterialCategoryCommand request, CancellationToken cancellationToken)
    {
        var repository = _unitOfWork.Repository<MaterialCategory>();

        var entity = await repository.GetByIdAsync(request.CategoryId);
        if (entity == null || entity.IsDeleted)
        {
            throw new NotFoundException(nameof(MaterialCategory), request.CategoryId);
        }

        var exists = await repository.AnyAsync(x => x.CategoryName == request.CategoryName && x.CategoryId != request.CategoryId && !x.IsDeleted, cancellationToken);
        if (exists)
        {
            throw new DuplicateEntryException("CategoryName", request.CategoryName);
        }

        entity.CategoryName = request.CategoryName;
        entity.Description = request.Description;

        repository.Update(entity);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return _mapper.Map<MaterialCategoryDto>(entity);
    }
}
