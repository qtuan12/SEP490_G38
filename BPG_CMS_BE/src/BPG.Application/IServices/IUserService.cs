using BPG.Application.DTOs.Users;

namespace BPG.Application.IServices
{
    public interface IUserService
    {
        Task<List<UserDto>> GetUsersAsync();
        Task<UserDto> CreateUserAsync(string name, string email, string role);
        Task<UserDto?> UpdateUserAsync(Guid id, string? name, string? email, string? role);
        Task<bool> DeleteUserAsync(Guid id);
        Task<UserDto?> ToggleUserStatusAsync(Guid id);
    }
}
