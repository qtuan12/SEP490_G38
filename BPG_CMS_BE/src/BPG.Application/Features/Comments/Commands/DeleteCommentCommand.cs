using MediatR;

namespace BPG.Application.Features.Comments.Commands
{
    public class DeleteCommentCommand : IRequest<bool>
    {
        public long CommentId { get; set; }

        public DeleteCommentCommand(long commentId)
        {
            CommentId = commentId;
        }
    }
}
