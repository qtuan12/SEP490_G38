using BPG.Application.Features.Projects.Commands;
using BPG.Application.IRepositories;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.Projects.Handlers;

public class PauseProjectCommandHandler : IRequestHandler<PauseProjectCommand, bool>
{
    private readonly IUnitOfWork _uow;

    public PauseProjectCommandHandler(IUnitOfWork uow)
    {
        _uow = uow;
    }

    public async Task<bool> Handle(PauseProjectCommand request, CancellationToken cancellationToken)
    {
        var project = await _uow.Repository<Project>().GetByIdAsync(request.ProjectId, cancellationToken);

        if (project == null)
            throw new NotFoundException(nameof(Project), request.ProjectId);

        if (project.Status != ProjectStatus.InProgress)
            throw new BusinessException("ERR_PROJECT_PAUSE", $"Chỉ có thể tạm dừng dự án khi đang ở trạng thái Active. Trạng thái hiện tại: {project.Status}");

        project.Status = ProjectStatus.Paused;
        project.PauseReason = request.PauseReason;
        project.PausedAt = System.DateTime.UtcNow;

        _uow.Repository<Project>().Update(project);
        await _uow.SaveChangesAsync(cancellationToken);

        return true;
    }
}
