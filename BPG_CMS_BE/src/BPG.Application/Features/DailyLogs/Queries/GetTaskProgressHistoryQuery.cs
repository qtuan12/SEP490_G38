using BPG.Application.DTOs.DailyLogs;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.DailyLogs.Queries
{
    public class GetTaskProgressHistoryQuery : IRequest<List<TaskProgressLogDto>>
    {
        public long TaskId { get; set; }

        public GetTaskProgressHistoryQuery(long taskId)
        {
            TaskId = taskId;
        }

        public async Task<long> GetProjectIdAsync(IUnitOfWork unitOfWork, CancellationToken cancellationToken)
        {
            var projectId = await unitOfWork.Repository<ProjectTask>().Query()
                .Where(t => t.TaskId == TaskId)
                .Select(t => t.Phase.ProjectId)
                .FirstOrDefaultAsync(cancellationToken);

            if (projectId == 0)
                throw new NotFoundException(nameof(ProjectTask), TaskId);

            return projectId;
        }
    }
}

