namespace BPG.Application.Features.Projects.Handlers;

using AutoMapper;
using BPG.Domain.Exceptions;
using BPG.Application.Features.Projects.Commands;
using BPG.Application.Features.Projects.DTOs;
using BPG.Application.IRepositories;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using MediatR;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

public class UpdateProjectCommandHandler : IRequestHandler<UpdateProjectCommand, ProjectDto>
{
    private readonly IUnitOfWork _uow;
    private readonly IMapper _mapper;

    public UpdateProjectCommandHandler(IUnitOfWork uow, IMapper mapper)
    {
        _uow = uow;
        _mapper = mapper;
    }

    public async Task<ProjectDto> Handle(UpdateProjectCommand request, CancellationToken cancellationToken)
    {
        var project = await _uow.Repository<Project>().GetByIdAsync(request.ProjectId);
        if (project == null)
            throw new NotFoundException(nameof(Project), request.ProjectId);


        project.Name = request.Name;
        project.Address = request.Address;
        project.PlannedStart = request.PlannedStart;
        project.PlannedEnd = request.PlannedEnd;

        _uow.Repository<Project>().Update(project);

        if (request.Attachments != null)
        {
            // Remove old design attachments
            var oldAttachments = await _uow.Repository<Attachment>().FindAsync(a => a.EntityId == project.ProjectId && a.EntityType == EntityType.Project && a.AttachmentType == AttachmentType.Design);
            if (oldAttachments.Any())
            {
                _uow.Repository<Attachment>().RemoveRange(oldAttachments);
            }

            if (request.Attachments.Any())
            {
                // Add new design attachments
                var attachments = request.Attachments.Select(a => new Attachment
                {
                    EntityType = EntityType.Project,
                    EntityId = project.ProjectId,
                    AttachmentType = AttachmentType.Design,
                    FileName = a.FileName,
                    FileUrl = a.FileUrl,
                    ContentType = a.ContentType,
                    FileSizeBytes = a.FileSizeBytes
                });
                await _uow.Repository<Attachment>().AddRangeAsync(attachments);
            }
        }

        await _uow.SaveChangesAsync(cancellationToken);

        return _mapper.Map<ProjectDto>(project);
    }
}
