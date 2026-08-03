using AutoMapper;
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
    public class CreateTaskCommandHandlerTests
    {
        private const long ProjectId = 5;
        private const long PhaseId = 10;
        private const long TaskId = 100;
        private const long ParentTaskId = 90;
        private const long CurrentUserId = 1;
        private const long LeaderUserId = 2;

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IMapper> _mockMapper;
        private readonly Mock<IGenericRepository<Phase>> _mockPhaseRepo;
        private readonly Mock<IGenericRepository<ProjectTask>> _mockTaskRepo;
        private readonly Mock<IGenericRepository<ProjectMember>> _mockMemberRepo;
        private readonly Mock<IGenericRepository<TaskAssignee>> _mockAssigneeRepo;
        private readonly CreateTaskCommandHandler _handler;

        public CreateTaskCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockMapper = new Mock<IMapper>();
            _mockPhaseRepo = new Mock<IGenericRepository<Phase>>();
            _mockTaskRepo = new Mock<IGenericRepository<ProjectTask>>();
            _mockMemberRepo = new Mock<IGenericRepository<ProjectMember>>();
            _mockAssigneeRepo = new Mock<IGenericRepository<TaskAssignee>>();

            _mockUow.Setup(u => u.Repository<Phase>()).Returns(_mockPhaseRepo.Object);
            _mockUow.Setup(u => u.Repository<ProjectTask>()).Returns(_mockTaskRepo.Object);
            _mockUow.Setup(u => u.Repository<ProjectMember>()).Returns(_mockMemberRepo.Object);
            _mockUow.Setup(u => u.Repository<TaskAssignee>()).Returns(_mockAssigneeRepo.Object);
            _mockUow.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

            _mockTaskRepo.Setup(r => r.AddAsync(It.IsAny<ProjectTask>(), It.IsAny<CancellationToken>()))
                .Callback<ProjectTask, CancellationToken>((t, _) => t.TaskId = TaskId)
                .Returns(Task.CompletedTask);
            _mockAssigneeRepo.Setup(r => r.RemoveRange(It.IsAny<IEnumerable<TaskAssignee>>()));

            SetupPhases(DefaultPhase());
            SetupTasks();
            SetupProjectMembers();
            SetupMapper();

            _handler = new CreateTaskCommandHandler(
                _mockUow.Object,
                ServiceStubFactory.NotificationService(),
                ServiceStubFactory.RealtimeSender(),
                _mockMapper.Object,
                ServiceStubFactory.ProgressRollupService());
        }

        [Fact]
        public async Task UTCID01_Handle_ValidRootTask_ShouldReturnSuccess()
        {
            var command = Command();

            var result = await _handler.Handle(command, CancellationToken.None);

            result.Data.Should().Be(TaskId);
            result.Success.Should().BeTrue();
        }

        [Fact]
        public async Task UTCID02_Handle_PhaseNotFound_ShouldThrowNotFoundException()
        {
            SetupPhases();

            var act = async () => await _handler.Handle(Command(phaseId: 999), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<NotFoundException>();
            exception.Which.ErrorCode.Should().Be("BIZ_001");
        }

        [Fact]
        public async Task UTCID03_Handle_StartDateBeforePhaseStart_ShouldThrowBusinessException()
        {
            SetupPhases(DefaultPhase(startDate: new DateOnly(2026, 3, 1)));

            var command = Command(startDate: new DateOnly(2026, 2, 1));
            var act = async () => await _handler.Handle(command, CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_TASK_DATE_INVALID");
        }

        [Fact]
        public async Task UTCID04_Handle_EndDateAfterPhaseEnd_ShouldThrowBusinessException()
        {
            SetupPhases(DefaultPhase(endDate: new DateOnly(2026, 6, 30)));

            var command = Command(endDate: new DateOnly(2026, 7, 15));
            var act = async () => await _handler.Handle(command, CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_TASK_DATE_INVALID");
        }

        [Fact]
        public async Task UTCID05_Handle_ParentTaskNotFound_ShouldThrowNotFoundException()
        {
            SetupTasks();

            var command = Command(parentTaskId: 999);
            var act = async () => await _handler.Handle(command, CancellationToken.None);

            var exception = await act.Should().ThrowAsync<NotFoundException>();
            exception.Which.ErrorCode.Should().Be("BIZ_001");
        }

        [Fact]
        public async Task UTCID06_Handle_ParentIsAlreadySubtask_ShouldThrowBusinessException()
        {
            var grandParent = DefaultTask(taskId: 80);
            var parent = DefaultTask(taskId: ParentTaskId, parentTaskId: 80);
            SetupTasks(grandParent, parent);

            var command = Command(parentTaskId: ParentTaskId);
            var act = async () => await _handler.Handle(command, CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_MAX_DEPTH_EXCEEDED");
        }

        [Fact]
        public async Task UTCID07_Handle_ChildDateOutsideParentRange_ShouldThrowBusinessException()
        {
            var parent = DefaultTask(
                taskId: ParentTaskId,
                startDate: new DateOnly(2026, 3, 1),
                endDate: new DateOnly(2026, 5, 31));
            SetupTasks(parent);

            var command = Command(
                parentTaskId: ParentTaskId,
                startDate: new DateOnly(2026, 2, 1),
                endDate: new DateOnly(2026, 4, 30));
            var act = async () => await _handler.Handle(command, CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_TASK_DATE_INVALID");
        }

        [Fact]
        public async Task UTCID08_Handle_WithAssigneeIds_ShouldReturnSuccessAndStatusAssigned()
        {
            var command = Command(assigneeIds: new List<long> { 20, 30 });

            var result = await _handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeTrue();
            _mockTaskRepo.Verify(r => r.AddAsync(
                It.Is<ProjectTask>(t => t.Status == BPG.Domain.Constants.TaskStatus.Assigned),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        // ==================== Factory Methods ====================

        private static CreateTaskCommand Command(
            long phaseId = PhaseId,
            long? parentTaskId = null,
            string name = "Test Task",
            DateOnly? startDate = null,
            DateOnly? endDate = null,
            List<long>? assigneeIds = null)
            => new(
                PhaseId: phaseId,
                ParentTaskId: parentTaskId,
                Name: name,
                Description: "Test description",
                OrderIndex: 1,
                StartDate: startDate ?? new DateOnly(2026, 3, 1),
                EndDate: endDate ?? new DateOnly(2026, 6, 30),
                AssigneeIds: assigneeIds,
                Weight: null);

        private static Phase DefaultPhase(
            long phaseId = PhaseId,
            DateOnly? startDate = null,
            DateOnly? endDate = null)
            => new()
            {
                PhaseId = phaseId,
                ProjectId = ProjectId,
                Name = "Phase 1",
                StartDate = startDate ?? new DateOnly(2026, 1, 1),
                EndDate = endDate ?? new DateOnly(2026, 12, 31)
            };

        private static ProjectTask DefaultTask(
            long taskId = ParentTaskId,
            long? parentTaskId = null,
            DateOnly? startDate = null,
            DateOnly? endDate = null)
            => new()
            {
                TaskId = taskId,
                PhaseId = PhaseId,
                ParentTaskId = parentTaskId,
                Name = "Parent Task",
                Status = BPG.Domain.Constants.TaskStatus.New,
                StartDate = startDate ?? new DateOnly(2026, 1, 1),
                EndDate = endDate ?? new DateOnly(2026, 12, 31),
                Assignees = new List<TaskAssignee>(),
                SubTasks = new List<ProjectTask>()
            };

        // ==================== Setup Methods ====================

        private void SetupPhases(params Phase[] phases)
        {
            _mockPhaseRepo.Setup(r => r.Query()).Returns(phases.AsQueryable().BuildMock());
        }

        private void SetupTasks(params ProjectTask[] tasks)
        {
            _mockTaskRepo.Setup(r => r.Query()).Returns(tasks.AsQueryable().BuildMock());
        }

        private void SetupProjectMembers(params ProjectMember[] members)
        {
            _mockMemberRepo.Setup(r => r.Query()).Returns(members.AsQueryable().BuildMock());
        }

        private void SetupMapper()
        {
            _mockMapper.Setup(m => m.Map<ProjectTask>(It.IsAny<CreateTaskCommand>()))
                .Returns((CreateTaskCommand cmd) => new ProjectTask
                {
                    PhaseId = cmd.PhaseId,
                    ParentTaskId = cmd.ParentTaskId,
                    Name = cmd.Name,
                    Description = cmd.Description,
                    OrderIndex = cmd.OrderIndex,
                    StartDate = cmd.StartDate,
                    EndDate = cmd.EndDate,
                    Assignees = new List<TaskAssignee>(),
                    ProgressLogs = new List<TaskProgressLog>(),
                    SubTasks = new List<ProjectTask>()
                });
        }
    }
}
