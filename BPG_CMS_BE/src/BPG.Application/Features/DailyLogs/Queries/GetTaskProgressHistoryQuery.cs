using BPG.Application.DTOs.DailyLogs;
using MediatR;
using System.Collections.Generic;

namespace BPG.Application.Features.DailyLogs.Queries
{
    public class GetTaskProgressHistoryQuery : IRequest<List<TaskProgressLogDto>>
    {
        public long TaskId { get; set; }

        public GetTaskProgressHistoryQuery(long taskId)
        {
            TaskId = taskId;
        }
    }
}
