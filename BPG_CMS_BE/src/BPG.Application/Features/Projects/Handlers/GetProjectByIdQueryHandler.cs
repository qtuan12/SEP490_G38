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
    private readonly BPG.Application.IServices.ICurrentUserService _currentUserService;

    public GetProjectByIdQueryHandler(IUnitOfWork uow, IMapper mapper, BPG.Application.IServices.ICurrentUserService currentUserService)
    {
        _uow = uow;
        _mapper = mapper;
        _currentUserService = currentUserService;
    }

    public async Task<ProjectDetailDto> Handle(GetProjectByIdQuery request, CancellationToken cancellationToken)
    {
        var project = await _uow.Repository<Project>().Query()
            .AsNoTracking()
            .Include(p => p.Members)
                .ThenInclude(m => m.User)
                    .ThenInclude(u => u.UserRoles)
                        .ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(p => p.ProjectId == request.Id, cancellationToken);

        if (project == null)
            throw new NotFoundException(nameof(Project), request.Id);

        if (_currentUserService.IsInRole(BPG.Domain.Constants.UserRole.SiteEngineer))
        {
            var currentUserId = _currentUserService.GetRequiredUserId();
            if (!project.Members.Any(m => m.UserId == currentUserId))
            {
                throw new ForbiddenException("Bạn không được phân công vào dự án này nên không có quyền xem thông tin.");
            }
        }

        var attachments = await _uow.Repository<Attachment>().Query()
            .AsNoTracking()
            .Where(a => a.EntityType == EntityType.Project && a.EntityId == project.ProjectId)
            .ToListAsync(cancellationToken);

        var dto = _mapper.Map<ProjectDetailDto>(project);

        var tasks = await _uow.Repository<ProjectTask>().Query()
            .AsNoTracking()
            .Where(t => t.Phase.ProjectId == request.Id && t.Status != BPG.Domain.Constants.TaskStatus.Obsolete)
            .Select(t => new { t.TaskId, t.ParentTaskId, t.StartDate, t.EndDate, t.ProgressPercent, t.Weight })
            .ToListAsync(cancellationToken);

        int projectProgress = 0;
        var leafTasks = tasks.Where(t => !tasks.Any(c => c.ParentTaskId == t.TaskId)).ToList();
        if (leafTasks.Any())
        {
            double totalWeightedProgress = 0;
            double totalWeight = 0;
            foreach (var t in leafTasks)
            {
                var duration = (t.EndDate.ToDateTime(TimeOnly.MinValue) - t.StartDate.ToDateTime(TimeOnly.MinValue)).TotalDays + 1;
                double baseWeight = duration > 0 ? duration : 1;
                double weight = (t.Weight.HasValue && t.Weight.Value > 0) ? baseWeight * (double)t.Weight.Value : baseWeight;
                totalWeightedProgress += t.ProgressPercent * weight;
                totalWeight += weight;
            }
            if (totalWeight > 0)
            {
                projectProgress = (int)Math.Round(totalWeightedProgress / totalWeight);
            }
        }

        dto.Progress = projectProgress;
        
        dto.Attachments = _mapper.Map<System.Collections.Generic.List<AttachmentDto>>(attachments);

        return dto;
    }
}
