using BPG.Application.DTOs.DailyLogs;
using MediatR;

namespace BPG.Application.Features.Comments.Commands
{
    public class AddCommentCommand : IRequest<CommentDto>
    {
        public long LogId { get; set; }
        public string Content { get; set; } = string.Empty;
    }
}

