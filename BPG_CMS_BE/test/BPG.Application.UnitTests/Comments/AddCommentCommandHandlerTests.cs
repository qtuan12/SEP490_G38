using AutoMapper;
using BPG.Application.Common.Mappings;
using BPG.Application.DTOs.DailyLogs;
using BPG.Application.Features.Comments.Commands;
using BPG.Application.Features.Comments.Handlers;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Application.UnitTests.Helpers;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using MockQueryable;
using Moq;
using RoleConstants = BPG.Domain.Constants.UserRole;
using UserRoleEntity = BPG.Domain.Entities.UserRole;

namespace BPG.Application.UnitTests.Comments
{
    public class AddCommentCommandHandlerTests
    {
        private const long DefaultLogId = 100;
        private const long MissingLogId = 999;
        private const long ProjectId = 5;
        private const long LogCreatorId = 20;
        private const long TechnicalManagerId = 11;
        private const long SiteEngineerId = 12;
        private const string ValidContent = "Valid comment content";
        private const string ProjectGroup = "Project_5";
        private const string ReceiveCommentAdded = "ReceiveCommentAdded";
        private const string CreatorNotificationTitle = "Bình luận mới dưới nhật ký";
        private const string CommenterNotificationTitle = "Hoạt động bình luận mới";

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IGenericRepository<DailyLog>> _mockDailyLogRepo;
        private readonly Mock<IGenericRepository<ProjectMember>> _mockMemberRepo;
        private readonly Mock<IGenericRepository<Comment>> _mockCommentRepo;
        private readonly Mock<IGenericRepository<User>> _mockUserRepo;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly Mock<INotificationService> _mockNotificationService;
        private readonly Mock<IRealtimeNotificationSender> _mockRealtimeSender;
        private readonly AddCommentCommandHandler _handler;

        public AddCommentCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockDailyLogRepo = new Mock<IGenericRepository<DailyLog>>();
            _mockMemberRepo = new Mock<IGenericRepository<ProjectMember>>();
            _mockCommentRepo = new Mock<IGenericRepository<Comment>>();
            _mockUserRepo = new Mock<IGenericRepository<User>>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();
            _mockNotificationService = new Mock<INotificationService>();
            _mockRealtimeSender = new Mock<IRealtimeNotificationSender>();

            var mapperConfig = new MapperConfiguration(cfg => cfg.AddProfile<MappingProfile>());
            var mapper = mapperConfig.CreateMapper();

            _mockUow.Setup(u => u.Repository<DailyLog>()).Returns(_mockDailyLogRepo.Object);
            _mockUow.Setup(u => u.Repository<ProjectMember>()).Returns(_mockMemberRepo.Object);
            _mockUow.Setup(u => u.Repository<Comment>()).Returns(_mockCommentRepo.Object);
            _mockUow.Setup(u => u.Repository<User>()).Returns(_mockUserRepo.Object);

            _handler = new AddCommentCommandHandler(
                _mockUow.Object,
                mapper,
                _mockCurrentUserService.Object,
                _mockNotificationService.Object,
                _mockRealtimeSender.Object
            );
        }

        // =========================================================================
        // 1. AUTHENTICATION & EXISTENCE CHECKS
        // =========================================================================

        [Fact]
        public async Task UTCID01_Handle_UnauthenticatedUser_ShouldThrowUnauthorizedAccessException()
        {
            _mockCurrentUserService
                .Setup(s => s.GetRequiredUserId())
                .Throws(new UnauthorizedAccessException("User is not authenticated."));

            var act = async () => await _handler.Handle(DefaultCommand(), CancellationToken.None);

            await act.Should().ThrowAsync<UnauthorizedAccessException>()
                .WithMessage("User is not authenticated.");
            VerifyNoCommentSaved();
        }

        [Fact]
        public async Task UTCID02_Handle_DailyLogNotFound_ShouldThrowNotFoundException()
        {
            _mockCurrentUserService.SetupUser(TechnicalManagerId, RoleConstants.TechnicalManager);
            SetupDailyLogs();

            var act = async () => await _handler.Handle(DefaultCommand(MissingLogId), CancellationToken.None);

            await act.Should().ThrowAsync<NotFoundException>()
                .WithMessage("DailyLog với ID [999] không tồn tại.");
            VerifyNoCommentSaved();
        }

        // =========================================================================
        // 2. AUTHORIZATION CHECKS (PRIVILEGED ROLES VS PROJECT MEMBERS)
        // =========================================================================

        [Fact]
        public async Task UTCID03_Handle_PrivilegedUser_ShouldBypassMemberCheckAndAddComment()
        {
            _mockCurrentUserService.SetupUser(TechnicalManagerId, RoleConstants.TechnicalManager);
            SetupDailyLog("Brickwork");
            SetupAuthor(TechnicalManagerId, "TM User", RoleConstants.TechnicalManager);
            SetupExistingComments();

            var result = await _handler.Handle(DefaultCommand(), CancellationToken.None);

            result.Should().NotBeNull();
            result.AuthorRole.Should().Be(RoleConstants.TechnicalManager);
            result.Content.Should().Be(ValidContent);
            VerifyCommentSaved(TechnicalManagerId, ValidContent);
            VerifySaveOnce();
            VerifyCreatorNotificationOnce(LogCreatorId);
            VerifyRealtimeOnce();
        }

        [Fact]
        public async Task UTCID04_Handle_ProjectMemberUser_ShouldAddCommentSuccessfully()
        {
            _mockCurrentUserService.SetupUser(SiteEngineerId, RoleConstants.SiteEngineer);
            SetupDailyLog("Plumbing");
            SetupProjectMembers(SiteEngineerId);
            SetupAuthor(SiteEngineerId, "SiteEngineer User", RoleConstants.SiteEngineer);
            SetupExistingComments();

            var result = await _handler.Handle(DefaultCommand(), CancellationToken.None);

            result.Should().NotBeNull();
            result.AuthorName.Should().Be("SiteEngineer User");
            result.Content.Should().Be(ValidContent);
            VerifyCommentSaved(SiteEngineerId, ValidContent);
            VerifySaveOnce();
            VerifyCreatorNotificationOnce(LogCreatorId);
            VerifyRealtimeOnce();
        }

        [Fact]
        public async Task UTCID05_Handle_NotProjectMember_ShouldThrowForbiddenException()
        {
            _mockCurrentUserService.SetupUser(SiteEngineerId, RoleConstants.SiteEngineer);
            SetupDailyLog("Electrical");
            SetupProjectMembers();

            var act = async () => await _handler.Handle(DefaultCommand(), CancellationToken.None);

            await act.Should().ThrowAsync<ForbiddenException>()
                .WithMessage("Bạn không phải thành viên của dự án này.");
            VerifyNoCommentSaved();
        }

        // =========================================================================
        // 3. BOUNDARY & NOTIFICATION MATRIX CHECKS
        // =========================================================================

        [Fact]
        public async Task UTCID06_Handle_ContentBoundaryMaxLength_ShouldAddCommentSuccessfully()
        {
            _mockCurrentUserService.SetupUser(TechnicalManagerId, RoleConstants.TechnicalManager);
            SetupDailyLog("Foundation");
            SetupAuthor(TechnicalManagerId, "TM User", RoleConstants.TechnicalManager);
            SetupExistingComments();

            var maxLengthContent = new string('A', 1000);
            var result = await _handler.Handle(DefaultCommand(content: maxLengthContent), CancellationToken.None);

            result.Content.Should().HaveLength(1000);
            VerifyCommentSaved(TechnicalManagerId, maxLengthContent);
            VerifySaveOnce();
            VerifyCreatorNotificationOnce(LogCreatorId);
            VerifyRealtimeOnce();
        }

        [Fact]
        public async Task UTCID07_Handle_SelfComment_ShouldNotNotifyCreator()
        {
            _mockCurrentUserService.SetupUser(LogCreatorId, RoleConstants.SiteEngineer);
            SetupDailyLog("Plastering", createdBy: LogCreatorId);
            SetupProjectMembers(LogCreatorId);
            SetupAuthor(LogCreatorId, "Creator User");
            SetupExistingComments();

            await _handler.Handle(DefaultCommand(), CancellationToken.None);

            VerifyCommentSaved(LogCreatorId, ValidContent);
            VerifySaveOnce();
            VerifyNoNotificationToUser(LogCreatorId);
            VerifyRealtimeOnce();
        }

        [Fact]
        public async Task UTCID08_Handle_MasterNotificationMatrix_ShouldNotifyCreatorAndUniqueCommenters()
        {
            _mockCurrentUserService.SetupUser(TechnicalManagerId, RoleConstants.TechnicalManager);
            SetupDailyLog("Scaffolding");
            SetupAuthor(TechnicalManagerId, "TM User");
            SetupExistingComments(
                CommentFrom(30),
                CommentFrom(30),
                CommentFrom(TechnicalManagerId),
                CommentFrom(LogCreatorId),
                CommentFrom(50, isDeleted: true)
            );

            await _handler.Handle(DefaultCommand(), CancellationToken.None);

            VerifyCommentSaved(TechnicalManagerId, ValidContent);
            VerifySaveOnce();
            VerifyCreatorNotificationOnce(LogCreatorId);
            VerifyCommenterNotificationOnce(30);
            VerifyNoCommenterNotificationToUser(LogCreatorId);
            VerifyNoNotificationToUser(50);
            VerifyRealtimeOnce();
        }

        // =========================================================================
        // HELPER SETUP & VERIFICATION METHODS
        // =========================================================================

        private static AddCommentCommand DefaultCommand(long logId = DefaultLogId, string content = ValidContent)
            => new() { LogId = logId, Content = content };

        private static Comment CommentFrom(long authorId, bool isDeleted = false)
            => new() { LogId = DefaultLogId, AuthorId = authorId, IsDeleted = isDeleted };

        private void SetupDailyLog(string taskName, long logId = DefaultLogId, long createdBy = LogCreatorId)
        {
            SetupDailyLogs(new DailyLog
            {
                LogId = logId,
                TaskId = 0,
                CreatedBy = createdBy,
                Task = new ProjectTask
                {
                    Name = taskName,
                    Phase = new Phase { ProjectId = ProjectId }
                }
            });
        }

        private void SetupDailyLogs(params DailyLog[] dailyLogs)
        {
            _mockDailyLogRepo.Setup(r => r.Query()).Returns(dailyLogs.AsQueryable().BuildMock());
        }

        private void SetupProjectMembers(params long[] userIds)
        {
            var members = userIds.Select(userId => new ProjectMember { ProjectId = ProjectId, UserId = userId }).ToList();
            _mockMemberRepo.Setup(r => r.Query()).Returns(members.AsQueryable().BuildMock());
        }

        private void SetupAuthor(long userId, string fullName, string? roleName = null)
        {
            var roles = roleName == null
                ? new List<UserRoleEntity>()
                : new List<UserRoleEntity> { new() { Role = new Role { RoleName = roleName } } };

            var author = new User { UserId = userId, FullName = fullName, UserRoles = roles };
            _mockUserRepo.Setup(r => r.Query()).Returns(new[] { author }.AsQueryable().BuildMock());
        }

        private void SetupExistingComments(params Comment[] comments)
        {
            _mockCommentRepo.Setup(r => r.Query()).Returns(comments.AsQueryable().BuildMock());
        }

        private void VerifyCommentSaved(long authorId, string content)
        {
            _mockCommentRepo.Verify(r => r.AddAsync(It.Is<Comment>(c =>
                c.LogId == DefaultLogId &&
                c.AuthorId == authorId &&
                c.CreatedBy == authorId &&
                c.Content == content &&
                !c.IsDeleted), It.IsAny<CancellationToken>()), Times.Once);
        }

        private void VerifyNoCommentSaved()
        {
            _mockCommentRepo.Verify(r => r.AddAsync(It.IsAny<Comment>(), It.IsAny<CancellationToken>()), Times.Never);
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        }

        private void VerifySaveOnce()
        {
            _mockUow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        private void VerifyCreatorNotificationOnce(long userId)
        {
            _mockNotificationService.Verify(n => n.SendNotificationAsync(
                userId, CreatorNotificationTitle, It.IsAny<string>(), NotificationType.Progress,
                It.Is<string>(s => s.StartsWith("/projects/")), DefaultLogId, It.IsAny<CancellationToken>()), Times.Once);
        }

        private void VerifyCommenterNotificationOnce(long userId)
        {
            _mockNotificationService.Verify(n => n.SendNotificationAsync(
                userId, CommenterNotificationTitle, It.IsAny<string>(), NotificationType.Progress,
                It.Is<string>(s => s.StartsWith("/projects/")), DefaultLogId, It.IsAny<CancellationToken>()), Times.Once);
        }

        private void VerifyNoNotificationToUser(long userId)
        {
            _mockNotificationService.Verify(n => n.SendNotificationAsync(
                userId, It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<string>(), It.IsAny<long?>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        private void VerifyNoCommenterNotificationToUser(long userId)
        {
            _mockNotificationService.Verify(n => n.SendNotificationAsync(
                userId, CommenterNotificationTitle, It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<string>(), It.IsAny<long?>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        private void VerifyRealtimeOnce()
        {
            _mockRealtimeSender.Verify(s => s.SendToGroupAsync(
                ProjectGroup, ReceiveCommentAdded, It.IsAny<CommentDto>(), It.IsAny<CancellationToken>()), Times.Once);
        }
    }
}
