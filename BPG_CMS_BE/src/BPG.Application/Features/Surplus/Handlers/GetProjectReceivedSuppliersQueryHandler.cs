using BPG.Application.Common.Models;
using BPG.Application.Features.Surplus.Queries;
using BPG.Application.IServices;
using BPG.Domain.Exceptions;
using MediatR;

namespace BPG.Application.Features.Surplus.Handlers;

public sealed class GetProjectReceivedSuppliersQueryHandler
    : IRequestHandler<
        GetProjectReceivedSuppliersQuery,
        ApiResponse<IReadOnlyList<SurplusMaterialSupplier>>>
{
    private readonly ISurplusMaterialSupplierService _supplierService;
    private readonly IProjectAccessService _projectAccessService;

    public GetProjectReceivedSuppliersQueryHandler(
        ISurplusMaterialSupplierService supplierService,
        IProjectAccessService projectAccessService)
    {
        _supplierService = supplierService;
        _projectAccessService = projectAccessService;
    }

    public async Task<ApiResponse<IReadOnlyList<SurplusMaterialSupplier>>> Handle(
        GetProjectReceivedSuppliersQuery request,
        CancellationToken cancellationToken)
    {
        var accessibleProjectIds = await _projectAccessService.GetAccessibleProjectIdsAsync(cancellationToken);
        if (!accessibleProjectIds.Contains(request.ProjectId))
        {
            throw new ForbiddenException("Bạn không có quyền xem nhà cung cấp của dự án này.");
        }

        var suppliers = await _supplierService.GetApprovedSuppliersAsync(
            request.ProjectId,
            cancellationToken);

        return ApiResponse<IReadOnlyList<SurplusMaterialSupplier>>.SuccessResult(suppliers);
    }
}
