using BPG.Application.Common.Models;
using BPG.Application.DTOs.DailyLogs;
using BPG.Application.IRepositories;
using MediatR;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.DailyLogs.Queries
{
    public class GetDailyLogsQuery : PaginationRequest, IRequest<PagedList<DailyLogDto>>
    {
        public long ProjectId { get; set; }
        public long? TaskId { get; set; }
        public long? CreatedBy { get; set; }
        public DateOnly? LogDate { get; set; }
        public long? LogId { get; set; }

        public Task<long> GetProjectIdAsync(IUnitOfWork unitOfWork, CancellationToken cancellationToken)
            => Task.FromResult(ProjectId);
    }
}

