using BPG.Application.Features.Surplus.Commands;
using BPG.Application.Features.Surplus.Handlers;
using BPG.Application.IRepositories;
using BPG.Application.UnitTests.Helpers;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using MockQueryable;
using Moq;

namespace BPG.Application.UnitTests.Surplus;

public class CreateSurplusTransferActionCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IGenericRepository<SurplusRequestItem>> _itemRepo = new();
    private readonly Mock<IGenericRepository<Project>> _projectRepo = new();
    private readonly Mock<IGenericRepository<SurplusTransfer>> _transferRepo = new();
    private readonly Mock<IGenericRepository<CurrentInventory>> _inventoryRepo = new();
    private readonly Mock<IGenericRepository<ProjectMember>> _memberRepo = new();
    private readonly CreateSurplusTransferActionCommandHandler _handler;

    public CreateSurplusTransferActionCommandHandlerTests()
    {
        _uow.Setup(x => x.Repository<SurplusRequestItem>()).Returns(_itemRepo.Object);
        _uow.Setup(x => x.Repository<Project>()).Returns(_projectRepo.Object);
        _uow.Setup(x => x.Repository<SurplusTransfer>()).Returns(_transferRepo.Object);
        _uow.Setup(x => x.Repository<CurrentInventory>()).Returns(_inventoryRepo.Object);
        _uow.Setup(x => x.Repository<ProjectMember>()).Returns(_memberRepo.Object);
        _uow.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        _transferRepo.Setup(x => x.AddAsync(It.IsAny<SurplusTransfer>(), It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        SetupItems(Item());
        SetupProjects(new Project { ProjectId = 4, Name = "Target", Status = ProjectStatus.InProgress });
        SetupTransfers();
        SetupInventory(new CurrentInventory { ProjectId = 3, MaterialId = 5, Quantity = 20 });
        _memberRepo.Setup(x => x.Query()).Returns(Array.Empty<ProjectMember>().AsQueryable().BuildMock());
        _handler = new CreateSurplusTransferActionCommandHandler(_uow.Object, ServiceStubFactory.CurrentUserService(), ServiceStubFactory.NotificationService());
    }

    [Fact]
    public async Task UTCID01_Handle_ValidTransfer_ShouldReturnSuccess()
    {
        var result = await _handler.Handle(Command(), CancellationToken.None);
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task UTCID02_Handle_ItemNotFound_ShouldThrowNotFoundException()
    {
        SetupItems();
        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);
        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task UTCID03_Handle_TargetSameAsSource_ShouldThrowInvalidTransition()
    {
        Func<Task> act = () => _handler.Handle(new CreateSurplusTransferActionCommand(1, 3, 5), CancellationToken.None);
        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be(ErrorCodes.InvalidTransition);
    }

    [Fact]
    public async Task UTCID04_Handle_InsufficientAvailableInventory_ShouldThrowInsufficientStock()
    {
        SetupInventory(new CurrentInventory { ProjectId = 3, MaterialId = 5, Quantity = 3 });
        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);
        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be(ErrorCodes.InsufficientStock);
    }

    private static CreateSurplusTransferActionCommand Command() => new(1, 4, 5);
    private static SurplusRequestItem Item() => new()
    {
        SurplusRequestItemId = 1,
        SurplusRequestId = 2,
        MaterialId = 5,
        Quantity = 20,
        ConversionRate = 1,
        Unit = new Unit(),
        SurplusRequest = new SurplusRequest
        {
            SurplusRequestId = 2,
            ProjectId = 3,
            Status = SurplusRequestStatus.Processing,
            Project = new Project { ProjectId = 3, Name = "Source", Status = ProjectStatus.InProgress }
        }
    };
    private void SetupItems(params SurplusRequestItem[] items) => _itemRepo.Setup(x => x.Query()).Returns(items.AsQueryable().BuildMock());
    private void SetupProjects(params Project[] items) => _projectRepo.Setup(x => x.Query()).Returns(items.AsQueryable().BuildMock());
    private void SetupTransfers(params SurplusTransfer[] items) => _transferRepo.Setup(x => x.Query()).Returns(items.AsQueryable().BuildMock());
    private void SetupInventory(params CurrentInventory[] items) => _inventoryRepo.Setup(x => x.Query()).Returns(items.AsQueryable().BuildMock());
}
