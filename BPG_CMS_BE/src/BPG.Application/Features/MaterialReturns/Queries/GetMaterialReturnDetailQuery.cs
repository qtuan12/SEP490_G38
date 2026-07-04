using BPG.Application.Common.Models;
using BPG.Application.DTOs.MaterialReturns;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.MaterialReturns.Queries
{
    public record GetMaterialReturnDetailQuery(long ReturnId) : IRequest<ApiResponse<MaterialReturnDetailDto>>;

    public class GetMaterialReturnDetailQueryHandler : IRequestHandler<GetMaterialReturnDetailQuery, ApiResponse<MaterialReturnDetailDto>>
    {
        private readonly IUnitOfWork _uow;

        public GetMaterialReturnDetailQueryHandler(IUnitOfWork uow)
        {
            _uow = uow;
        }

        public async Task<ApiResponse<MaterialReturnDetailDto>> Handle(GetMaterialReturnDetailQuery request, CancellationToken cancellationToken)
        {
            var ret = await _uow.Repository<MaterialReturn>().Query()
                .Include(r => r.OriginalIssuance)
                    .ThenInclude(i => i.Task)
                .Include(r => r.Items)
                    .ThenInclude(i => i.Material)
                .Include(r => r.Items)
                    .ThenInclude(i => i.Unit)
                .AsSplitQuery()
                .AsNoTracking()
                .FirstOrDefaultAsync(r => r.MaterialReturnId == request.ReturnId, cancellationToken);

            if (ret == null)
            {
                throw new NotFoundException(nameof(MaterialReturn), request.ReturnId);
            }

            string creatorName = "N/A";
            if (ret.CreatedBy.HasValue)
            {
                var user = await _uow.Repository<User>().GetByIdAsync(ret.CreatedBy.Value, cancellationToken);
                if (user != null) creatorName = user.FullName;
            }

            var dto = new MaterialReturnDetailDto
            {
                MaterialReturnId = ret.MaterialReturnId,
                ReturnNo = ret.ReturnNo,
                OriginalIssuanceId = ret.OriginalIssuanceId,
                OriginalIssuanceNo = ret.OriginalIssuance?.IssuanceNo ?? string.Empty,
                TaskId = ret.OriginalIssuance?.TaskId ?? 0,
                TaskName = ret.OriginalIssuance?.Task?.Name ?? string.Empty,
                Reason = ret.Reason,
                CreatedAt = ret.CreatedAt,
                CreatedByName = creatorName,
                Items = ret.Items.Select(i => new MaterialReturnItemDto
                {
                    ReturnItemId = i.ReturnItemId,
                    MaterialId = i.MaterialId,
                    MaterialCode = i.Material?.Code ?? string.Empty,
                    MaterialName = i.Material?.Name ?? string.Empty,
                    UnitId = i.UnitId,
                    UnitName = i.Unit?.UnitName ?? string.Empty,
                    Quantity = i.Quantity,
                    ConversionRate = i.ConversionRate
                }).ToList()
            };

            return ApiResponse<MaterialReturnDetailDto>.SuccessResult(dto);
        }
    }
}
