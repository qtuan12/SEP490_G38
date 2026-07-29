using BPG.Application.Common.Models;
using BPG.Application.Common.Authorization;
using BPG.Domain.Constants;
using MediatR;
using System.Collections.Generic;

namespace BPG.Application.Features.MaterialIssuances.Commands
{
    public record CreateMaterialIssuanceCommand(
        long TaskId,
        string Purpose,
        List<CreateMaterialIssuanceItemDto> Items
    ) : IRequest<ApiResponse<long>>, IProjectResourceRequirement
    {
        public ProjectResource ProjectResource => ProjectResource.Task(TaskId);
        public string RequiredPermission => ProjectPermission.ExecutionManage;
    }

    public record CreateMaterialIssuanceItemDto(
        long MaterialId,
        int UnitId,
        decimal Quantity,
        decimal ConversionRate = 1
    );
}
