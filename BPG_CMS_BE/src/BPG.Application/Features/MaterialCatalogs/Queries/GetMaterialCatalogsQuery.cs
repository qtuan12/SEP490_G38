using BPG.Application.Common.Models;
using BPG.Application.Common.Attributes;
using BPG.Application.DTOs.MaterialCatalogs;
using MediatR;

namespace BPG.Application.Features.MaterialCatalogs.Queries;

[Cacheable(DurationSeconds = 300)]
public class GetMaterialCatalogsQuery : PaginationRequest, IRequest<PagedList<MaterialCatalogDto>>
{
    public long? CategoryId { get; set; }
}
