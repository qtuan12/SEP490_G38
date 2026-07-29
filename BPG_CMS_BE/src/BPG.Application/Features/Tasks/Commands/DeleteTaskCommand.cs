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

namespace BPG.Application.Features.Tasks.Commands;

public record DeleteTaskCommand(long TaskId) : IRequest<ApiResponse>, IProjectResourceRequirement
{
    public ProjectResource ProjectResource => ProjectResource.Task(TaskId);
    public string RequiredPermission => ProjectPermission.ExecutionManage;
}
