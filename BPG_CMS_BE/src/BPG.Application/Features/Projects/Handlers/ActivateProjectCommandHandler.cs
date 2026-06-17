namespace BPG.Application.Features.Projects.Handlers;

using BPG.Domain.Exceptions;
using BPG.Application.Features.Projects.Commands;
using BPG.Application.IRepositories;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

public class ActivateProjectCommandHandler : IRequestHandler<ActivateProjectCommand, MediatR.Unit>
{
    private readonly IUnitOfWork _uow;

    public ActivateProjectCommandHandler(IUnitOfWork uow)
    {
        _uow = uow;
    }

    public async Task<MediatR.Unit> Handle(ActivateProjectCommand request, CancellationToken cancellationToken)
    {
        var project = await _uow.Repository<Project>().Query()
            .Include(p => p.Phases)
                .ThenInclude(ph => ph.Tasks)
            .FirstOrDefaultAsync(p => p.ProjectId == request.ProjectId, cancellationToken);

        if (project == null)
            throw new NotFoundException(nameof(Project), request.ProjectId);

        if (project.Status != ProjectStatus.Draft)
            throw new BusinessException("ERR_PROJECT_NOT_DRAFT", "Dự án phải ở trạng thái Draft để kích hoạt.");

        var hasAnyTask = project.Phases.Any(ph => ph.Tasks.Any());
        if (!hasAnyTask)
            throw new BusinessException("ERR_PROJECT_NO_TASKS", "Không thể kích hoạt dự án vì WBS chưa có task nào.");

        project.Status = ProjectStatus.InProgress;
        _uow.Repository<Project>().Update(project);
        await _uow.SaveChangesAsync(cancellationToken);

        return MediatR.Unit.Value;
    }
}
