using AutoMapper;
using BPG.Application.Features.Units.Commands;
using BPG.Application.Features.Units.DTOs;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

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

        if (entity.IsDiscrete != request.IsDiscrete)
        {
            var isUsedInCatalog = await _uow.Repository<MaterialCatalog>().Query()
                .AnyAsync(m => m.BaseUnitId == request.UnitId && !m.IsDeleted, cancellationToken);
            
            var isUsedInConversion = await _uow.Repository<MaterialConversion>().Query()
                .AnyAsync(c => c.AlternativeUnitId == request.UnitId, cancellationToken);

            var isUsedInRequest = await _uow.Repository<MaterialRequestItem>().Query()
                .AnyAsync(i => i.UnitId == request.UnitId, cancellationToken);

            var isUsedInPO = await _uow.Repository<PurchaseOrderItem>().Query()
                .AnyAsync(i => i.UnitId == request.UnitId, cancellationToken);

            var isUsedInGR = await _uow.Repository<GoodsReceiptItem>().Query()
                .AnyAsync(i => i.UnitId == request.UnitId, cancellationToken);

            var isUsedInIssuance = await _uow.Repository<MaterialIssuanceItem>().Query()
                .AnyAsync(i => i.UnitId == request.UnitId, cancellationToken);

            var isUsedInAdjustment = await _uow.Repository<AdjustmentItem>().Query()
                .AnyAsync(i => i.UnitId == request.UnitId, cancellationToken);

            var isUsedInSurplus = await _uow.Repository<SurplusRequestItem>().Query()
                .AnyAsync(i => i.UnitId == request.UnitId, cancellationToken);

            if (isUsedInCatalog || isUsedInConversion || isUsedInRequest || isUsedInPO || isUsedInGR || isUsedInIssuance || isUsedInAdjustment || isUsedInSurplus)
            {
                throw new BusinessException("ERR_UNIT_IN_USE", "Không thể thay đổi thuộc tính Số nguyên/Số thập phân của đơn vị tính đã được sử dụng trong hệ thống.");
            }
        }

        entity.UnitCode = trimmedCode;
        entity.UnitName = request.UnitName.Trim();
        entity.IsDiscrete = request.IsDiscrete;

        repository.Update(entity);
        await _uow.SaveChangesAsync(cancellationToken);

        return _mapper.Map<UnitDto>(entity);
    }
}
