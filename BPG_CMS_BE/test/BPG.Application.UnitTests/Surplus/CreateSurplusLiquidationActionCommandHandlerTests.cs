using BPG.Application.Features.Surplus.Commands;
using BPG.Application.Features.Surplus.Handlers;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Application.UnitTests.Helpers;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using MockQueryable;
using Moq;

namespace BPG.Application.UnitTests.Surplus;

public class CreateSurplusLiquidationActionCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IGenericRepository<SurplusRequestItem>> _itemRepo = new();
    private readonly Mock<IGenericRepository<SurplusTransfer>> _transferRepo = new();
    private readonly Mock<IGenericRepository<CurrentInventory>> _inventoryRepo = new();
    private readonly Mock<IGenericRepository<SurplusLiquidation>> _liquidationRepo = new();
    private readonly Mock<IGenericRepository<SurplusRequest>> _requestRepo = new();
    private readonly Mock<IGenericRepository<ProjectMember>> _memberRepo = new();
    private readonly CreateSurplusLiquidationActionCommandHandler _handler;

    public CreateSurplusLiquidationActionCommandHandlerTests()
    {
        _uow.Setup(x => x.Repository<SurplusRequestItem>()).Returns(_itemRepo.Object);
        _uow.Setup(x => x.Repository<SurplusTransfer>()).Returns(_transferRepo.Object);
        _uow.Setup(x => x.Repository<CurrentInventory>()).Returns(_inventoryRepo.Object);
        _uow.Setup(x => x.Repository<SurplusLiquidation>()).Returns(_liquidationRepo.Object);
        _uow.Setup(x => x.Repository<SurplusRequest>()).Returns(_requestRepo.Object);
        _uow.Setup(x => x.Repository<ProjectMember>()).Returns(_memberRepo.Object);
        _uow.Setup(x => x.BeginTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        _uow.Setup(x => x.CommitTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        _uow.Setup(x => x.RollbackTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        _uow.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        _liquidationRepo.Setup(x => x.AddAsync(It.IsAny<SurplusLiquidation>(), It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        SetupItems(Item());
        SetupTransfers();
        SetupInventory(new CurrentInventory { ProjectId = 3, MaterialId = 4, Quantity = 20 });
        _memberRepo.Setup(x => x.Query()).Returns(Array.Empty<ProjectMember>().AsQueryable().BuildMock());

        _handler = new CreateSurplusLiquidationActionCommandHandler(
            _uow.Object,
            ServiceStubFactory.CurrentUserService(),
            ServiceStubFactory.InventoryService(),
            Mock.Of<IFileStorageService>(),
            ServiceStubFactory.NotificationService());
    }

    [Fact]
    public async Task UTCID01_Handle_ValidLiquidation_ShouldReturnSuccess()
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
    public async Task UTCID03_Handle_ProcessedBatch_ShouldThrowAlreadyApproved()
    {
        SetupItems(Item(batchStatus: SurplusRequestStatus.Processed));
        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);
        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be(ErrorCodes.AlreadyApproved);
    }

    [Fact]
    public async Task UTCID04_Handle_QuantityExceedsUncommitted_ShouldThrowInsufficientStock()
    {
        Func<Task> act = () => _handler.Handle(Command(quantity: 21), CancellationToken.None);
        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be(ErrorCodes.InsufficientStock);
    }

    [Fact]
    public async Task UTCID05_Handle_DiscreteFractionalQuantity_ShouldThrowInvalidUnitQuantity()
    {
        SetupItems(Item(isDiscrete: true));
        Func<Task> act = () => _handler.Handle(Command(quantity: 1.5m), CancellationToken.None);
        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be(ErrorCodes.InvalidUnitQuantity);
    }

    private static CreateSurplusLiquidationActionCommand Command(decimal quantity = 5) => new(1, "Buyer", quantity, 1000, null);
    private static SurplusRequestItem Item(string batchStatus = SurplusRequestStatus.Processing, bool isDiscrete = false) => new()
    {
        SurplusRequestItemId = 1,
        SurplusRequestId = 2,
        MaterialId = 4,
        Quantity = 20,
        Status = SurplusRequestItemStatus.Pending,
        Unit = new Unit { IsDiscrete = isDiscrete, UnitName = "Unit" },
        SurplusRequest = new SurplusRequest
        {
            SurplusRequestId = 2,
            ProjectId = 3,
            Status = batchStatus,
            Project = new Project { ProjectId = 3, Name = "Project", Status = ProjectStatus.InProgress }
        }
    };
    private void SetupItems(params SurplusRequestItem[] items) => _itemRepo.Setup(x => x.Query()).Returns(items.AsQueryable().BuildMock());
    private void SetupTransfers(params SurplusTransfer[] items) => _transferRepo.Setup(x => x.Query()).Returns(items.AsQueryable().BuildMock());
    private void SetupInventory(params CurrentInventory[] items) => _inventoryRepo.Setup(x => x.Query()).Returns(items.AsQueryable().BuildMock());
}
