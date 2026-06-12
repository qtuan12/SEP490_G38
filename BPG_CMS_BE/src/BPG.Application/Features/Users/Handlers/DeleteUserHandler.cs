using BPG.Application.Features.Users.Commands;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;

namespace BPG.Application.Features.Users.Handlers;

public class DeleteUserHandler : IRequestHandler<DeleteUserCommand, bool>
{
    private readonly IUnitOfWork _uow;

    public DeleteUserHandler(IUnitOfWork uow) => _uow = uow;

    public async Task<bool> Handle(DeleteUserCommand request, CancellationToken ct)
    {
        var user = await _uow.Repository<User>().GetByIdAsync(request.Id, ct)
            ?? throw new NotFoundException(nameof(User), request.Id);

        // Soft delete qua IsDeleted (SoftDeleteInterceptor tự xử lý khi SaveChanges)
        user.IsDeleted = true;
        _uow.Repository<User>().Update(user);
        await _uow.SaveChangesAsync(ct);
        return true;
    }
}
