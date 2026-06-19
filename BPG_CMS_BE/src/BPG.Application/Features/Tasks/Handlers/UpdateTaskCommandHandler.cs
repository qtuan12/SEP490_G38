using BPG.Domain.Exceptions;
using BPG.Application.Common.Models;
using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using BPG.Application.IServices;
using BPG.Application.Features.Tasks.Commands;

namespace BPG.Application.Features.Tasks.Handlers;

public class UpdateTaskCommandHandler : IRequestHandler<UpdateTaskCommand, ApiResponse>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IRealtimeNotificationSender _realtimeSender;
    private readonly AutoMapper.IMapper _mapper;

    public UpdateTaskCommandHandler(IUnitOfWork unitOfWork, IRealtimeNotificationSender realtimeSender, AutoMapper.IMapper mapper)
    {
        _unitOfWork = unitOfWork;
        _realtimeSender = realtimeSender;
        _mapper = mapper;
    }

    public async Task<ApiResponse> Handle(UpdateTaskCommand request, CancellationToken ct)
    {
        var task = await _unitOfWork.Repository<ProjectTask>()
            .Query()
            .Include(t => t.Phase)
            .FirstOrDefaultAsync(t => t.TaskId == request.TaskId, ct);

        if (task == null)
            throw new NotFoundException("ProjectTask", request.TaskId);

        if (task.Phase != null)
        {
            if (task.Phase.StartDate.HasValue && request.StartDate < task.Phase.StartDate.Value)
            {
                throw new BusinessException("ERR_TASK_DATE_INVALID", 
                    $"Ngày bắt đầu của công việc ({request.StartDate:dd/MM/yyyy}) không được trước ngày bắt đầu của giai đoạn ({task.Phase.StartDate.Value:dd/MM/yyyy}).");
            }
            if (task.Phase.EndDate.HasValue && request.EndDate > task.Phase.EndDate.Value)
            {
                throw new BusinessException("ERR_TASK_DATE_INVALID", 
                    $"Ngày kết thúc của công việc ({request.EndDate:dd/MM/yyyy}) không được sau ngày kết thúc của giai đoạn ({task.Phase.EndDate.Value:dd/MM/yyyy}).");
            }
        }

        // Check date constraints with parent
        if (task.ParentTaskId.HasValue)
        {
            var parentTask = await _unitOfWork.Repository<ProjectTask>()
                .Query()
                .FirstOrDefaultAsync(t => t.TaskId == task.ParentTaskId.Value, ct);

            if (parentTask != null && (request.StartDate < parentTask.StartDate || request.EndDate > parentTask.EndDate))
            {
                throw new BusinessException("ERR_TASK_DATE_INVALID", 
                    $"Thời gian công việc con ({request.StartDate:dd/MM/yyyy} - {request.EndDate:dd/MM/yyyy}) " +
                    $"phải nằm trong khoảng thời gian của công việc cha ({parentTask.StartDate:dd/MM/yyyy} - {parentTask.EndDate:dd/MM/yyyy}).");
            }
        }

        // Require reason if progress > 0% and changing content/date
        bool isContentOrDateChanged = task.Name != request.Name 
                                      || task.Description != request.Description 
                                      || task.StartDate != request.StartDate 
                                      || task.EndDate != request.EndDate;

        if (task.ProgressPercent > 0 && isContentOrDateChanged)
        {
            if (string.IsNullOrWhiteSpace(request.UpdateReason))
            {
                throw new BusinessException("ERR_TASK_UPDATE_REASON_REQUIRED", "Cần có lý do cập nhật khi sửa công việc đang thực hiện (> 0%).");
            }

            task.ProgressLogs.Add(new TaskProgressLog
            {
                OldProgress = task.ProgressPercent,
                NewProgress = task.ProgressPercent,
                UpdateReason = $"Sửa thông tin công việc: {request.UpdateReason}",
                UpdatedAt = DateTime.UtcNow
            });
        }

        _mapper.Map(request, task);

        _unitOfWork.Repository<ProjectTask>().Update(task);
        await _unitOfWork.SaveChangesAsync(ct);

        if (task.Phase != null)
        {
            await _realtimeSender.SendToGroupAsync($"Project_{task.Phase.ProjectId}", "WbsTreeUpdated", new { TaskId = task.TaskId }, ct);
        }

        return ApiResponse.SuccessResult("Cập nhật công việc thành công.");
    }
}
