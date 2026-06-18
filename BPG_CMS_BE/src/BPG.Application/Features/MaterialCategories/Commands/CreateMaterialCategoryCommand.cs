using AutoMapper;
using BPG.Application.Features.MaterialCategories.DTOs;
using BPG.Domain.Exceptions;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.MaterialCategories.Commands;

public record CreateMaterialCategoryCommand : IRequest<MaterialCategoryDto>
{
    public string CategoryName { get; init; } = string.Empty;
    public string? Description { get; init; }
}

public class CreateMaterialCategoryCommandValidator : AbstractValidator<CreateMaterialCategoryCommand>
{
    public CreateMaterialCategoryCommandValidator()
    {
        RuleFor(v => v.CategoryName)
            .NotEmpty().WithMessage("Tên loại vật tư không được để trống.")
            .MaximumLength(200).WithMessage("Tên loại vật tư không được vượt quá 200 ký tự.");
    }
}

public class CreateMaterialCategoryCommandHandler : IRequestHandler<CreateMaterialCategoryCommand, MaterialCategoryDto>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;

    public CreateMaterialCategoryCommandHandler(IUnitOfWork unitOfWork, IMapper mapper)
    {
        _unitOfWork = unitOfWork;
        _mapper = mapper;
    }

    public async Task<MaterialCategoryDto> Handle(CreateMaterialCategoryCommand request, CancellationToken cancellationToken)
    {
        var repository = _unitOfWork.Repository<MaterialCategory>();

        var exists = await repository.AnyAsync(x => x.CategoryName == request.CategoryName && !x.IsDeleted, cancellationToken);
        if (exists)
        {
            throw new DuplicateEntryException("CategoryName", request.CategoryName);
        }

        var entity = new MaterialCategory
        {
            CategoryName = request.CategoryName,
            Description = request.Description
        };

        await repository.AddAsync(entity);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return _mapper.Map<MaterialCategoryDto>(entity);
    }
}
