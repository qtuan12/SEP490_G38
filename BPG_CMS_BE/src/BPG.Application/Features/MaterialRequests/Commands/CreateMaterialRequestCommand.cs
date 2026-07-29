using MediatR;
using BPG.Application.Common.Authorization;
using BPG.Application.Common.Models;
using BPG.Domain.Constants;
using System.Collections.Generic;

namespace BPG.Application.Features.MaterialRequests.Commands
{
    public record CreateMaterialRequestCommand(
        long ProjectId,
        long PhaseId,
        string Reason,
        string Type, // "normal" or "emergency"
        string? InvoiceImage,
        List<MaterialRequestItemInput> Items
    ) : IRequest<ApiResponse<long>>, IProjectResourceRequirement
    {
        public ProjectResource ProjectResource => ProjectResource.Project(ProjectId);
        public string RequiredPermission => ProjectPermission.ExecutionManage;
    }

    public record MaterialRequestItemInput(
        string Name,
        decimal Quantity,
        string Unit
    );
}
