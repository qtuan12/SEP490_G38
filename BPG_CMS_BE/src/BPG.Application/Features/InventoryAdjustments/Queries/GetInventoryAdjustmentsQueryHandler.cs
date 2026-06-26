using AutoMapper;
using BPG.Domain.Exceptions;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Application.Common.Models;
using BPG.Application.DTOs.Inventory;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.InventoryAdjustments.Queries
{
    public class GetInventoryAdjustmentsQueryHandler : IRequestHandler<GetInventoryAdjustmentsQuery, PagedList<InventoryAdjustmentDto>>
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly IMapper _mapper;

        public GetInventoryAdjustmentsQueryHandler(IUnitOfWork unitOfWork, IMapper mapper)
        {
            _unitOfWork = unitOfWork;
            _mapper = mapper;
        }

        public async Task<PagedList<InventoryAdjustmentDto>> Handle(GetInventoryAdjustmentsQuery request, CancellationToken cancellationToken)
        {
            var query = _unitOfWork.Repository<InventoryAdjustment>().Query()
                .Include(x => x.Project)
                .Include(x => x.Approver)
                .Include(x => x.Items).ThenInclude(i => i.Material)
                .Include(x => x.Items).ThenInclude(i => i.Unit)
                .Where(x => x.ProjectId == request.ProjectId)
                .AsNoTracking();

            if (!string.IsNullOrEmpty(request.AdjustmentType))
            {
                query = query.Where(x => x.AdjustmentType == request.AdjustmentType);
            }

            if (!string.IsNullOrEmpty(request.Status))
            {
                query = query.Where(x => x.Status == request.Status);
            }

            query = query.OrderByDescending(x => x.CreatedAt);

            var pagedResult = await query.ToPagedListAsync(request, cancellationToken);
            
            // Map items
            var itemsDto = _mapper.Map<List<InventoryAdjustmentDto>>(pagedResult.Items);
            
            return new PagedList<InventoryAdjustmentDto>(itemsDto, pagedResult.TotalCount, pagedResult.PageNumber, pagedResult.PageSize);
        }
    }
}
