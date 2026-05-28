using BPG.Domain.Entities;

namespace BPG.Aapplication.IServices
{
    public interface IJwtService
    {
        string GenerateToken(User user);
    }
}
