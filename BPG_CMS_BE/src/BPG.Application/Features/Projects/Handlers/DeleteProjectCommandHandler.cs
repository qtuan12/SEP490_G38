using BPG.Application.Features.Projects.Commands;
using BPG.Application.IRepositories;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.Projects.Handlers;

public class DeleteProjectCommandHandler : IRequestHandler<DeleteProjectCommand, bool>
{
    private readonly IUnitOfWork _uow;

    public DeleteProjectCommandHandler(IUnitOfWork uow)
    {
        _uow = uow;
    }

    public async Task<bool> Handle(DeleteProjectCommand request, CancellationToken cancellationToken)
    {
        var project = await _uow.Repository<Project>().GetByIdAsync(request.ProjectId, cancellationToken);

        if (project == null)
            throw new NotFoundException(nameof(Project), request.ProjectId);

        if (project.Status != ProjectStatus.Draft)
            throw new BusinessException("ERR_PROJECT_DELETE", $"Chỉ có thể xóa dự án khi đang ở trạng thái Draft. Trạng thái hiện tại: {project.Status}");

        project.IsDeleted = true;

        _uow.Repository<Project>().Update(project);
        await _uow.SaveChangesAsync(cancellationToken);

        return true;
    }
}
