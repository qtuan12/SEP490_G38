using BPG.Application.Common.Models;
using BPG.Application.DTOs.DailyLogs;
using MediatR;

namespace BPG.Application.Features.DailyLogs.Queries
{
    public class GetDailyLogsQuery : PaginationRequest, IRequest<PagedList<DailyLogDto>>
    {
        public long ProjectId { get; set; }
        public long? TaskId { get; set; }
        public long? CreatedBy { get; set; }
        public DateOnly? LogDate { get; set; }
    }
}
