using BPG.Application.Features.Tasks.Queries.GetTaskDetails;
using BPG.Application.IRepositories;
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
        result.Data!.Name.Should().Be("Foundation");
        result.Data.Assignees.Should().ContainSingle(x => x.FullName == "Engineer");
    }

    [Fact]
    public async Task UTCID02_Handle_TaskNotFound_ShouldThrowNotFoundException()
    {
        SetupTasks();
        Func<Task> act = () => _handler.Handle(new GetTaskDetailsQuery(10), CancellationToken.None);
        await act.Should().ThrowAsync<NotFoundException>();
    }

    private static ProjectTask TaskEntity() => new()
    {
        TaskId = 10,
        PhaseId = 2,
        Name = "Foundation",
        Phase = new Phase { PhaseId = 2, ProjectId = 3 },
        Assignees = new List<TaskAssignee>
        {
            new() { TaskId = 10, UserId = 8, User = new User { UserId = 8, FullName = "Engineer", Email = "engineer@test.local" } }
        },
        ProgressLogs = new List<TaskProgressLog>(),
        DailyLogs = new List<DailyLog>()
    };

    private void SetupTasks(params ProjectTask[] tasks) => _taskRepo.Setup(x => x.Query()).Returns(tasks.AsQueryable().BuildMock());
}
