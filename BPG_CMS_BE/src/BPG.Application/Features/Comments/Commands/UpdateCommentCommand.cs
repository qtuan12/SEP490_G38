using BPG.Application.DTOs.DailyLogs;
using BPG.Application.Common.Authorization;
using MediatR;

namespace BPG.Application.Features.Comments.Commands
{
    public class UpdateCommentCommand : IRequest<CommentDto>, IProjectResourceRequirement
    {
        public long CommentId { get; set; }
        public ProjectResource ProjectResource => ProjectResource.Comment(CommentId);
        public string Content { get; set; } = string.Empty;
    }
}
