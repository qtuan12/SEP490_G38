using BPG.Application.DTOs.DailyLogs;
using MediatR;

namespace BPG.Application.Features.Comments.Commands
{
    public class UpdateCommentCommand : IRequest<CommentDto>
    {
        public long CommentId { get; set; }
        public string Content { get; set; } = string.Empty;
    }
}
