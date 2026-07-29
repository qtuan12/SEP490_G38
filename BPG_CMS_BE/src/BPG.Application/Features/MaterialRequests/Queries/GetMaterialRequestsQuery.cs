using MediatR;
using AutoMapper;
using BPG.Application.Common.Models;
using BPG.Application.DTOs.MaterialRequests;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.MaterialRequests.Queries
{
    public class GetMaterialRequestsQuery : PaginationRequest, IRequest<PagedList<MaterialRequestDto>>
    {
        public long? ProjectId { get; set; }
        public long? PhaseId { get; set; }
        public string? Status { get; set; }

        public Task<long?> GetProjectIdAsync(IUnitOfWork unitOfWork, CancellationToken cancellationToken)
            => Task.FromResult(ProjectId);
    }

    public class GetMaterialRequestsQueryHandler : IRequestHandler<GetMaterialRequestsQuery, PagedList<MaterialRequestDto>>
    {
        private readonly IUnitOfWork _uow;
        private readonly IMapper _mapper;
        private readonly ICurrentUserService _currentUserService;
        private readonly IProjectAccessService _projectAccessService;

        public GetMaterialRequestsQueryHandler(
            IUnitOfWork uow,
            IMapper mapper,
            ICurrentUserService currentUserService,
            IProjectAccessService projectAccessService)
        {
            _uow = uow;
            _mapper = mapper;
            _currentUserService = currentUserService;
            _projectAccessService = projectAccessService;
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

            if (!request.ProjectId.HasValue)
            {
                if (!_currentUserService.IsInAnyRole(BPG.Domain.Constants.UserRole.Admin, BPG.Domain.Constants.UserRole.Accountant, BPG.Domain.Constants.UserRole.TechnicalManager, BPG.Domain.Constants.UserRole.Director))
                    throw new ForbiddenException("Báº¡n khÃ´ng cÃ³ quyá»n xem Ä‘á» xuáº¥t váº­t tÆ° toÃ n há»‡ thá»‘ng.");

                var accessibleProjectIds = await _projectAccessService.GetAccessibleProjectIdsAsync(cancellationToken);
                query = query.Where(mr => accessibleProjectIds.Contains(mr.Phase.ProjectId));
            }

            // Ãp dá»¥ng bá»™ lá»c
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

            // Sáº¯p xáº¿p máº·c Ä‘á»‹nh theo ngÃ y táº¡o má»›i nháº¥t
            query = query.OrderByDescending(mr => mr.CreatedAt);

            // PhÃ¢n trang
            var pagedEntities = await query.ToPagedListAsync(request, cancellationToken);

            // Mapping sang DTO
            var mappedItems = _mapper.Map<List<MaterialRequestDto>>(pagedEntities.Items);

            // Äiá»n tÃªn ngÆ°á»i táº¡o (CreatedByName)
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



