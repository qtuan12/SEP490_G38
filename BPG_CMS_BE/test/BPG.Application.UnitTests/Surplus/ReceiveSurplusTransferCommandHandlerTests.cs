using BPG.Application.Features.Surplus.Commands;
using BPG.Application.Features.Surplus.Handlers;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Application.UnitTests.Helpers;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using MockQueryable;
using Moq;

namespace BPG.Application.UnitTests.Surplus;

public class ReceiveSurplusTransferCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IGenericRepository<SurplusTransfer>> _transferRepo = new();
    private readonly Mock<IGenericRepository<SurplusRequestItem>> _itemRepo = new();
    private readonly Mock<IGenericRepository<SurplusRequest>> _requestRepo = new();
    private readonly Mock<IGenericRepository<CurrentInventory>> _inventoryRepo = new();
    private readonly Mock<IGenericRepository<Attachment>> _attachmentRepo = new();
    private readonly Mock<IFileStorageService> _fileStorage = new();
    private readonly ReceiveSurplusTransferCommandHandler _handler;

    public ReceiveSurplusTransferCommandHandlerTests()
    {
        _uow.Setup(x => x.Repository<SurplusTransfer>()).Returns(_transferRepo.Object);
        _uow.Setup(x => x.Repository<SurplusRequestItem>()).Returns(_itemRepo.Object);
        _uow.Setup(x => x.Repository<SurplusRequest>()).Returns(_requestRepo.Object);
        _uow.Setup(x => x.Repository<CurrentInventory>()).Returns(_inventoryRepo.Object);
        _uow.Setup(x => x.Repository<Attachment>()).Returns(_attachmentRepo.Object);
        _uow.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        _attachmentRepo.Setup(x => x.AddAsync(It.IsAny<Attachment>(), It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        _fileStorage.Setup(x => x.UploadFileAsync(It.IsAny<IFormFile>(), It.IsAny<string>(), It.IsAny<CancellationToken>())).ReturnsAsync("receipt.jpg");
        var transfer = Transfer();
        SetupTransfers(transfer);
        _itemRepo.Setup(x => x.Query()).Returns(new[] { transfer.SurplusRequestItem }.AsQueryable().BuildMock());
        _handler = new ReceiveSurplusTransferCommandHandler(
            _uow.Object,
            ServiceStubFactory.CurrentUserService(),
            ServiceStubFactory.InventoryService(),
            ServiceStubFactory.NotificationService(),
            _fileStorage.Object);
    }

    [Fact]
    public async Task UTCID01_Handle_DispatchedTransferWithEvidence_ShouldReturnSuccess()
    {
        var result = await _handler.Handle(new ReceiveSurplusTransferCommand(1, new List<IFormFile> { File() }), CancellationToken.None);
        result.Success.Should().BeTrue();
        result.Message.Should().Be(ResponseMessages.UpdateSuccess);
    }

    [Fact]
    public async Task UTCID02_Handle_MissingEvidence_ShouldThrowValidationFailed()
    {
        Func<Task> act = () => _handler.Handle(new ReceiveSurplusTransferCommand(1, null), CancellationToken.None);
        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be(ErrorCodes.ValidationFailed);
    }

    [Fact]
    public async Task UTCID03_Handle_TransferNotDispatched_ShouldThrowStatusTransitionException()
    {
        SetupTransfers(Transfer(SurplusTransferStatus.Approved));
        Func<Task> act = () => _handler.Handle(new ReceiveSurplusTransferCommand(1, new List<IFormFile> { File() }), CancellationToken.None);
        await act.Should().ThrowAsync<InvalidStatusTransitionException>();
    }

    [Fact]
    public async Task UTCID04_Handle_TransferNotFound_ShouldThrowNotFoundException()
    {
        SetupTransfers();

        Func<Task> act = () => _handler.Handle(
            new ReceiveSurplusTransferCommand(1, new List<IFormFile> { File() }),
            CancellationToken.None);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task UTCID05_Handle_ProjectInactive_ShouldThrowInvalidTransition()
    {
        var transfer = Transfer();
        transfer.ToProject.Status = ProjectStatus.Completed;
        SetupTransfers(transfer);

        Func<Task> act = () => _handler.Handle(
            new ReceiveSurplusTransferCommand(1, new List<IFormFile> { File() }),
            CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be(ErrorCodes.InvalidTransition);
    }

    private static SurplusTransfer Transfer(string status = SurplusTransferStatus.Dispatched)
    {
        var request = new SurplusRequest { SurplusRequestId = 6, ProjectId = 3, Status = SurplusRequestStatus.Processing };
        var item = new SurplusRequestItem
        {
            SurplusRequestItemId = 2,
            SurplusRequestId = 6,
            MaterialId = 5,
            Quantity = 20,
            ConversionRate = 1,
            SurplusRequest = request
        };
        return new SurplusTransfer
        {
            SurplusTransferId = 1,
            FromProjectId = 3,
            ToProjectId = 4,
            TransferQuantity = 5,
            Status = status,
            FromProject = new Project { ProjectId = 3, Status = ProjectStatus.InProgress },
            ToProject = new Project { ProjectId = 4, Status = ProjectStatus.InProgress },
            SurplusRequestItem = item
        };
    }
    private static IFormFile File()
    {
        var file = new Mock<IFormFile>();
        file.SetupGet(x => x.FileName).Returns("receipt.jpg");
        file.SetupGet(x => x.ContentType).Returns("image/jpeg");
        file.SetupGet(x => x.Length).Returns(10);
        return file.Object;
    }
    private void SetupTransfers(params SurplusTransfer[] items) => _transferRepo.Setup(x => x.Query()).Returns(items.AsQueryable().BuildMock());
}
