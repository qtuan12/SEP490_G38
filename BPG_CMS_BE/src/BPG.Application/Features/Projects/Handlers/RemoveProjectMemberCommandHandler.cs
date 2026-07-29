using BPG.Application.Features.Projects.Commands;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.Projects.Handlers;

public class RemoveProjectMemberCommandHandler : IRequestHandler<RemoveProjectMemberCommand, bool>
{
    private readonly IUnitOfWork _uow;

    public RemoveProjectMemberCommandHandler(IUnitOfWork uow)
    {
        _uow = uow;
    }

    public async Task<bool> Handle(RemoveProjectMemberCommand request, CancellationToken cancellationToken)
    {
        var member = await _uow.Repository<ProjectMember>()
            .FirstOrDefaultAsync(m => m.ProjectId == request.ProjectId && m.UserId == request.UserId, cancellationToken);

        if (member == null || member.IsDeleted)
            throw new NotFoundException(nameof(ProjectMember), request.UserId);

        member.IsDeleted = true;
        _uow.Repository<ProjectMember>().Update(member);

        await _uow.SaveChangesAsync(cancellationToken);

        return true;
    }
}
