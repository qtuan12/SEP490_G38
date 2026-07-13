using BPG.Application.Features.Comments.Commands;
using BPG.Application.Features.Comments.Handlers;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using MockQueryable;
using MockQueryable.Moq;
using Moq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Xunit;

namespace BPG.Application.UnitTests.Comments
{
    public class DeleteCommentCommandHandlerTests
    {
        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IGenericRepository<Comment>> _mockCommentRepo;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly Mock<IRealtimeNotificationSender> _mockRealtimeSender;
        private readonly DeleteCommentCommandHandler _handler;

        public DeleteCommentCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockCommentRepo = new Mock<IGenericRepository<Comment>>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();
            _mockRealtimeSender = new Mock<IRealtimeNotificationSender>();

            _mockUow.Setup(u => u.Repository<Comment>()).Returns(_mockCommentRepo.Object);

            _handler = new DeleteCommentCommandHandler(
                _mockUow.Object,
                _mockCurrentUserService.Object,
                _mockRealtimeSender.Object
            );
        }

        private void SetupCurrentUser(long userId, bool isAuthenticated = true)
        {
            if (isAuthenticated)
            {
                _mockCurrentUserService.Setup(s => s.GetRequiredUserId()).Returns(userId);
            }
            else
            {
                _mockCurrentUserService.Setup(s => s.GetRequiredUserId())
                    .Throws(new UnauthorizedAccessException("User is not authenticated."));
            }
        }

        [Fact]
        public async Task UTCID01_Handle_ValidRequest_ShouldDeleteCommentSuccessfully()
        {
            // Arrange
            SetupCurrentUser(userId: 10);

            var existingComment = new Comment
            {
                CommentId = 100,
                LogId = 200,
                AuthorId = 10,
                DailyLog = new DailyLog
                {
                    LogId = 200,
                    Task = new ProjectTask
                    {
                        Phase = new Phase { ProjectId = 5 }
                    }
                }
            };
            _mockCommentRepo.Setup(r => r.Query()).Returns(new List<Comment> { existingComment }.AsQueryable().BuildMock());
            _mockUow.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1); // Succeeds

            var command = new DeleteCommentCommand(100);

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().BeTrue();

            _mockCommentRepo.Verify(r => r.Remove(existingComment), Times.Once);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
            _mockRealtimeSender.Verify(s => s.SendToGroupAsync(
                "Project_5",
                "ReceiveCommentDeleted",
                It.IsAny<object>(),
                It.IsAny<CancellationToken>()
            ), Times.Once);
        }

        [Fact]
        public async Task UTCID02_Handle_CommentNotFound_ShouldThrowNotFoundException()
        {
            // Arrange
            SetupCurrentUser(userId: 10);
            _mockCommentRepo.Setup(r => r.Query()).Returns(new List<Comment>().AsQueryable().BuildMock());

            var command = new DeleteCommentCommand(999);

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<NotFoundException>()
                .WithMessage("Comment với ID [999] không tồn tại.");

            _mockCommentRepo.Verify(r => r.Remove(It.IsAny<Comment>()), Times.Never);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task UTCID03_Handle_NotAuthor_ShouldThrowForbiddenException()
        {
            // Arrange
            SetupCurrentUser(userId: 10);

            var existingComment = new Comment
            {
                CommentId = 100,
                AuthorId = 20, // different author
                Content = "Content"
            };
            _mockCommentRepo.Setup(r => r.Query()).Returns(new List<Comment> { existingComment }.AsQueryable().BuildMock());

            var command = new DeleteCommentCommand(100);

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<ForbiddenException>()
                .WithMessage("Bạn không có quyền xóa bình luận này.");

            _mockCommentRepo.Verify(r => r.Remove(It.IsAny<Comment>()), Times.Never);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task UTCID04_Handle_UserNotAuthenticated_ShouldThrowUnauthorizedAccessException()
        {
            // Arrange
            SetupCurrentUser(userId: 0, isAuthenticated: false);

            var command = new DeleteCommentCommand(100);

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<UnauthorizedAccessException>()
                .WithMessage("User is not authenticated.");
        }

        [Fact]
        public async Task UTCID05_Handle_SaveFailed_ShouldReturnFalse()
        {
            // Arrange
            SetupCurrentUser(userId: 10);

            var existingComment = new Comment
            {
                CommentId = 100,
                LogId = 200,
                AuthorId = 10,
                DailyLog = new DailyLog
                {
                    LogId = 200,
                    Task = new ProjectTask
                    {
                        Phase = new Phase { ProjectId = 5 }
                    }
                }
            };
            _mockCommentRepo.Setup(r => r.Query()).Returns(new List<Comment> { existingComment }.AsQueryable().BuildMock());
            _mockUow.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(0); // Save failed

            var command = new DeleteCommentCommand(100);

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().BeFalse();

            _mockCommentRepo.Verify(r => r.Remove(existingComment), Times.Once);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
            _mockRealtimeSender.Verify(s => s.SendToGroupAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<object>(),
                It.IsAny<CancellationToken>()
            ), Times.Never);
        }
    }
}
