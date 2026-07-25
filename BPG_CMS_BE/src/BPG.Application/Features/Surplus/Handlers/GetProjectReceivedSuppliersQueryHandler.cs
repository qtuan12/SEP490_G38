using BPG.Application.Common.Models;
using BPG.Application.Features.Surplus.Queries;
using BPG.Application.IServices;
using MediatR;

namespace BPG.Application.Features.Surplus.Handlers;

public sealed class GetProjectReceivedSuppliersQueryHandler
    : IRequestHandler<
        GetProjectReceivedSuppliersQuery,
        ApiResponse<IReadOnlyList<SurplusMaterialSupplier>>>
{
    private readonly ISurplusMaterialSupplierService _supplierService;

    public GetProjectReceivedSuppliersQueryHandler(
        ISurplusMaterialSupplierService supplierService)
    {
        _supplierService = supplierService;
    }

    public async Task<ApiResponse<IReadOnlyList<SurplusMaterialSupplier>>> Handle(
        GetProjectReceivedSuppliersQuery request,
        CancellationToken cancellationToken)
    {
        var suppliers = await _supplierService.GetApprovedSuppliersAsync(
            request.ProjectId,
            cancellationToken);

        return ApiResponse<IReadOnlyList<SurplusMaterialSupplier>>.SuccessResult(suppliers);
    }
}
