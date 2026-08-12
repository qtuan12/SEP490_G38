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

public class CreateSurplusReturnActionCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IGenericRepository<SurplusRequestItem>> _itemRepo = new();
    private readonly Mock<IGenericRepository<SurplusTransfer>> _transferRepo = new();
    private readonly Mock<IGenericRepository<CurrentInventory>> _inventoryRepo = new();
    private readonly Mock<IGenericRepository<SurplusReturnSupplier>> _returnRepo = new();
    private readonly Mock<IGenericRepository<SurplusRequest>> _requestRepo = new();
    private readonly Mock<IGenericRepository<ProjectMember>> _memberRepo = new();
    private readonly Mock<ISurplusMaterialSupplierService> _supplierService = new();
    private readonly CreateSurplusReturnActionCommandHandler _handler;

    public CreateSurplusReturnActionCommandHandlerTests()
    {
        _uow.Setup(x => x.Repository<SurplusRequestItem>()).Returns(_itemRepo.Object);
        _uow.Setup(x => x.Repository<SurplusTransfer>()).Returns(_transferRepo.Object);
        _uow.Setup(x => x.Repository<CurrentInventory>()).Returns(_inventoryRepo.Object);
        _uow.Setup(x => x.Repository<SurplusReturnSupplier>()).Returns(_returnRepo.Object);
        _uow.Setup(x => x.Repository<SurplusRequest>()).Returns(_requestRepo.Object);
        _uow.Setup(x => x.Repository<ProjectMember>()).Returns(_memberRepo.Object);
        _uow.Setup(x => x.BeginTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        _uow.Setup(x => x.CommitTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        _uow.Setup(x => x.RollbackTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        _uow.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        _returnRepo.Setup(x => x.AddAsync(It.IsAny<SurplusReturnSupplier>(), It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        SetupItems(Item());
        SetupTransfers();
        SetupInventory(new CurrentInventory { ProjectId = 3, MaterialId = 4, Quantity = 20 });
        _memberRepo.Setup(x => x.Query()).Returns(Array.Empty<ProjectMember>().AsQueryable().BuildMock());
        _supplierService.Setup(x => x.GetApprovedSuppliersAsync(3, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<SurplusMaterialSupplier> { new(8, "Supplier") });

        _handler = new CreateSurplusReturnActionCommandHandler(
            _uow.Object,
            ServiceStubFactory.CurrentUserService(),
            ServiceStubFactory.InventoryService(),
            Mock.Of<IFileStorageService>(),
            ServiceStubFactory.NotificationService(),
            _supplierService.Object);
    }

    [Fact]
    public async Task UTCID01_Handle_ValidReturn_ShouldReturnSuccess()
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
    public async Task UTCID03_Handle_SupplierNotApprovedForProject_ShouldThrowNotFoundBusinessException()
    {
        _supplierService.Setup(x => x.GetApprovedSuppliersAsync(3, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Array.Empty<SurplusMaterialSupplier>());
        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);
        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be(ErrorCodes.NotFound);
    }

    [Fact]
    public async Task UTCID04_Handle_QuantityExceedsInventory_ShouldThrowInsufficientStock()
    {
        SetupInventory(new CurrentInventory { ProjectId = 3, MaterialId = 4, Quantity = 2 });
        Func<Task> act = () => _handler.Handle(Command(quantity: 5), CancellationToken.None);
        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be(ErrorCodes.InsufficientStock);
    }

    private static CreateSurplusReturnActionCommand Command(decimal quantity = 5) => new(1, 8, quantity, 100, "Return", null);
    private static SurplusRequestItem Item() => new()
    {
        SurplusRequestItemId = 1,
        SurplusRequestId = 2,
        MaterialId = 4,
        Quantity = 20,
        Status = SurplusRequestItemStatus.Pending,
        Unit = new Unit(),
        SurplusRequest = new SurplusRequest
        {
            SurplusRequestId = 2,
            ProjectId = 3,
            Status = SurplusRequestStatus.Processing,
            Project = new Project { ProjectId = 3, Name = "Project", Status = ProjectStatus.InProgress }
        }
    };
    private void SetupItems(params SurplusRequestItem[] items) => _itemRepo.Setup(x => x.Query()).Returns(items.AsQueryable().BuildMock());
    private void SetupTransfers(params SurplusTransfer[] items) => _transferRepo.Setup(x => x.Query()).Returns(items.AsQueryable().BuildMock());
    private void SetupInventory(params CurrentInventory[] items) => _inventoryRepo.Setup(x => x.Query()).Returns(items.AsQueryable().BuildMock());
}
