using BPG.Application.DTOs.DailyLogs;
using BPG.Domain.Constants;
using MediatR;
using System.Collections.Generic;

namespace BPG.Application.Features.DailyLogs.Commands
{
    public class UpdateDailyLogCommand : IRequest<DailyLogDto>
    {
        public long LogId { get; set; }
        public string Description { get; set; } = string.Empty;
        public List<string> Images { get; set; } = new List<string>();
    }
}

