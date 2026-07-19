using MediatR;
using BPG.Application.Common.Interfaces;
using AutoMapper;
using BPG.Application.Common.Models;
using BPG.Application.DTOs.MaterialRequests;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.MaterialRequests.Queries
{
    public class GetMaterialRequestsQuery : PaginationRequest, IRequest<PagedList<MaterialRequestDto>>, IProjectRequirement
    {
        public long? ProjectId { get; set; }
        public long? PhaseId { get; set; }
        public string? Status { get; set; }

        public Task<long> GetProjectIdAsync(IUnitOfWork unitOfWork, CancellationToken cancellationToken)
        {
            if (ProjectId == null)
                throw new NotFoundException("ProjectId");
            return Task.FromResult(ProjectId.Value);
        }
    }

    public class GetMaterialRequestsQueryHandler : IRequestHandler<GetMaterialRequestsQuery, PagedList<MaterialRequestDto>>
    {
        private readonly IUnitOfWork _uow;
        private readonly IMapper _mapper;

        public GetMaterialRequestsQueryHandler(IUnitOfWork uow, IMapper mapper)
        {
            _uow = uow;
            _mapper = mapper;
        }

        public async Task<PagedList<MaterialRequestDto>> Handle(GetMaterialRequestsQuery request, CancellationToken cancellationToken)
        {
            var query = _uow.Repository<MaterialRequest>().Query()
                .Include(mr => mr.Phase)
                .Include(mr => mr.Checker)
                .Include(mr => mr.Approver)
                .Include(mr => mr.Items)
                    .ThenInclude(ri => ri.Material)
                .Include(mr => mr.Items)
                    .ThenInclude(ri => ri.Unit)
                .AsNoTracking();

            // Áp dụng bộ lọc
            if (request.ProjectId.HasValue)
            {
                query = query.Where(mr => mr.Phase.ProjectId == request.ProjectId.Value);
            }

            if (request.PhaseId.HasValue)
            {
                query = query.Where(mr => mr.PhaseId == request.PhaseId.Value);
            }

            if (!string.IsNullOrWhiteSpace(request.Status))
            {
                query = query.Where(mr => mr.Status == request.Status);
            }

            // Sắp xếp mặc định theo ngày tạo mới nhất
            query = query.OrderByDescending(mr => mr.CreatedAt);

            // Phân trang
            var pagedEntities = await query.ToPagedListAsync(request, cancellationToken);

            // Mapping sang DTO
            var mappedItems = _mapper.Map<List<MaterialRequestDto>>(pagedEntities.Items);

            // Điền tên người tạo (CreatedByName)
            var creatorIds = pagedEntities.Items
                .Where(x => x.CreatedBy.HasValue)
                .Select(x => x.CreatedBy!.Value)
                .Distinct()
                .ToList();

            if (creatorIds.Any())
            {
                var creators = await _uow.Repository<User>().Query()
                    .Where(u => creatorIds.Contains(u.UserId))
                    .Select(u => new { u.UserId, u.FullName })
                    .ToDictionaryAsync(u => u.UserId, u => u.FullName, cancellationToken);

                foreach (var dto in mappedItems)
                {
                    if (dto.CreatedBy.HasValue && creators.TryGetValue(dto.CreatedBy.Value, out var fullName))
                    {
                        dto.CreatedByName = fullName;
                    }
                }
            }

            return new PagedList<MaterialRequestDto>(mappedItems, pagedEntities.TotalCount, request.PageNumber, request.PageSize);
        }
    }
}
