using BPG.Application.Common.Models;
using MediatR;
using BPG.Application.Common.Interfaces;
using System.Threading;
using System.Threading.Tasks;
using BPG.Application.IRepositories;
using BPG.Application.Common.Authorization;
using BPG.Domain.Constants;

namespace BPG.Application.Features.Surplus.Commands;

/// <summary>
/// Leader tạo đề xuất xử lý vật tư thừa cho một dự án.
/// Business rule: hệ thống auto tạo batch với toàn bộ tồn kho hiện tại của dự án.
/// </summary>
public record CreateSurplusRequestCommand(long ProjectId, string? Reason)
    : IRequest<ApiResponse<long>>, IProjectResourceRequirement
{
    public ProjectResource ProjectResource => ProjectResource.Project(ProjectId);
    public string RequiredPermission => ProjectPermission.ExecutionManage;
}
