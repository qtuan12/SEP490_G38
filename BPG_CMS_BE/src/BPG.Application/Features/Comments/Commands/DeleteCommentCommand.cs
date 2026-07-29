using BPG.Application.Common.Authorization;
using MediatR;

namespace BPG.Application.Features.Comments.Commands
{
    public class DeleteCommentCommand : IRequest<bool>, IProjectResourceRequirement
    {
        public long CommentId { get; set; }
        public ProjectResource ProjectResource => ProjectResource.Comment(CommentId);

        public DeleteCommentCommand(long commentId)
        {
            CommentId = commentId;
        }
    }
}
