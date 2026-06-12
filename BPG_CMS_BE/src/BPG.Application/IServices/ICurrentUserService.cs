using System.Collections.Generic;

namespace BPG.Application.IServices;

public interface ICurrentUserService
{
    long? UserId { get; }
    string? Email { get; }
    IReadOnlyList<string> Roles { get; }
}
