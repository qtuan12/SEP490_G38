using MediatR;
using AutoMapper;
using BPG.Application.Common.Models;
using BPG.Application.DTOs.MaterialRequests;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.MaterialRequests.Queries
{
    public record GetMaterialRequestDetailQuery(long RequestId) : IRequest<ApiResponse<MaterialRequestDto>>
    {
        public async Task<long> GetProjectIdAsync(IUnitOfWork unitOfWork, CancellationToken cancellationToken)
        {
            var projectId = await unitOfWork.Repository<MaterialRequest>().Query()
                .Where(mr => mr.RequestId == RequestId)
                .Select(mr => mr.Phase.ProjectId)
                .FirstOrDefaultAsync(cancellationToken);

            if (projectId == 0)
                throw new NotFoundException(nameof(MaterialRequest), RequestId);

            return projectId;
        }
    }

    public class GetMaterialRequestDetailQueryHandler : IRequestHandler<GetMaterialRequestDetailQuery, ApiResponse<MaterialRequestDto>>
    {
        private readonly IUnitOfWork _uow;
        private readonly IMapper _mapper;

        public GetMaterialRequestDetailQueryHandler(IUnitOfWork uow, IMapper mapper)
        {
            _uow = uow;
            _mapper = mapper;
        }

        public async Task<ApiResponse<MaterialRequestDto>> Handle(GetMaterialRequestDetailQuery request, CancellationToken cancellationToken)
        {
            var mr = await _uow.Repository<MaterialRequest>().Query()
                .Include(x => x.Phase)
                .Include(x => x.Checker)
                .Include(x => x.Approver)
                .Include(x => x.Items)
                    .ThenInclude(ri => ri.Material)
                .Include(x => x.Items)
                    .ThenInclude(ri => ri.Unit)
                .FirstOrDefaultAsync(x => x.RequestId == request.RequestId, cancellationToken);

            if (mr == null)
            {
                throw new NotFoundException(nameof(MaterialRequest), request.RequestId);
            }

            var dto = _mapper.Map<MaterialRequestDto>(mr);

            // Äiá»n tÃªn ngÆ°á»i táº¡o (CreatedByName)
            if (mr.CreatedBy.HasValue)
            {
                var creator = await _uow.Repository<User>().Query()
                    .FirstOrDefaultAsync(u => u.UserId == mr.CreatedBy.Value, cancellationToken);
                if (creator != null)
                {
                    dto.CreatedByName = creator.FullName;
                }
            }

            return ApiResponse<MaterialRequestDto>.SuccessResult(dto, "Láº¥y thÃ´ng tin chi tiáº¿t yÃªu cáº§u váº­t tÆ° thÃ nh cÃ´ng.");
        }
    }
}

