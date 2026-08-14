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

public class CloseSurplusRequestItemCommandHandlerTests
{
    private const long ItemId = 10;
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IGenericRepository<SurplusRequestItem>> _itemRepo = new();
    private readonly Mock<IGenericRepository<SurplusRequest>> _requestRepo = new();
    private readonly Mock<IGenericRepository<SurplusTransfer>> _transferRepo = new();
    private readonly CloseSurplusRequestItemCommandHandler _handler;

    public CloseSurplusRequestItemCommandHandlerTests()
    {
        _uow.Setup(x => x.Repository<SurplusRequestItem>()).Returns(_itemRepo.Object);
        _uow.Setup(x => x.Repository<SurplusRequest>()).Returns(_requestRepo.Object);
        _uow.Setup(x => x.Repository<SurplusTransfer>()).Returns(_transferRepo.Object);
        _uow.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        SetupItems(Item());
        SetupTransfers();
        _handler = new CloseSurplusRequestItemCommandHandler(_uow.Object, ServiceStubFactory.CurrentUserService());
    }

    [Fact]
    public async Task UTCID01_Handle_ValidItem_ShouldReturnSuccess()
    {
        var result = await _handler.Handle(Command(), CancellationToken.None);
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task UTCID02_Handle_ReasonTooShort_ShouldThrowValidationFailed()
    {
        Func<Task> act = () => _handler.Handle(new CloseSurplusRequestItemCommand(ItemId, "short"), CancellationToken.None);
        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be(ErrorCodes.ValidationFailed);
    }

    [Fact]
    public async Task UTCID03_Handle_ItemNotFound_ShouldThrowNotFoundException()
    {
        SetupItems();
        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);
        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task UTCID04_Handle_ItemAlreadyCompleted_ShouldThrowInvalidTransition()
    {
        SetupItems(Item(SurplusRequestItemStatus.Completed));
        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);
        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be(ErrorCodes.InvalidTransition);
    }

    [Fact]
    public async Task UTCID05_Handle_ActiveTransferExists_ShouldThrowInvalidTransition()
    {
        SetupTransfers(new SurplusTransfer { SurplusRequestItemId = ItemId, Status = SurplusTransferStatus.Pending });
        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);
        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be(ErrorCodes.InvalidTransition);
    }

    [Fact]
    public async Task UTCID06_Handle_ProjectInactive_ShouldThrowInvalidTransition()
    {
        var item = Item();
        item.SurplusRequest.Project.Status = ProjectStatus.Completed;
        SetupItems(item);

        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be(ErrorCodes.InvalidTransition);
    }

    [Fact]
    public async Task UTCID07_Handle_BatchProcessed_ShouldThrowInvalidTransition()
    {
        var item = Item();
        item.SurplusRequest.Status = SurplusRequestStatus.Processed;
        SetupItems(item);

        Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be(ErrorCodes.InvalidTransition);
    }

    private static CloseSurplusRequestItemCommand Command() => new(ItemId, "No longer needed at site");

    private static SurplusRequestItem Item(string status = SurplusRequestItemStatus.Pending) => new()
    {
        SurplusRequestItemId = ItemId,
        SurplusRequestId = 2,
        Status = status,
        SurplusRequest = new SurplusRequest
        {
            SurplusRequestId = 2,
            Status = SurplusRequestStatus.Processing,
            Project = new Project { ProjectId = 3, Status = ProjectStatus.InProgress }
        }
    };

    private void SetupItems(params SurplusRequestItem[] items) =>
        _itemRepo.Setup(x => x.Query()).Returns(items.AsQueryable().BuildMock());

    private void SetupTransfers(params SurplusTransfer[] transfers) =>
        _transferRepo.Setup(x => x.Query()).Returns(transfers.AsQueryable().BuildMock());
}
