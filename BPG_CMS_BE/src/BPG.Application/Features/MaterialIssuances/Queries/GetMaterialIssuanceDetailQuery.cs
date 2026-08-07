using BPG.Application.Common.Models;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using BPG.Application.DTOs.MaterialIssuances;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.MaterialIssuances.Queries
{
    public record GetMaterialIssuanceDetailQuery(long IssuanceId) : IRequest<ApiResponse<MaterialIssuanceDetailDto>>
    {
        public async Task<long> GetProjectIdAsync(IUnitOfWork unitOfWork, CancellationToken cancellationToken)
        {
            var projectId = await unitOfWork.Repository<MaterialIssuance>().Query()
                .Where(m => m.MaterialIssuanceId == IssuanceId)
                .Select(m => m.Task.Phase.ProjectId)
                .FirstOrDefaultAsync(cancellationToken);

            if (projectId == 0)
                throw new NotFoundException(nameof(MaterialIssuance), IssuanceId);

            return projectId;
        }
    }

    public class GetMaterialIssuanceDetailQueryHandler : IRequestHandler<GetMaterialIssuanceDetailQuery, ApiResponse<MaterialIssuanceDetailDto>>
    {
        private readonly IUnitOfWork _uow;

        public GetMaterialIssuanceDetailQueryHandler(IUnitOfWork uow)
        {
            _uow = uow;
        }

        public async Task<ApiResponse<MaterialIssuanceDetailDto>> Handle(GetMaterialIssuanceDetailQuery request, CancellationToken cancellationToken)
        {
            var mi = await _uow.Repository<MaterialIssuance>().Query()
                .Include(m => m.Task)
                .Include(m => m.Items)
                    .ThenInclude(i => i.Material)
                .Include(m => m.Items)
                    .ThenInclude(i => i.Unit)
                .FirstOrDefaultAsync(m => m.MaterialIssuanceId == request.IssuanceId, cancellationToken);

            if (mi == null)
            {
                throw new NotFoundException(nameof(MaterialIssuance), request.IssuanceId);
            }

            // Fetch CreatedBy User
            string creatorName = "N/A";
            if (mi.CreatedBy.HasValue)
            {
                var user = await _uow.Repository<User>().GetByIdAsync(mi.CreatedBy.Value, cancellationToken);
                if (user != null)
                {
                    creatorName = user.FullName;
                }
            }

            var dto = new MaterialIssuanceDetailDto
            {
                MaterialIssuanceId = mi.MaterialIssuanceId,
                IssuanceNo = mi.IssuanceNo,
                TaskId = mi.TaskId,
                TaskName = mi.Task?.Name ?? string.Empty,
                Purpose = mi.Purpose,
                CreatedAt = mi.CreatedAt,
                CreatedByName = creatorName,
                Items = mi.Items.Select(i => new MaterialIssuanceItemDto
                {
                    IssuanceItemId = i.IssuanceItemId,
                    MaterialId = i.MaterialId,
                    MaterialCode = i.Material.Code,
                    MaterialName = i.Material.Name,
                    UnitId = i.UnitId,
                    UnitName = i.Unit.UnitName,
                    Quantity = i.Quantity,
                    ConversionRate = i.ConversionRate
                }).ToList()
            };

            return ApiResponse<MaterialIssuanceDetailDto>.SuccessResult(dto);
        }
    }
}

