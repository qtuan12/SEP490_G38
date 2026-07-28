using BPG.Application.Common.Models;
using BPG.Application.DTOs.MaterialCatalogs;
using MediatR;

namespace BPG.Application.Features.MaterialCatalogs.Queries;

public class GetMaterialCatalogsQuery : PaginationRequest, IRequest<PagedList<MaterialCatalogDto>>
{
    public long? CategoryId { get; set; }
}
