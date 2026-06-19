using BPG.Application.Features.Units.DTOs;
using MediatR;
using System.Text.Json.Serialization;

namespace BPG.Application.Features.Units.Commands;

public record UpdateUnitCommand(
    int UnitId,
    string UnitCode,
    string UnitName
) : IRequest<UnitDto>;
