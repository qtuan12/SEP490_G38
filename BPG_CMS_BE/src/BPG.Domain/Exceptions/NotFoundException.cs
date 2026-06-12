using BPG.Domain.Constants;

namespace BPG.Domain.Exceptions;

/// <summary>
/// Entity không tồn tại trong DB. → 404 Not Found
/// </summary>
public class NotFoundException : DomainException
{
    public NotFoundException(string entityName, object id)
        : base(ErrorCodes.NotFound, $"{entityName} với ID [{id}] không tồn tại.") { }

    public NotFoundException(string message)
        : base(ErrorCodes.NotFound, message) { }
}
