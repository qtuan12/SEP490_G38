using BPG.Application.DTOs.MaterialRequests;
using MediatR;

namespace BPG.Application.Features.MaterialRequests.Queries;

public sealed record GetMaterialRequestAssessmentQuery(long RequestId)
    : IRequest<MaterialRequestAssessmentDto>;
