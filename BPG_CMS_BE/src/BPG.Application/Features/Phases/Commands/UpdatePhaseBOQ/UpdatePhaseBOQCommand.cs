using MediatR;
using System.Collections.Generic;

namespace BPG.Application.Features.Phases.Commands.UpdatePhaseBOQ;

public record UpdatePhaseBOQCommand(
    long ProjectId,
    long PhaseId,
    List<BOQItemInput> Items
) : IRequest<bool>;

public record BOQItemInput(
    long MaterialId,
    decimal Quantity,
    int UnitId
);
