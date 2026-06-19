using BPG.Application.DTOs.Auth;
using MediatR;

namespace BPG.Application.Features.Auth.Queries
{
    public record GetCurrentUserQuery(long UserId) : IRequest<GetCurrentUserDto>;
}
