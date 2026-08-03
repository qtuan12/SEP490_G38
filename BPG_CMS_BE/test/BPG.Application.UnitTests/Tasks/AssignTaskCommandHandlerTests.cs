using BPG.Application.Common.Models;
using BPG.Application.Features.Tasks.Commands;
using BPG.Application.Features.Tasks.Handlers;
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

namespace BPG.Application.UnitTests.Tasks
{
    public class AssignTaskCommandHandlerTests
    {
        private const long CurrentUserId = 10;
        private const long ProjectId = 5;
        private const long PhaseId = 10;
        private const long TaskId = 100;

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly Mock<IGenericRepository<ProjectTask>> _mockTaskRepo;
        private readonly Mock<IGenericRepository<ProjectMember>> _mockMemberRepo;
        private readonly Mock<IGenericRepository<TaskAssignee>> _mockAssigneeRepo;
        private readonly AssignTaskCommandHandler _handler;

        public AssignTaskCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();
            _mockTaskRepo = new Mock<IGenericRepository<ProjectTask>>();
            _mockMemberRepo = new Mock<IGenericRepository<ProjectMember>>();
            _mockAssigneeRepo = new Mock<IGenericRepository<TaskAssignee>>();

            _mockUow.Setup(u => u.Repository<ProjectTask>()).Returns(_mockTaskRepo.Object);
            _mockUow.Setup(u => u.Repository<ProjectMember>()).Returns(_mockMemberRepo.Object);
            _mockUow.Setup(u => u.Repository<TaskAssignee>()).Returns(_mockAssigneeRepo.Object);
            _mockUow.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

            SetupTasks(DefaultTask());
            SetupProjectMembers(
                new ProjectMember { ProjectId = ProjectId, UserId = 20 },
                new ProjectMember { ProjectId = ProjectId, UserId = 30 });

            _handler = new AssignTaskCommandHandler(
                _mockUow.Object,
                ServiceStubFactory.NotificationService(),
                _mockCurrentUserService.Object);
        }

        [Fact]
        public async Task UTCID01_Handle_TechnicalManagerAssignsValidMembers_ShouldReturnSuccess()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.TechnicalManager);

            var result = await _handler.Handle(Command(new List<long> { 20, 30 }), CancellationToken.None);

            result.Success.Should().BeTrue();
        }

        [Fact]
        public async Task UTCID02_Handle_TaskNotFound_ShouldThrowNotFoundException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.TechnicalManager);
            SetupTasks();

            var act = async () => await _handler.Handle(Command(new List<long> { 20 }, taskId: 999), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<NotFoundException>();
            exception.Which.ErrorCode.Should().Be("BIZ_001");
        }

        [Fact]
        public async Task UTCID03_Handle_SiteEngineerNotLeader_ShouldThrowForbiddenException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.SiteEngineer);
            _mockMemberRepo.Setup(r => r.AnyAsync(It.IsAny<System.Linq.Expressions.Expression<Func<ProjectMember, bool>>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(false);

            var act = async () => await _handler.Handle(Command(new List<long> { 20 }), CancellationToken.None);

            await act.Should().ThrowAsync<ForbiddenException>();
        }

        [Fact]
        public async Task UTCID04_Handle_AssigneeNotProjectMember_ShouldThrowBusinessException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.TechnicalManager);

            var act = async () => await _handler.Handle(Command(new List<long> { 999 }), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_TASK_ASSIGNEE_NOT_PROJECT_MEMBER");
        }

        [Fact]
        public async Task UTCID05_Handle_TaskStatusNew_ShouldChangeToAssigned()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.TechnicalManager);
            var task = DefaultTask(status: BPG.Domain.Constants.TaskStatus.New);
            SetupTasks(task);

            var result = await _handler.Handle(Command(new List<long> { 20 }), CancellationToken.None);

            result.Success.Should().BeTrue();
            task.Status.Should().Be(BPG.Domain.Constants.TaskStatus.Assigned);
        }

        // ==================== Factory Methods ====================

        private static AssignTaskCommand Command(List<long> assigneeIds, long taskId = TaskId)
            => new(taskId, assigneeIds);

        private static ProjectTask DefaultTask(string status = "New")
            => new()
            {
                TaskId = TaskId,
                PhaseId = PhaseId,
                Name = "Test Task",
                Status = status,
                Phase = new Phase { PhaseId = PhaseId, ProjectId = ProjectId },
                Assignees = new List<TaskAssignee>(),
                SubTasks = new List<ProjectTask>()
            };

        // ==================== Setup Methods ====================

        private void SetupTasks(params ProjectTask[] tasks)
        {
            _mockTaskRepo.Setup(r => r.Query()).Returns(tasks.AsQueryable().BuildMock());
        }

        private void SetupProjectMembers(params ProjectMember[] members)
        {
            _mockMemberRepo.Setup(r => r.Query()).Returns(members.AsQueryable().BuildMock());
        }
    }
}
