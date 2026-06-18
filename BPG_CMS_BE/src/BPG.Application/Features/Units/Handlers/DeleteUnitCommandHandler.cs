using BPG.Application.Features.Units.Commands;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;

namespace BPG.Application.Features.Units.Handlers;

public class DeleteUnitCommandHandler : IRequestHandler<DeleteUnitCommand, bool>
{
    private readonly IUnitOfWork _uow;

    public DeleteUnitCommandHandler(IUnitOfWork uow)
    {
        _uow = uow;
    }

    public async Task<bool> Handle(DeleteUnitCommand request, CancellationToken cancellationToken)
    {
        var repository = _uow.Repository<BPG.Domain.Entities.Unit>();
        var entity = await repository.FirstOrDefaultAsync(x => x.UnitId == request.UnitId, cancellationToken);

        if (entity == null || entity.IsDeleted)
        {
            throw new NotFoundException("Unit", request.UnitId);
        }

        var isUsedAsBase = await _uow.Repository<MaterialCatalog>().AnyAsync(x => x.BaseUnitId == request.UnitId && !x.IsDeleted, cancellationToken);
        if (isUsedAsBase)
        {
            throw new BusinessException("ERR_UNIT_USED_AS_BASE", "Không thể xóa đơn vị này vì đang được sử dụng làm đơn vị gốc cho một số vật tư.");
        }

        var isUsedInConversion = await _uow.Repository<MaterialConversion>().AnyAsync(x => x.AlternativeUnitId == request.UnitId && !x.IsDeleted, cancellationToken);
        if (isUsedInConversion)
        {
            throw new BusinessException("ERR_UNIT_USED_IN_CONVERSION", "Không thể xóa đơn vị này vì đang được sử dụng trong tỷ lệ quy đổi của một số vật tư.");
        }

        entity.IsDeleted = true;
        repository.Update(entity);
        await _uow.SaveChangesAsync(cancellationToken);

        return true;
    }
}
