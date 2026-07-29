using BPG.Application.Common.Authorization;
using BPG.Domain.Constants;
using MediatR;
using System.Collections.Generic;

namespace BPG.Application.Features.Phases.Commands.UpdatePhaseBOQ;

public record UpdatePhaseBOQCommand(
    long ProjectId,
    long PhaseId,
    List<BOQItemInput> Items
) : IRequest<bool>, IProjectResourceRequirement
{
    public ProjectResource ProjectResource => ProjectResource.Phase(PhaseId);
    public string RequiredPermission => ProjectPermission.TechnicalManage;
}

public record BOQItemInput(
    long MaterialId,
    decimal Quantity,
    int UnitId
);
