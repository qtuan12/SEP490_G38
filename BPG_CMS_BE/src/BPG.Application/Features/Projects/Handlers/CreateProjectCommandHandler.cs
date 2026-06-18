namespace BPG.Application.Features.Projects.Handlers;

using AutoMapper;

using BPG.Application.Features.Projects.Commands;
using BPG.Application.Features.Projects.DTOs;
using BPG.Application.IRepositories;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using MediatR;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

public class CreateProjectCommandHandler : IRequestHandler<CreateProjectCommand, ProjectDto>
{
    private readonly IUnitOfWork _uow;
    private readonly IMapper _mapper;

    public CreateProjectCommandHandler(IUnitOfWork uow, IMapper mapper)
    {
        _uow = uow;
        _mapper = mapper;
    }

    public async Task<ProjectDto> Handle(CreateProjectCommand request, CancellationToken cancellationToken)
    {
        var project = new Project
        {
            Name = request.Name,
            Address = request.Address,
            PlannedStart = request.PlannedStart,
            PlannedEnd = request.PlannedEnd,
            Status = ProjectStatus.Draft
        };

        await _uow.Repository<Project>().AddAsync(project);
        await _uow.SaveChangesAsync(cancellationToken);

        if (request.Attachments != null && request.Attachments.Any())
        {
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
            await _uow.SaveChangesAsync(cancellationToken);
        }

        return _mapper.Map<ProjectDto>(project);
    }
}
