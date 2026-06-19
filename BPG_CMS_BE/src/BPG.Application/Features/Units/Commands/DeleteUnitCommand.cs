using MediatR;

namespace BPG.Application.Features.Units.Commands;

public record DeleteUnitCommand(int UnitId) : IRequest<bool>;
