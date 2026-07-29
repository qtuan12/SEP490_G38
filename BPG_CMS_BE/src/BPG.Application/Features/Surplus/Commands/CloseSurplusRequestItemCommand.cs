using BPG.Application.Common.Models;
using BPG.Application.Common.Authorization;
using BPG.Domain.Constants;
using MediatR;

namespace BPG.Application.Features.Surplus.Commands;

public record CloseSurplusRequestItemCommand(
    long SurplusRequestItemId,
    string Reason) : IRequest<ApiResponse>, IProjectResourceRequirement
{
    public ProjectResource ProjectResource => ProjectResource.SurplusRequestItem(SurplusRequestItemId);
    public string RequiredPermission => ProjectPermission.TechnicalManage;
}
