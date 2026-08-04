using MediatR;

namespace BPG.Application.Features.Users.Commands
{
    /// <summary>Xóa mềm tài khoản. Trả về họ tên để controller ghép vào message xác nhận.</summary>
    public record DeleteUserCommand(long Id) : IRequest<string>;
}
