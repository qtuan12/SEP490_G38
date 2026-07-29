using BPG.Application.Common.Models;
using BPG.Application.Common.Authorization;
using BPG.Domain.Constants;
using MediatR;
using System.Collections.Generic;

namespace BPG.Application.Features.MaterialReturns.Commands
{
    public record CreateMaterialReturnCommand(
        long OriginalIssuanceId,
        string Reason,
        List<ReturnItemDto> Items
    ) : IRequest<ApiResponse<long>>, IProjectResourceRequirement
    {
        public ProjectResource ProjectResource => ProjectResource.MaterialIssuance(OriginalIssuanceId);
        public string RequiredPermission => ProjectPermission.ExecutionManage;
    }

    public record ReturnItemDto(
        long MaterialId,
        int UnitId,
        decimal Quantity,
        decimal ConversionRate = 1
    );
}
