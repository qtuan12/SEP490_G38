using BPG.Application.DTOs.DailyLogs;
using MediatR;
using System.Collections.Generic;

namespace BPG.Application.Features.DailyLogs.Commands
{
    public class CreateDailyLogCommand : IRequest<DailyLogDto>
    {
        public long TaskId { get; set; }
        public byte NewProgressPercent { get; set; }
        public string Description { get; set; } = string.Empty;
        public List<string> Images { get; set; } = new List<string>();
    }
}
