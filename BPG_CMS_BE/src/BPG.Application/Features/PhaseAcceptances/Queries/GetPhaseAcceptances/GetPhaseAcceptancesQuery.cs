using AutoMapper;
using BPG.Application.Common.Models;
using BPG.Application.Features.PhaseAcceptances.DTOs;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.PhaseAcceptances.Queries.GetPhaseAcceptances;

public class GetPhaseAcceptancesQuery : PaginationRequest, IRequest<PagedList<PhaseAcceptanceDto>>
{
    public long? ProjectId { get; set; }
    public long? PhaseId { get; set; }
}

public class GetPhaseAcceptancesQueryHandler : IRequestHandler<GetPhaseAcceptancesQuery, PagedList<PhaseAcceptanceDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;

    public GetPhaseAcceptancesQueryHandler(IUnitOfWork unitOfWork, IMapper mapper)
    {
        _unitOfWork = unitOfWork;
        _mapper = mapper;
    }

    public async Task<PagedList<PhaseAcceptanceDto>> Handle(GetPhaseAcceptancesQuery request, CancellationToken ct)
    {
        var repo = _unitOfWork.Repository<PhaseAcceptance>();

        var query = repo.Query()
            .Include(x => x.Phase)
                .ThenInclude(p => p.Project)
            .Include(x => x.Acceptor)
            .AsNoTracking();

        if (request.PhaseId.HasValue)
        {
            query = query.Where(x => x.PhaseId == request.PhaseId.Value);
        }

        if (request.ProjectId.HasValue)
        {
            query = query.Where(x => x.Phase.ProjectId == request.ProjectId.Value);
        }

        query = query.OrderByDescending(x => x.AcceptanceDate);

        var pagedEntities = await query.ToPagedListAsync(request, ct);
        
        var dtoList = _mapper.Map<List<PhaseAcceptanceDto>>(pagedEntities.Items);

        // Map CancelledByName manually to avoid EF Core schema changes
        var cancelledUserIds = pagedEntities.Items.Where(x => x.CancelledBy.HasValue).Select(x => x.CancelledBy!.Value).Distinct().ToList();
        if (cancelledUserIds.Any())
        {
            var userRepo = _unitOfWork.Repository<User>();
            var cancelUsers = await userRepo.Query().Where(u => cancelledUserIds.Contains(u.UserId)).ToDictionaryAsync(u => u.UserId, u => u.FullName, ct);
            foreach(var dto in dtoList)
            {
                var entity = pagedEntities.Items.FirstOrDefault(x => x.AcceptanceId == dto.AcceptanceId);
                if (entity?.CancelledBy != null && cancelUsers.ContainsKey(entity.CancelledBy.Value))
                {
                    dto.CancelledByName = cancelUsers[entity.CancelledBy.Value];
                }
            }
        }

        return new PagedList<PhaseAcceptanceDto>(dtoList, pagedEntities.TotalCount, pagedEntities.PageNumber, pagedEntities.PageSize);
    }
}
