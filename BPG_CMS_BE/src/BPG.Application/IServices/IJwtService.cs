using BPG.Domain.Entities;

namespace BPG.Application.IServices
{
    public interface IJwtService
    {
        string GenerateToken(User user);
    }
}
