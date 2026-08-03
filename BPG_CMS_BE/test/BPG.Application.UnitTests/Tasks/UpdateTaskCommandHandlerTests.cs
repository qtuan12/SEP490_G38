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

namespace BPG.Application.UnitTests.Tasks
{
    public class UpdateTaskCommandHandlerTests
    {
        private const long ProjectId = 5;
        private const long PhaseId = 10;
        private const long TaskId = 100;
        private const long ParentTaskId = 90;

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IMapper> _mockMapper;
        private readonly Mock<IGenericRepository<ProjectTask>> _mockTaskRepo;
        private readonly UpdateTaskCommandHandler _handler;

        public UpdateTaskCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockMapper = new Mock<IMapper>();
            _mockTaskRepo = new Mock<IGenericRepository<ProjectTask>>();

            _mockUow.Setup(u => u.Repository<ProjectTask>()).Returns(_mockTaskRepo.Object);
            _mockUow.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

            SetupTasks(DefaultTask());
            SetupMapper();

            _handler = new UpdateTaskCommandHandler(
                _mockUow.Object,
                ServiceStubFactory.RealtimeSender(),
                _mockMapper.Object,
                ServiceStubFactory.ProgressRollupService());
        }

        [Fact]
        public async Task UTCID01_Handle_ValidUpdate_ShouldReturnSuccess()
        {
            var command = Command();

            var result = await _handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeTrue();
        }

        [Fact]
        public async Task UTCID02_Handle_TaskNotFound_ShouldThrowNotFoundException()
        {
            SetupTasks();

            var act = async () => await _handler.Handle(Command(taskId: 999), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<NotFoundException>();
            exception.Which.ErrorCode.Should().Be("BIZ_001");
        }

        [Fact]
        public async Task UTCID03_Handle_StartDateBeforePhaseStart_ShouldThrowBusinessException()
        {
            SetupTasks(DefaultTask(phaseStartDate: new DateOnly(2026, 3, 1)));

            var command = Command(startDate: new DateOnly(2026, 2, 1));
            var act = async () => await _handler.Handle(command, CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_TASK_DATE_INVALID");
        }

        [Fact]
        public async Task UTCID04_Handle_EndDateAfterPhaseEnd_ShouldThrowBusinessException()
        {
            SetupTasks(DefaultTask(phaseEndDate: new DateOnly(2026, 6, 30)));

            var command = Command(endDate: new DateOnly(2026, 7, 15));
            var act = async () => await _handler.Handle(command, CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_TASK_DATE_INVALID");
        }

        [Fact]
        public async Task UTCID05_Handle_ChildDateOutsideParentRange_ShouldThrowBusinessException()
        {
            var parent = DefaultTask(taskId: ParentTaskId,
                startDate: new DateOnly(2026, 3, 1),
                endDate: new DateOnly(2026, 5, 31));
            var child = DefaultTask(parentTaskId: ParentTaskId);
            SetupTasks(parent, child);

            var command = Command(startDate: new DateOnly(2026, 2, 1));
            var act = async () => await _handler.Handle(command, CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_TASK_DATE_INVALID");
        }

        [Fact]
        public async Task UTCID06_Handle_ProgressAboveZeroWithoutReason_ShouldThrowBusinessException()
        {
            SetupTasks(DefaultTask(progress: 30, name: "Old Name"));

            var command = Command(name: "New Name", updateReason: null);
            var act = async () => await _handler.Handle(command, CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("ERR_TASK_UPDATE_REASON_REQUIRED");
        }

        [Fact]
        public async Task UTCID07_Handle_ProgressAboveZeroWithReason_ShouldReturnSuccess()
        {
            SetupTasks(DefaultTask(progress: 30, name: "Old Name"));

            var command = Command(name: "New Name", updateReason: "Correction needed");

            var result = await _handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeTrue();
        }

        // ==================== Factory Methods ====================

        private static UpdateTaskCommand Command(
            long taskId = TaskId,
            string name = "Updated Task",
            DateOnly? startDate = null,
            DateOnly? endDate = null,
            string? updateReason = null)
            => new(
                TaskId: taskId,
                Name: name,
                Description: "Updated desc",
                OrderIndex: 1,
                StartDate: startDate ?? new DateOnly(2026, 3, 1),
                EndDate: endDate ?? new DateOnly(2026, 6, 30),
                UpdateReason: updateReason,
                Weight: null);

        private static ProjectTask DefaultTask(
            long taskId = TaskId,
            long? parentTaskId = null,
            byte progress = 0,
            string name = "Original Task",
            DateOnly? startDate = null,
            DateOnly? endDate = null,
            DateOnly? phaseStartDate = null,
            DateOnly? phaseEndDate = null)
            => new()
            {
                TaskId = taskId,
                PhaseId = PhaseId,
                ParentTaskId = parentTaskId,
                Name = name,
                Description = "Original desc",
                ProgressPercent = progress,
                Status = progress > 0 ? BPG.Domain.Constants.TaskStatus.InProgress : BPG.Domain.Constants.TaskStatus.New,
                StartDate = startDate ?? new DateOnly(2026, 3, 1),
                EndDate = endDate ?? new DateOnly(2026, 6, 30),
                Weight = null,
                Phase = new Phase
                {
                    PhaseId = PhaseId,
                    ProjectId = ProjectId,
                    StartDate = phaseStartDate ?? new DateOnly(2026, 1, 1),
                    EndDate = phaseEndDate ?? new DateOnly(2026, 12, 31)
                },
                ProgressLogs = new List<TaskProgressLog>(),
                SubTasks = new List<ProjectTask>()
            };

        // ==================== Setup Methods ====================

        private void SetupTasks(params ProjectTask[] tasks)
        {
            _mockTaskRepo.Setup(r => r.Query()).Returns(tasks.AsQueryable().BuildMock());
        }

        private void SetupMapper()
        {
            _mockMapper.Setup(m => m.Map(It.IsAny<UpdateTaskCommand>(), It.IsAny<ProjectTask>()))
                .Callback<UpdateTaskCommand, ProjectTask>((cmd, task) =>
                {
                    task.Name = cmd.Name;
                    task.Description = cmd.Description;
                    task.StartDate = cmd.StartDate;
                    task.EndDate = cmd.EndDate;
                    task.Weight = cmd.Weight;
                })
                .Returns((UpdateTaskCommand _, ProjectTask task) => task);
        }
    }
}
