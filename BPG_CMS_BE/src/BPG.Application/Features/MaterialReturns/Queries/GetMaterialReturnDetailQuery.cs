using BPG.Application.Common.Models;
using BPG.Application.DTOs.MaterialReturns;
using MediatR;

namespace BPG.Application.Features.MaterialReturns.Queries
{
    public record GetMaterialReturnDetailQuery(long ReturnId) : IRequest<ApiResponse<MaterialReturnDetailDto>>;
}
