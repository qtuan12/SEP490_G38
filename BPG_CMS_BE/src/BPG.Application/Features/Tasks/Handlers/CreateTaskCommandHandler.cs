using BPG.Domain.Exceptions;
using BPG.Application.Common.Models;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using BPG.Application.Features.Tasks.Commands;

namespace BPG.Application.Features.Tasks.Handlers;

public class CreateTaskCommandHandler : IRequestHandler<CreateTaskCommand, ApiResponse<long>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly INotificationService _notificationService;
    private readonly IRealtimeNotificationSender _realtimeSender;
    private readonly AutoMapper.IMapper _mapper;

    public CreateTaskCommandHandler(IUnitOfWork unitOfWork, INotificationService notificationService, IRealtimeNotificationSender realtimeSender, AutoMapper.IMapper mapper)
    {
        _unitOfWork = unitOfWork;
        _notificationService = notificationService;
        _realtimeSender = realtimeSender;
        _mapper = mapper;
    }

    public async Task<ApiResponse<long>> Handle(CreateTaskCommand request, CancellationToken ct)
    {
        var phase = await _unitOfWork.Repository<Phase>()
            .Query()
            .FirstOrDefaultAsync(p => p.PhaseId == request.PhaseId, ct);

        if (phase == null)
            throw new NotFoundException("Phase", request.PhaseId);

        if (phase.StartDate.HasValue && request.StartDate < phase.StartDate.Value)
        {
            throw new BusinessException("ERR_TASK_DATE_INVALID",
                $"Ngày bắt đầu của công việc ({request.StartDate:dd/MM/yyyy}) không được trước ngày bắt đầu của giai đoạn ({phase.StartDate.Value:dd/MM/yyyy}).");
        }
        if (phase.EndDate.HasValue && request.EndDate > phase.EndDate.Value)
        {
            throw new BusinessException("ERR_TASK_DATE_INVALID",
                $"Ngày kết thúc của công việc ({request.EndDate:dd/MM/yyyy}) không được sau ngày kết thúc của giai đoạn ({phase.EndDate.Value:dd/MM/yyyy}).");
        }

        if (request.ParentTaskId.HasValue)
        {
            var parentTask = await _unitOfWork.Repository<ProjectTask>()
                .Query()
                .Include(t => t.Assignees)
                .FirstOrDefaultAsync(t => t.TaskId == request.ParentTaskId.Value, ct);

            if (parentTask == null)
                throw new NotFoundException("ParentTask", request.ParentTaskId.Value);

            if (request.StartDate < parentTask.StartDate || request.EndDate > parentTask.EndDate)
            {
                throw new BusinessException("ERR_TASK_DATE_INVALID",
                    $"Thời gian công việc con ({request.StartDate:dd/MM/yyyy} - {request.EndDate:dd/MM/yyyy}) " +
                    $"phải nằm trong khoảng thời gian của công việc cha ({parentTask.StartDate:dd/MM/yyyy} - {parentTask.EndDate:dd/MM/yyyy}).");
            }

            // Tự động phân công Task Cha cho Project Leader
            var leader = await _unitOfWork.Repository<ProjectMember>()
                .Query()
                .FirstOrDefaultAsync(pm => pm.ProjectId == phase.ProjectId && pm.IsLeader, ct);

            if (leader != null)
            {
                var isLeaderAssigned = parentTask.Assignees.Any(a => a.UserId == leader.UserId);
                if (!isLeaderAssigned)
                {
                    parentTask.Assignees.Add(new TaskAssignee
                    {
                        UserId = leader.UserId,
                        AssignedAt = DateTime.UtcNow
                    });

                    if (parentTask.Status == BPG.Domain.Constants.TaskStatus.New)
                    {
                        parentTask.Status = BPG.Domain.Constants.TaskStatus.Assigned;
                    }

                    _unitOfWork.Repository<ProjectTask>().Update(parentTask);
                }
            }
        }

        var task = _mapper.Map<ProjectTask>(request);
        task.Status = BPG.Domain.Constants.TaskStatus.New;
        task.ProgressPercent = 0;

        if (request.AssigneeIds != null && request.AssigneeIds.Any())
        {
            foreach (var userId in request.AssigneeIds)
            {
                task.Assignees.Add(new TaskAssignee
                {
                    UserId = userId,
                    AssignedAt = DateTime.UtcNow
                });
            }
            task.Status = BPG.Domain.Constants.TaskStatus.Assigned;
        }

        task.ProgressLogs.Add(new TaskProgressLog
        {
            OldProgress = 0,
            NewProgress = 0,
            UpdateReason = "Khởi tạo công việc",
            UpdatedAt = DateTime.UtcNow
        });

        await _unitOfWork.Repository<ProjectTask>().AddAsync(task);
        await _unitOfWork.SaveChangesAsync(ct);

        if (request.AssigneeIds != null && request.AssigneeIds.Any())
        {
            foreach (var userId in request.AssigneeIds)
            {
                await _notificationService.SendNotificationAsync(
                    userId: userId,
                    title: "Bạn được giao một công việc mới",
                    content: $"Bạn đã được phân công vào công việc: {task.Name}.",
                    notificationType: BPG.Domain.Constants.NotificationType.Progress,
                    referenceType: BPG.Domain.Constants.NotificationReferenceType.Task,
                    referenceId: task.TaskId,
                    ct: ct);
            }
        }

        if (phase != null)
        {
            await _realtimeSender.SendToGroupAsync($"Project_{phase.ProjectId}", "WbsTreeUpdated", new { TaskId = task.TaskId }, ct);
        }

        return ApiResponse<long>.SuccessResult(task.TaskId, "Tạo công việc thành công.");
    }
}
