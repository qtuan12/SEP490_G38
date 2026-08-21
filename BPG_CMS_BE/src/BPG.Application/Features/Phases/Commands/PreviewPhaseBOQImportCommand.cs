using BPG.Application.DTOs.Phases;
using MediatR;

namespace BPG.Application.Features.Phases.Commands;

public record PreviewPhaseBOQImportCommand(
    long ProjectId,
    long PhaseId,
    List<PhaseBOQImportRowInput> Rows
) : IRequest<PhaseBOQImportPreviewDto>;

public record PhaseBOQImportRowInput(
    int RowNumber,
    string MaterialCode,
    decimal Quantity,
    string UnitCode
);
