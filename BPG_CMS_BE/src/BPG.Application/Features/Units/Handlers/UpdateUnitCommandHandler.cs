using AutoMapper;
using BPG.Application.Features.Units.Commands;
using BPG.Application.Features.Units.DTOs;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;

namespace BPG.Application.Features.Units.Handlers;

public class UpdateUnitCommandHandler : IRequestHandler<UpdateUnitCommand, UnitDto>
{
    private readonly IUnitOfWork _uow;
    private readonly IMapper _mapper;

    public UpdateUnitCommandHandler(IUnitOfWork uow, IMapper mapper)
    {
        _uow = uow;
        _mapper = mapper;
    }

    public async Task<UnitDto> Handle(UpdateUnitCommand request, CancellationToken cancellationToken)
    {
        var repository = _uow.Repository<BPG.Domain.Entities.Unit>();
        var entity = await repository.FirstOrDefaultAsync(x => x.UnitId == request.UnitId, cancellationToken);

        if (entity == null || entity.IsDeleted)
        {
            throw new NotFoundException("Unit", request.UnitId);
        }

        var trimmedCode = request.UnitCode.Trim();
        var codeExists = await repository.AnyAsync(
            x => x.UnitId != request.UnitId && x.UnitCode.Trim().ToLower() == trimmedCode.ToLower() && !x.IsDeleted,
            cancellationToken
        );

        if (codeExists)
        {
            throw new DuplicateEntryException("UnitCode", request.UnitCode);
        }

        entity.UnitCode = trimmedCode;
        entity.UnitName = request.UnitName.Trim();

        repository.Update(entity);
        await _uow.SaveChangesAsync(cancellationToken);

        return _mapper.Map<UnitDto>(entity);
    }
}
