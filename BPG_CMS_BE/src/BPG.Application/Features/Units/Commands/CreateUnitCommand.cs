using BPG.Application.Features.Units.DTOs;
using MediatR;

namespace BPG.Application.Features.Units.Commands;

public record CreateUnitCommand(
    string UnitCode,
    string UnitName,
    bool IsDiscrete
) : IRequest<UnitDto>;
