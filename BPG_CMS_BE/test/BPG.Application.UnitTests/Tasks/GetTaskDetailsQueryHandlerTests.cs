using BPG.Application.Features.Tasks.Handlers;
using BPG.Application.Features.Tasks.Queries.GetTaskDetails;
using BPG.Application.DTOs.Tasks;
using BPG.Application.IRepositories;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using MockQueryable;
using Moq;

namespace BPG.Application.UnitTests.Tasks;

public class GetTaskDetailsQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IGenericRepository<ProjectTask>> _taskRepo = new();
    private readonly GetTaskDetailsQueryHandler _handler;

    public GetTaskDetailsQueryHandlerTests()
    {
        _uow.Setup(x => x.Repository<ProjectTask>()).Returns(_taskRepo.Object);
        SetupTasks(TaskEntity());
        _handler = new GetTaskDetailsQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task UTCID01_Handle_ExistingTask_ShouldReturnMappedDetails()
    {
        var result = await _handler.Handle(new GetTaskDetailsQuery(10), CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Data.Should().BeEquivalentTo(new TaskDetailsDto
        {
            TaskId = 10,
            PhaseId = 2,
            ProjectId = 3,
            ParentTaskId = 5,
            Name = "Foundation",
            Description = "Build the foundation",
            StartDate = new DateOnly(2026, 8, 1),
            EndDate = new DateOnly(2026, 8, 31),
            Status = BPG.Domain.Constants.TaskStatus.InProgress,
            ProgressPercent = 40,
            ObsoleteReason = null,
            Assignees =
            [
                new TaskAssigneeDto(8, "Engineer", "engineer@test.local")
            ],
            ProgressLogs =
            [
                new TaskProgressLogDto(102, 20, 40, "Second update", new DateTime(2026, 8, 2, 9, 0, 0, DateTimeKind.Utc), 8),
                new TaskProgressLogDto(101, 0, 20, "First update", new DateTime(2026, 8, 1, 9, 0, 0, DateTimeKind.Utc), 8)
            ],
            DailyLogs =
            [
                new TaskDailyLogDto(202, new DateOnly(2026, 8, 2), "Second daily log", 40, []),
                new TaskDailyLogDto(201, new DateOnly(2026, 8, 1), "First daily log", 20, [])
            ]
        });
        result.Data!.ProgressLogs.Select(log => log.LogId).Should().Equal(102, 101);
        result.Data.DailyLogs.Select(log => log.DailyLogId).Should().Equal(202, 201);
    }

    [Fact]
    public async Task UTCID02_Handle_TaskNotFound_ShouldThrowNotFoundException()
    {
        SetupTasks();
        Func<Task> act = () => _handler.Handle(new GetTaskDetailsQuery(10), CancellationToken.None);
        var exception = await act.Should().ThrowAsync<NotFoundException>();
        exception.Which.ErrorCode.Should().Be(ErrorCodes.NotFound);
    }

    private static ProjectTask TaskEntity() => new()
    {
        TaskId = 10,
        PhaseId = 2,
        ParentTaskId = 5,
        Name = "Foundation",
        Description = "Build the foundation",
        StartDate = new DateOnly(2026, 8, 1),
        EndDate = new DateOnly(2026, 8, 31),
        Status = BPG.Domain.Constants.TaskStatus.InProgress,
        ProgressPercent = 40,
        Phase = new Phase { PhaseId = 2, ProjectId = 3 },
        Assignees = new List<TaskAssignee>
        {
            new() { TaskId = 10, UserId = 8, User = new User { UserId = 8, FullName = "Engineer", Email = "engineer@test.local" } }
        },
        ProgressLogs = new List<TaskProgressLog>
        {
            new()
            {
                TaskProgressLogId = 101,
                OldProgress = 0,
                NewProgress = 20,
                UpdateReason = "First update",
                CreatedAt = new DateTime(2026, 8, 1, 9, 0, 0, DateTimeKind.Utc),
                CreatedBy = 8
            },
            new()
            {
                TaskProgressLogId = 102,
                OldProgress = 20,
                NewProgress = 40,
                UpdateReason = "Second update",
                CreatedAt = new DateTime(2026, 8, 2, 9, 0, 0, DateTimeKind.Utc),
                CreatedBy = 8
            }
        },
        DailyLogs = new List<DailyLog>
        {
            new() { LogId = 201, LogDate = new DateOnly(2026, 8, 1), Description = "First daily log", NewProgressPercent = 20 },
            new() { LogId = 202, LogDate = new DateOnly(2026, 8, 2), Description = "Second daily log", NewProgressPercent = 40 }
        }
    };

    private void SetupTasks(params ProjectTask[] tasks) => _taskRepo.Setup(x => x.Query()).Returns(tasks.AsQueryable().BuildMock());
}
