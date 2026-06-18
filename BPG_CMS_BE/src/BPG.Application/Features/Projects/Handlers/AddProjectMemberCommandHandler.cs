using AutoMapper;
using BPG.Application.Features.Projects.Commands;
using BPG.Application.Features.Projects.DTOs;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.Projects.Handlers;

public class AddProjectMemberCommandHandler : IRequestHandler<AddProjectMemberCommand, ProjectMemberDto>
{
    private readonly IUnitOfWork _uow;
    private readonly IMapper _mapper;

    public AddProjectMemberCommandHandler(IUnitOfWork uow, IMapper mapper)
    {
        _uow = uow;
        _mapper = mapper;
    }

    public async Task<ProjectMemberDto> Handle(AddProjectMemberCommand request, CancellationToken cancellationToken)
    {
        var project = await _uow.Repository<Project>().GetByIdAsync(request.ProjectId, cancellationToken);
        if (project == null)
            throw new NotFoundException(nameof(Project), request.ProjectId);

        var user = await _uow.Repository<User>().Query()
            .Include(u => u.UserRoles)
            .ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.UserId == request.UserId, cancellationToken);

        if (user == null)
            throw new NotFoundException(nameof(User), request.UserId);

        var existingMember = await _uow.Repository<ProjectMember>()
            .FirstOrDefaultAsync(m => m.ProjectId == request.ProjectId && m.UserId == request.UserId, cancellationToken);

        if (existingMember != null && !existingMember.IsDeleted)
            throw new BusinessException("ERR_PROJECT_MEMBER_ADD", "User is already a member of this project.");

        if (existingMember != null && existingMember.IsDeleted)
        {
            existingMember.IsDeleted = false;
            existingMember.JoinedAt = System.DateTime.UtcNow;
            existingMember.User = user;
            _uow.Repository<ProjectMember>().Update(existingMember);
            await _uow.SaveChangesAsync(cancellationToken);
            return _mapper.Map<ProjectMemberDto>(existingMember);
        }

        var newMember = new ProjectMember
        {
            ProjectId = request.ProjectId,
            UserId = request.UserId,
            IsLeader = false,
            JoinedAt = System.DateTime.UtcNow,
            User = user
        };

        await _uow.Repository<ProjectMember>().AddAsync(newMember, cancellationToken);
        await _uow.SaveChangesAsync(cancellationToken);

        return _mapper.Map<ProjectMemberDto>(newMember);
    }
}
