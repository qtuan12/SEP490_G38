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
                .Include(x => x.Phase)
                .Include(x => x.Approver)
                .Include(x => x.Items).ThenInclude(i => i.Material)
                .Include(x => x.Items).ThenInclude(i => i.Unit)
                .AsNoTracking();

            if (request.ProjectId > 0)
            {
                query = query.Where(x => x.ProjectId == request.ProjectId);
            }

            if (!string.IsNullOrEmpty(request.AdjustmentType))
            {
                query = query.Where(x => x.AdjustmentType == request.AdjustmentType);
            }

            if (!string.IsNullOrEmpty(request.Status))
            {
                query = query.Where(x => x.Status == request.Status);
            }

            if (!string.IsNullOrEmpty(request.SearchTerm))
            {
                var term = request.SearchTerm.Trim().ToLower();
                var cleanTerm = term.Replace("adj-", "").Replace("adj", "").TrimStart('0');
                long.TryParse(cleanTerm, out long searchId);

                query = query.Where(x => 
                    x.Reason.ToLower().Contains(term) ||
                    (x.Description != null && x.Description.ToLower().Contains(term)) ||
                    x.AdjustmentId.ToString().Contains(term) ||
                    (searchId > 0 && x.AdjustmentId == searchId) ||
                    x.Items.Any(i => (i.Material != null && i.Material.Name.ToLower().Contains(term)) || (i.Material != null && i.Material.Code.ToLower().Contains(term)))
                );
            }

            query = query.OrderByDescending(x => x.CreatedAt);

            var pagedResult = await query.ToPagedListAsync(request, cancellationToken);
            
            // Map items
            var itemsDto = _mapper.Map<List<InventoryAdjustmentDto>>(pagedResult.Items);
            
            return new PagedList<InventoryAdjustmentDto>(itemsDto, pagedResult.TotalCount, pagedResult.PageNumber, pagedResult.PageSize);
        }
    }
}
