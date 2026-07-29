using BPG.Application.DTOs.DailyLogs;
using BPG.Application.Common.Authorization;
using BPG.Domain.Constants;
using MediatR;
using System.Collections.Generic;

namespace BPG.Application.Features.DailyLogs.Commands
{
    public class UpdateDailyLogCommand : IRequest<DailyLogDto>, IProjectResourceRequirement
    {
        public long LogId { get; set; }
        public ProjectResource ProjectResource => ProjectResource.DailyLog(LogId);
        public string RequiredPermission => ProjectPermission.View;
        public string Description { get; set; } = string.Empty;
        public List<string> Images { get; set; } = new List<string>();
    }
}
