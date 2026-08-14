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

public class ReviewSurplusTransferCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IGenericRepository<SurplusTransfer>> _transferRepo = new();
    private readonly Mock<IGenericRepository<SurplusRequestItem>> _itemRepo = new();
    private readonly Mock<IGenericRepository<CurrentInventory>> _inventoryRepo = new();
    private readonly Mock<IGenericRepository<ProjectMember>> _memberRepo = new();
    private readonly ReviewSurplusTransferCommandHandler _handler;

    public ReviewSurplusTransferCommandHandlerTests()
    {
        _uow.Setup(x => x.Repository<SurplusTransfer>()).Returns(_transferRepo.Object);
        _uow.Setup(x => x.Repository<SurplusRequestItem>()).Returns(_itemRepo.Object);
        _uow.Setup(x => x.Repository<CurrentInventory>()).Returns(_inventoryRepo.Object);
        _uow.Setup(x => x.Repository<ProjectMember>()).Returns(_memberRepo.Object);
        _uow.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        SetupTransfers(Transfer());
        _inventoryRepo.Setup(x => x.Query()).Returns(new[] { new CurrentInventory { ProjectId = 3, MaterialId = 5, ReservedQuantity = 5 } }.AsQueryable().BuildMock());
        _memberRepo.Setup(x => x.Query()).Returns(Array.Empty<ProjectMember>().AsQueryable().BuildMock());
        _handler = new ReviewSurplusTransferCommandHandler(_uow.Object, ServiceStubFactory.CurrentUserService(), ServiceStubFactory.NotificationService());
    }

    [Fact]
    public async Task UTCID01_Handle_PendingTransferApproved_ShouldReturnSuccess()
    {
        var result = await _handler.Handle(new ReviewSurplusTransferCommand(1, true), CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Message.Should().Be(ResponseMessages.ApproveSuccess);
    }

    [Fact]
    public async Task UTCID02_Handle_PendingTransferRejected_ShouldReturnSuccess()
    {
        var result = await _handler.Handle(new ReviewSurplusTransferCommand(1, false), CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Message.Should().Be(ResponseMessages.RejectSuccess);
    }

    [Fact]
    public async Task UTCID03_Handle_TransferNotFound_ShouldThrowNotFoundException()
    {
        SetupTransfers();
        Func<Task> act = () => _handler.Handle(new ReviewSurplusTransferCommand(1, true), CancellationToken.None);
        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task UTCID04_Handle_TransferNotPending_ShouldThrowStatusTransitionException()
    {
        SetupTransfers(Transfer(SurplusTransferStatus.Approved));
        Func<Task> act = () => _handler.Handle(new ReviewSurplusTransferCommand(1, true), CancellationToken.None);
        await act.Should().ThrowAsync<InvalidStatusTransitionException>();
    }

    [Fact]
    public async Task UTCID05_Handle_ProjectInactive_ShouldThrowInvalidTransition()
    {
        var transfer = Transfer();
        transfer.ToProject.Status = ProjectStatus.Completed;
        SetupTransfers(transfer);

        Func<Task> act = () => _handler.Handle(new ReviewSurplusTransferCommand(1, true), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be(ErrorCodes.InvalidTransition);
    }

    private static SurplusTransfer Transfer(string status = SurplusTransferStatus.Pending) => new()
    {
        SurplusTransferId = 1,
        FromProjectId = 3,
        ToProjectId = 4,
        TransferQuantity = 5,
        Status = status,
        FromProject = new Project { ProjectId = 3, Name = "Source", Status = ProjectStatus.InProgress },
        ToProject = new Project { ProjectId = 4, Name = "Target", Status = ProjectStatus.InProgress },
        SurplusRequestItem = new SurplusRequestItem { SurplusRequestItemId = 2, SurplusRequestId = 6, MaterialId = 5, ConversionRate = 1 }
    };
    private void SetupTransfers(params SurplusTransfer[] items) => _transferRepo.Setup(x => x.Query()).Returns(items.AsQueryable().BuildMock());
}
