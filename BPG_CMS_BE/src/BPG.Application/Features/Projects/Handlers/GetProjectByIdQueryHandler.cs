namespace BPG.Application.Features.Projects.Handlers;

using AutoMapper;
using BPG.Domain.Exceptions;

using BPG.Application.Features.Projects.DTOs;
using BPG.Application.Features.Projects.Queries;
using BPG.Application.IRepositories;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

public class GetProjectByIdQueryHandler : IRequestHandler<GetProjectByIdQuery, ProjectDetailDto>
{
    private readonly IUnitOfWork _uow;
    private readonly IMapper _mapper;

    public GetProjectByIdQueryHandler(IUnitOfWork uow, IMapper mapper)
    {
        _uow = uow;
        _mapper = mapper;
    }

    public async Task<ProjectDetailDto> Handle(GetProjectByIdQuery request, CancellationToken cancellationToken)
    {
        var project = await _uow.Repository<Project>().Query()
            .AsNoTracking()
            .Include(p => p.Members)
                .ThenInclude(m => m.User)
            .FirstOrDefaultAsync(p => p.ProjectId == request.Id, cancellationToken);

        if (project == null)
            throw new NotFoundException(nameof(Project), request.Id);

        var attachments = await _uow.Repository<Attachment>().Query()
            .AsNoTracking()
            .Where(a => a.EntityType == EntityType.Project && a.EntityId == project.ProjectId)
            .ToListAsync(cancellationToken);

        var dto = _mapper.Map<ProjectDetailDto>(project);
        
        dto.Attachments = _mapper.Map<System.Collections.Generic.List<AttachmentDto>>(attachments);

        return dto;
    }
}
