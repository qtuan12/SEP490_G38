using BPG.Application.Common.Models;
using BPG.Domain.Constants;
using MediatR;
using System.Collections.Generic;

namespace BPG.Application.Features.MaterialReturns.Commands
{
    public record CreateMaterialReturnCommand(
        long OriginalIssuanceId,
        string Reason,
        List<ReturnItemDto> Items
    ) : IRequest<ApiResponse<long>>
    {
    }

    public record ReturnItemDto(
        long MaterialId,
        int UnitId,
        decimal Quantity,
        decimal ConversionRate = 1
    );
}

