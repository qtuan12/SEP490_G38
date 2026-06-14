using System.Collections.Generic;

namespace BPG.Application.DTOs.DailyLogs
{
    public class UpdateDailyLogBody
    {
        public string Description { get; set; } = string.Empty;
        public List<string> Images { get; set; } = new List<string>();
    }
}
