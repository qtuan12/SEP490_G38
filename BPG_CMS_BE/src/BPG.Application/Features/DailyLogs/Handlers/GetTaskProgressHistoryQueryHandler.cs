using AutoMapper;
using BPG.Application.DTOs.DailyLogs;
using BPG.Application.Features.DailyLogs.Queries;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.DailyLogs.Handlers
{
    public class GetTaskProgressHistoryQueryHandler : IRequestHandler<GetTaskProgressHistoryQuery, List<TaskProgressLogDto>>
    {
        private readonly IUnitOfWork _uow;
        private readonly IMapper _mapper;
        private readonly ICurrentUserService _currentUserService;

        public GetTaskProgressHistoryQueryHandler(IUnitOfWork uow, IMapper mapper, ICurrentUserService currentUserService)
        {
            _uow = uow;
            _mapper = mapper;
            _currentUserService = currentUserService;
        }

        public async Task<List<TaskProgressLogDto>> Handle(GetTaskProgressHistoryQuery request, CancellationToken cancellationToken)
        {
            // 1. Kiểm tra Task có tồn tại hay không
            var task = await _uow.Repository<ProjectTask>().Query()
                .Include(t => t.Phase)
                .FirstOrDefaultAsync(t => t.TaskId == request.TaskId, cancellationToken);

            if (task == null)
            {
                throw new NotFoundException(nameof(ProjectTask), request.TaskId);
            }

            // 2. Kiểm tra quyền truy cập (Admin/TM hoặc thành viên dự án)
            bool isAdminOrTM = _currentUserService.IsInAnyRole(BPG.Domain.Constants.UserRole.Admin, BPG.Domain.Constants.UserRole.TechnicalManager);
            if (!isAdminOrTM)
            {
                var currentUserId = _currentUserService.GetRequiredUserId();
                var isMember = await _uow.Repository<ProjectMember>().Query()
                    .AnyAsync(m => m.ProjectId == task.Phase.ProjectId && m.UserId == currentUserId, cancellationToken);

                if (!isMember)
                {
                    throw new ForbiddenException("Bạn không phải thành viên của dự án này.");
                }
            }

            // 3. Lấy lịch sử thay đổi tiến độ công việc
            var logs = await _uow.Repository<TaskProgressLog>().Query()
                .AsNoTracking()
                .Where(tpl => tpl.TaskId == request.TaskId)
                .OrderByDescending(tpl => tpl.UpdatedAt)
                .ToListAsync(cancellationToken);

            return _mapper.Map<List<TaskProgressLogDto>>(logs);
        }
    }
}
