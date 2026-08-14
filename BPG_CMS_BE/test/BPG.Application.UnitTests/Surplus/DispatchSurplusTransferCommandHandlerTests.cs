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

public class DispatchSurplusTransferCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IGenericRepository<SurplusTransfer>> _transferRepo = new();
    private readonly Mock<IGenericRepository<Attachment>> _attachmentRepo = new();
    private readonly Mock<IGenericRepository<ProjectMember>> _memberRepo = new();
    private readonly Mock<IFileStorageService> _fileStorage = new();
    private readonly DispatchSurplusTransferCommandHandler _handler;

    public DispatchSurplusTransferCommandHandlerTests()
    {
        _uow.Setup(x => x.Repository<SurplusTransfer>()).Returns(_transferRepo.Object);
        _uow.Setup(x => x.Repository<Attachment>()).Returns(_attachmentRepo.Object);
        _uow.Setup(x => x.Repository<ProjectMember>()).Returns(_memberRepo.Object);
        _uow.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        _attachmentRepo.Setup(x => x.AddAsync(It.IsAny<Attachment>(), It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        _fileStorage.Setup(x => x.UploadFileAsync(It.IsAny<IFormFile>(), It.IsAny<string>(), It.IsAny<CancellationToken>())).ReturnsAsync("evidence.jpg");
        SetupTransfers(Transfer());
        _memberRepo.Setup(x => x.Query()).Returns(Array.Empty<ProjectMember>().AsQueryable().BuildMock());
        _handler = new DispatchSurplusTransferCommandHandler(_uow.Object, ServiceStubFactory.CurrentUserService(), ServiceStubFactory.ProjectAccessService(), ServiceStubFactory.NotificationService(), _fileStorage.Object);
    }

    [Fact]
    public async Task UTCID01_Handle_ApprovedTransferWithEvidence_ShouldReturnSuccess()
    {
        var result = await _handler.Handle(new DispatchSurplusTransferCommand(1, new List<IFormFile> { File() }), CancellationToken.None);
        result.Success.Should().BeTrue();
        result.Message.Should().Be(ResponseMessages.UpdateSuccess);
    }

    [Fact]
    public async Task UTCID02_Handle_MissingEvidence_ShouldThrowValidationFailed()
    {
        Func<Task> act = () => _handler.Handle(new DispatchSurplusTransferCommand(1, null), CancellationToken.None);
        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be(ErrorCodes.ValidationFailed);
    }

    [Fact]
    public async Task UTCID03_Handle_TransferNotApproved_ShouldThrowStatusTransitionException()
    {
        SetupTransfers(Transfer(SurplusTransferStatus.Pending));
        Func<Task> act = () => _handler.Handle(new DispatchSurplusTransferCommand(1, new List<IFormFile> { File() }), CancellationToken.None);
        await act.Should().ThrowAsync<InvalidStatusTransitionException>();
    }

    [Fact]
    public async Task UTCID04_Handle_TransferNotFound_ShouldThrowNotFoundException()
    {
        SetupTransfers();

        Func<Task> act = () => _handler.Handle(
            new DispatchSurplusTransferCommand(1, new List<IFormFile> { File() }),
            CancellationToken.None);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task UTCID05_Handle_ProjectInactive_ShouldThrowInvalidTransition()
    {
        var transfer = Transfer();
        transfer.FromProject.Status = ProjectStatus.Completed;
        SetupTransfers(transfer);

        Func<Task> act = () => _handler.Handle(
            new DispatchSurplusTransferCommand(1, new List<IFormFile> { File() }),
            CancellationToken.None);

        var exception = await act.Should().ThrowAsync<BusinessException>();
        exception.Which.ErrorCode.Should().Be(ErrorCodes.InvalidTransition);
    }

    private static SurplusTransfer Transfer(string status = SurplusTransferStatus.Approved) => new()
    {
        SurplusTransferId = 1,
        FromProjectId = 3,
        ToProjectId = 4,
        Status = status,
        FromProject = new Project { ProjectId = 3, Status = ProjectStatus.InProgress },
        ToProject = new Project { ProjectId = 4, Status = ProjectStatus.InProgress },
        SurplusRequestItem = new SurplusRequestItem { SurplusRequestId = 6 }
    };
    private static IFormFile File()
    {
        var file = new Mock<IFormFile>();
        file.SetupGet(x => x.FileName).Returns("evidence.jpg");
        file.SetupGet(x => x.ContentType).Returns("image/jpeg");
        file.SetupGet(x => x.Length).Returns(10);
        return file.Object;
    }
    private void SetupTransfers(params SurplusTransfer[] items) => _transferRepo.Setup(x => x.Query()).Returns(items.AsQueryable().BuildMock());
}
