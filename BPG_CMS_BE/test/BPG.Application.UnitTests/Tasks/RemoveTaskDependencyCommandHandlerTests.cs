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
    public class RemoveTaskDependencyCommandHandlerTests
    {
        private const long CurrentUserId = 10;
        private const long ProjectId = 5;
        private const long PhaseId = 10;
        private const long TaskId = 100;
        private const long PredecessorTaskId = 90;

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly Mock<IGenericRepository<ProjectMember>> _mockMemberRepo;
        private readonly Mock<IGenericRepository<TaskDependency>> _mockDependencyRepo;
        private readonly RemoveTaskDependencyCommandHandler _handler;

        public RemoveTaskDependencyCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();
            _mockMemberRepo = new Mock<IGenericRepository<ProjectMember>>();
            _mockDependencyRepo = new Mock<IGenericRepository<TaskDependency>>();

            _mockUow.Setup(u => u.Repository<ProjectMember>()).Returns(_mockMemberRepo.Object);
            _mockUow.Setup(u => u.Repository<TaskDependency>()).Returns(_mockDependencyRepo.Object);
            _mockUow.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

            SetupDependencies(DefaultDependency());
            SetupProjectMembers();

            _handler = new RemoveTaskDependencyCommandHandler(
                _mockUow.Object,
                ServiceStubFactory.RealtimeSender(),
                _mockCurrentUserService.Object);
        }

        [Fact]
        public async Task UTCID01_Handle_DependencyExists_ShouldReturnSuccess()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.TechnicalManager);

            var result = await _handler.Handle(Command(), CancellationToken.None);

            result.Success.Should().BeTrue();
            _mockDependencyRepo.Verify(r => r.Remove(It.Is<TaskDependency>(d => d.TaskId == TaskId && d.PredecessorTaskId == PredecessorTaskId)), Times.Once);
        }

        [Fact]
        public async Task UTCID02_Handle_DependencyNotFound_ShouldThrowNotFoundException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.TechnicalManager);
            SetupDependencies();

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<NotFoundException>();
            exception.Which.ErrorCode.Should().Be("BIZ_001");
        }

        [Fact]
        public async Task UTCID03_Handle_SiteEngineerNotLeader_ShouldThrowForbiddenException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.SiteEngineer);
            _mockMemberRepo.Setup(r => r.AnyAsync(It.IsAny<System.Linq.Expressions.Expression<Func<ProjectMember, bool>>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(false);

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            await act.Should().ThrowAsync<ForbiddenException>();
        }

        // ==================== Factory Methods ====================

        private static RemoveTaskDependencyCommand Command(long taskId = TaskId, long predecessorTaskId = PredecessorTaskId)
            => new(taskId, predecessorTaskId);

        private static TaskDependency DefaultDependency()
            => new()
            {
                TaskId = TaskId,
                PredecessorTaskId = PredecessorTaskId,
                Task = new ProjectTask
                {
                    TaskId = TaskId,
                    Phase = new Phase { PhaseId = PhaseId, ProjectId = ProjectId }
                }
            };

        // ==================== Setup Methods ====================

        private void SetupDependencies(params TaskDependency[] dependencies)
        {
            _mockDependencyRepo.Setup(r => r.Query()).Returns(dependencies.AsQueryable().BuildMock());
        }

        private void SetupProjectMembers(params ProjectMember[] members)
        {
            _mockMemberRepo.Setup(r => r.Query()).Returns(members.AsQueryable().BuildMock());
        }
    }
}
