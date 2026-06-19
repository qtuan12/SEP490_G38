using BPG.Application.Features.Projects.Commands;
using BPG.Application.IRepositories;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.Projects.Handlers;

public class ResumeProjectCommandHandler : IRequestHandler<ResumeProjectCommand, bool>
{
    private readonly IUnitOfWork _uow;

    public ResumeProjectCommandHandler(IUnitOfWork uow)
    {
        _uow = uow;
    }

    public async Task<bool> Handle(ResumeProjectCommand request, CancellationToken cancellationToken)
    {
        var project = await _uow.Repository<Project>().GetByIdAsync(request.ProjectId, cancellationToken);

        if (project == null)
            throw new NotFoundException(nameof(Project), request.ProjectId);

        if (project.Status != ProjectStatus.Paused)
            throw new BusinessException("ERR_PROJECT_RESUME", $"Chỉ có thể tiếp tục dự án khi đang ở trạng thái Paused. Trạng thái hiện tại: {project.Status}");

        project.Status = ProjectStatus.InProgress;
        project.ResumedAt = System.DateTime.UtcNow;

        _uow.Repository<Project>().Update(project);
        await _uow.SaveChangesAsync(cancellationToken);

        return true;
    }
}
