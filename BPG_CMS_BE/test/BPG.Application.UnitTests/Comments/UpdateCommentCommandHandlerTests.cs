using AutoMapper;
using BPG.Application.Common.Mappings;
using BPG.Application.DTOs.DailyLogs;
using BPG.Application.Features.Comments.Commands;
using BPG.Application.Features.Comments.Handlers;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
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
    public class UpdateCommentCommandHandlerTests
    {
        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IGenericRepository<Comment>> _mockCommentRepo;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly Mock<IRealtimeNotificationSender> _mockRealtimeSender;
        private readonly IMapper _mapper;
        private readonly UpdateCommentCommandHandler _handler;

        public UpdateCommentCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockCommentRepo = new Mock<IGenericRepository<Comment>>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();
            _mockRealtimeSender = new Mock<IRealtimeNotificationSender>();

            var mapperConfig = new MapperConfiguration(cfg =>
            {
                cfg.AddProfile<MappingProfile>();
            });
            _mapper = mapperConfig.CreateMapper();

            _mockUow.Setup(u => u.Repository<Comment>()).Returns(_mockCommentRepo.Object);

            _handler = new UpdateCommentCommandHandler(
                _mockUow.Object,
                _mapper,
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
        public async Task UTCID01_Handle_ValidRequest_ShouldUpdateCommentSuccessfully()
        {
            // Arrange
            SetupCurrentUser(userId: 10);

            var existingComment = new Comment
            {
                CommentId = 100,
                AuthorId = 10, // matching current user
                Content = "Old Content",
                DailyLog = new DailyLog
                {
                    LogId = 200,
                    Task = new ProjectTask
                    {
                        Phase = new Phase { ProjectId = 5 }
                    }
                },
                Author = new User
                {
                    UserId = 10,
                    FullName = "Author User",
                    UserRoles = new List<BPG.Domain.Entities.UserRole>()
                }
            };
            _mockCommentRepo.Setup(r => r.Query()).Returns(new List<Comment> { existingComment }.AsQueryable().BuildMock());

            var command = new UpdateCommentCommand { CommentId = 100, Content = "New Content" };

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.Content.Should().Be("New Content");
            result.CommentId.Should().Be(100);

            _mockCommentRepo.Verify(r => r.Update(existingComment), Times.Once);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
            _mockRealtimeSender.Verify(s => s.SendToGroupAsync(
                "Project_5",
                "ReceiveCommentUpdated",
                It.Is<CommentDto>(dto => dto.Content == "New Content"),
                It.IsAny<CancellationToken>()
            ), Times.Once);
        }

        [Fact]
        public async Task UTCID02_Handle_CommentNotFound_ShouldThrowNotFoundException()
        {
            // Arrange
            SetupCurrentUser(userId: 10);
            _mockCommentRepo.Setup(r => r.Query()).Returns(new List<Comment>().AsQueryable().BuildMock());

            var command = new UpdateCommentCommand { CommentId = 999, Content = "New Content" };

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<NotFoundException>()
                .WithMessage("Comment với ID [999] không tồn tại.");

            _mockCommentRepo.Verify(r => r.Update(It.IsAny<Comment>()), Times.Never);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task UTCID03_Handle_NotAuthor_ShouldThrowForbiddenException()
        {
            // Arrange
            SetupCurrentUser(userId: 10); // current user is 10

            var existingComment = new Comment
            {
                CommentId = 100,
                AuthorId = 20, // author is 20 (different!)
                Content = "Old Content"
            };
            _mockCommentRepo.Setup(r => r.Query()).Returns(new List<Comment> { existingComment }.AsQueryable().BuildMock());

            var command = new UpdateCommentCommand { CommentId = 100, Content = "New Content" };

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<ForbiddenException>()
                .WithMessage("Bạn không có quyền chỉnh sửa bình luận này.");

            _mockCommentRepo.Verify(r => r.Update(It.IsAny<Comment>()), Times.Never);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task UTCID04_Handle_UserNotAuthenticated_ShouldThrowUnauthorizedAccessException()
        {
            // Arrange
            SetupCurrentUser(userId: 0, isAuthenticated: false);

            var command = new UpdateCommentCommand { CommentId = 100, Content = "New Content" };

            // Act
            Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<UnauthorizedAccessException>()
                .WithMessage("User is not authenticated.");
        }

        [Fact]
        public async Task UTCID05_Handle_ContentBoundaryMaxLength_ShouldUpdateSuccessfully()
        {
            // Arrange
            SetupCurrentUser(userId: 10);

            var existingComment = new Comment
            {
                CommentId = 100,
                AuthorId = 10,
                Content = "Old Content",
                DailyLog = new DailyLog
                {
                    LogId = 200,
                    Task = new ProjectTask
                    {
                        Phase = new Phase { ProjectId = 5 }
                    }
                },
                Author = new User
                {
                    UserId = 10,
                    FullName = "Author User",
                    UserRoles = new List<BPG.Domain.Entities.UserRole>()
                }
            };
            _mockCommentRepo.Setup(r => r.Query()).Returns(new List<Comment> { existingComment }.AsQueryable().BuildMock());

            var maxLengthContent = new string('B', 1000);
            var command = new UpdateCommentCommand { CommentId = 100, Content = maxLengthContent };

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Content.Length.Should().Be(1000);
        }
    }
}
