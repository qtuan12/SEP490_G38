using BPG.Application.DTOs.DailyLogs;
using BPG.Application.Common.Authorization;
using BPG.Domain.Constants;
using MediatR;
using System.Collections.Generic;

namespace BPG.Application.Features.DailyLogs.Commands
{
    public class CreateDailyLogCommand : IRequest<DailyLogDto>, IProjectResourceRequirement
    {
        public long TaskId { get; set; }
        public ProjectResource ProjectResource => ProjectResource.Task(TaskId);
        public string RequiredPermission => ProjectPermission.View;
        public byte NewProgressPercent { get; set; }
        public string Description { get; set; } = string.Empty;
        public List<string> Images { get; set; } = new List<string>();
    }
}
