using BPG.Application.Common.Models;
using MediatR;
using BPG.Application.Common.Interfaces;
using System.Threading;
using System.Threading.Tasks;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using BPG.Domain.Exceptions;
using BPG.Application.Common.Authorization;
using BPG.Domain.Constants;

namespace BPG.Application.Features.Surplus.Commands;

/// <summary>
/// Kế toán xử lý trả NCC: nhập số tiền thu hồi và hoàn tất action.
/// </summary>
public record CreateSurplusReturnActionCommand(
    long SurplusRequestItemId,
    long SupplierId,
    decimal ReturnQuantity,
    decimal? RefundAmount,
    string? Note,
    List<Microsoft.AspNetCore.Http.IFormFile>? Attachments
) : IRequest<ApiResponse<long>>, IProjectResourceRequirement
{
    public ProjectResource ProjectResource => ProjectResource.SurplusRequestItem(SurplusRequestItemId);
    public string RequiredPermission => ProjectPermission.AccountingManage;
}
