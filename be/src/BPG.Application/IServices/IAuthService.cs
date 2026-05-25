using BPG.Application.DTOs.Auth;

namespace BPG.Application.IServices
{
    public interface IAuthService
    {
        Task<LoginResponse?> LoginAsync(string email, string password);
    }
}
