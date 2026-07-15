using AutoMapper;
using BPG.Application.Features.Units.Commands;
using BPG.Application.Features.Units.DTOs;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;

namespace BPG.Application.Features.Units.Handlers;

public class CreateUnitCommandHandler : IRequestHandler<CreateUnitCommand, UnitDto>
{
    private readonly IUnitOfWork _uow;
    private readonly IMapper _mapper;

    public CreateUnitCommandHandler(IUnitOfWork uow, IMapper mapper)
    {
        _uow = uow;
        _mapper = mapper;
    }

    public async Task<UnitDto> Handle(CreateUnitCommand request, CancellationToken cancellationToken)
    {
        var trimmedCode = request.UnitCode.Trim();
        var codeExists = await _uow.Repository<BPG.Domain.Entities.Unit>().AnyAsync(
            x => x.UnitCode.Trim().ToLower() == trimmedCode.ToLower() && !x.IsDeleted,
            cancellationToken
        );

        if (codeExists)
        {
            throw new DuplicateEntryException("UnitCode", request.UnitCode);
        }

        var entity = new BPG.Domain.Entities.Unit
        {
            UnitCode = trimmedCode,
            UnitName = request.UnitName.Trim(),
            IsDiscrete = request.IsDiscrete
        };

        await _uow.Repository<BPG.Domain.Entities.Unit>().AddAsync(entity);
        await _uow.SaveChangesAsync(cancellationToken);

        return _mapper.Map<UnitDto>(entity);
    }
}
