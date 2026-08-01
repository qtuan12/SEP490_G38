using BPG.Application.DTOs.DailyLogs;
using BPG.Application.Features.Comments.Commands;
using BPG.Application.Features.DailyLogs.Commands;
using BPG.Application.Features.DailyLogs.Queries;
using BPG.Domain.Constants;
using System.Collections.Generic;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;

namespace BPG.Api.Controllers
{
    [Authorize]
    public class DailyLogsController : BaseApiController
    {
        /// <summary>
        /// Lấy danh sách nhật ký thi công phân trang theo dự án (và tùy chọn theo công việc).
        /// </summary>
        [HttpGet]
        [Authorize(Roles = RolePolicies.ProjectViewers)]
        public async Task<IActionResult> GetDailyLogs([FromQuery] GetDailyLogsQuery query)
        {
            var result = await Mediator.Send(query);
            return ApiPagedOk(result, "Lấy danh sách nhật ký thi công thành công.");
        }
        /// <summary>
        /// Lấy lịch sử thay đổi tiến độ của một công việc (Task progress history log).
        /// </summary>
        [HttpGet("tasks/{taskId:long}/progress-history")]
        [Authorize(Roles = RolePolicies.ProjectViewers)]
        public async Task<IActionResult> GetTaskProgressHistory(long taskId)
        {
            var query = new GetTaskProgressHistoryQuery(taskId);
            var result = await Mediator.Send(query);
            return ApiOk(result, "Lấy lịch sử thay đổi tiến độ công việc thành công.");
        }
        /// <summary>
        /// Tạo nhật ký thi công mới (bao gồm cập nhật tiến độ công việc và đính kèm danh sách URLs ảnh).
        /// </summary>
        [HttpPost]
        [Authorize(Roles = UserRole.SiteEngineer)]
        public async Task<IActionResult> CreateDailyLog([FromBody] CreateDailyLogCommand command)
        {
            var result = await Mediator.Send(command);
            return ApiOk(result, "Tạo nhật ký thi công thành công.");
        }

        /// <summary>
        /// Cập nhật nội dung nhật ký thi công (chỉ cập nhật mô tả và danh sách hình ảnh đính kèm).
        /// </summary>
        [HttpPut("{logId:long}")]
        [Authorize(Roles = RolePolicies.TechnicalManagerOrSiteEngineer)]
        public async Task<IActionResult> UpdateDailyLog(long logId, [FromBody] UpdateDailyLogBody body)
        {
            var command = new UpdateDailyLogCommand
            {
                LogId = logId,
                Description = body.Description,
                Images = body.Images
            };
            var result = await Mediator.Send(command);
            return ApiOk(result, "Cập nhật nhật ký thi công thành công.");
        }

        /// <summary>
        /// Thêm bình luận mới dưới một nhật ký thi công cụ thể.
        /// </summary>
        [HttpPost("{logId:long}/comments")]
        [Authorize(Roles = RolePolicies.BusinessUsers)]
        public async Task<IActionResult> AddComment(long logId, [FromBody] AddCommentBody body)
        {
            var command = new AddCommentCommand
            {
                LogId = logId,
                Content = body.Content
            };
            var result = await Mediator.Send(command);
            return ApiOk(result, "Thêm bình luận thành công.");
        }

        /// <summary>
        /// Cập nhật nội dung một bình luận.
        /// </summary>
        [HttpPut("comments/{commentId:long}")]
        public async Task<IActionResult> UpdateComment(long commentId, [FromBody] UpdateCommentBody body)
        {
            var command = new UpdateCommentCommand
            {
                CommentId = commentId,
                Content = body.Content
            };
            var result = await Mediator.Send(command);
            return ApiOk(result, "Cập nhật bình luận thành công.");
        }

        /// <summary>
        /// Xóa bình luận.
        /// </summary>
        [HttpDelete("comments/{commentId:long}")]
        public async Task<IActionResult> DeleteComment(long commentId)
        {
            var command = new DeleteCommentCommand(commentId);
            var result = await Mediator.Send(command);
            return ApiOk(result, "Xóa bình luận thành công.");
        }
    }
}
