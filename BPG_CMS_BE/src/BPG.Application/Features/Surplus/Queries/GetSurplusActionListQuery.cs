using BPG.Application.Common.Models;
using BPG.Application.DTOs.Surplus;
using BPG.Application.Common.Interfaces;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.Surplus.Queries;

/// <summary>
/// Lấy danh sách actions của một SurplusRequestItem: Return, Transfer, Liquidation.
/// </summary>
public record GetSurplusActionListQuery(long SurplusRequestItemId) : IRequest<ApiResponse<SurplusActionListDto>>, IProjectRequirement
{
    public async Task<long> GetProjectIdAsync(IUnitOfWork unitOfWork, CancellationToken cancellationToken)
    {
        var projectId = await unitOfWork.Repository<SurplusRequestItem>().Query()
            .Where(i => i.SurplusRequestItemId == SurplusRequestItemId)
            .Select(i => i.SurplusRequest.ProjectId)
            .FirstOrDefaultAsync(cancellationToken);

        if (projectId == 0)
            throw new NotFoundException(nameof(SurplusRequestItem), SurplusRequestItemId);

        return projectId;
    }
}

public class SurplusActionListDto
{
    public long SurplusRequestItemId { get; set; }
    public List<SurplusReturnSupplierDto> Returns { get; set; } = new();
    public List<SurplusTransferDto> Transfers { get; set; } = new();
    public List<SurplusLiquidationDto> Liquidations { get; set; } = new();
}
