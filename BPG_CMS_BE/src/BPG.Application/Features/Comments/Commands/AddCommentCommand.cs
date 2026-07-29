using BPG.Application.DTOs.DailyLogs;
using BPG.Application.Common.Authorization;
using MediatR;

namespace BPG.Application.Features.Comments.Commands
{
    public class AddCommentCommand : IRequest<CommentDto>, IProjectResourceRequirement
    {
        public long LogId { get; set; }
        public ProjectResource ProjectResource => ProjectResource.DailyLog(LogId);
        public string Content { get; set; } = string.Empty;
    }
}
