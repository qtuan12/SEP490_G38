using BPG.Application.Features.Projects.Commands;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.Projects.Handlers;

public class AssignProjectLeaderCommandHandler : IRequestHandler<AssignProjectLeaderCommand, bool>
{
    private readonly IUnitOfWork _uow;

    public AssignProjectLeaderCommandHandler(IUnitOfWork uow)
    {
        _uow = uow;
    }

    public async Task<bool> Handle(AssignProjectLeaderCommand request, CancellationToken cancellationToken)
    {
        var members = await _uow.Repository<ProjectMember>()
            .FindAsync(m => m.ProjectId == request.ProjectId && !m.IsDeleted, cancellationToken);

        var newLeader = members.FirstOrDefault(m => m.UserId == request.UserId);
        if (newLeader == null)
            throw new NotFoundException("Thành viên không tồn tại trong dự án này.", request.UserId);

        bool wasLeader = newLeader.IsLeader;

        foreach (var member in members)
        {
            member.IsLeader = false;
        }

        if (!wasLeader)
        {
            newLeader.IsLeader = true;
        }

        _uow.Repository<ProjectMember>().UpdateRange(members);
        await _uow.SaveChangesAsync(cancellationToken);

        return true;
    }
}
