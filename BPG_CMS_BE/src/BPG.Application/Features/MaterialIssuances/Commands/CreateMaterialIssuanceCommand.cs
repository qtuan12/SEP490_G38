using BPG.Application.Common.Models;
using BPG.Domain.Constants;
using MediatR;
using System.Collections.Generic;

namespace BPG.Application.Features.MaterialIssuances.Commands
{
    public record CreateMaterialIssuanceCommand(
        long TaskId,
        string Purpose,
        List<CreateMaterialIssuanceItemDto> Items
    ) : IRequest<ApiResponse<long>>
    {
    }

    public record CreateMaterialIssuanceItemDto(
        long MaterialId,
        int UnitId,
        decimal Quantity,
        decimal ConversionRate = 1
    );
}

