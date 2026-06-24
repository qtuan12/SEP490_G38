using BPG.Application.Common.Models;
using BPG.Application.DTOs.MaterialIssuances;
using MediatR;

namespace BPG.Application.Features.MaterialIssuances.Queries
{
    public class GetMaterialIssuancesQuery : PaginationRequest, IRequest<PagedList<MaterialIssuanceDto>>
    {
        public long? ProjectId { get; set; }
    }
}
