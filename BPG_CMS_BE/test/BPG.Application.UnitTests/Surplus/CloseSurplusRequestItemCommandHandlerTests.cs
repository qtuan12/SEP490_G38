using BPG.Application.Common.Models;
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
using RoleConstants = BPG.Domain.Constants.UserRole;

namespace BPG.Application.UnitTests.Surplus
{
    public class CloseSurplusRequestItemCommandHandlerTests
    {
        private const long CurrentUserId = 10;
        private const long ProjectId = 5;
        private const long SurplusRequestId = 100;
        private const long SurplusRequestItemId = 200;

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<ICurrentUserService> _mockCurrentUserService;
        private readonly Mock<IGenericRepository<SurplusRequestItem>> _mockRequestItemRepo;
        private readonly Mock<IGenericRepository<SurplusTransfer>> _mockTransferRepo;
        private readonly Mock<IGenericRepository<SurplusRequest>> _mockRequestRepo;
        private readonly CloseSurplusRequestItemCommandHandler _handler;

        public CloseSurplusRequestItemCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockCurrentUserService = new Mock<ICurrentUserService>();
            _mockRequestItemRepo = new Mock<IGenericRepository<SurplusRequestItem>>();
            _mockTransferRepo = new Mock<IGenericRepository<SurplusTransfer>>();
            _mockRequestRepo = new Mock<IGenericRepository<SurplusRequest>>();

            _mockUow.Setup(u => u.Repository<SurplusRequestItem>()).Returns(_mockRequestItemRepo.Object);
            _mockUow.Setup(u => u.Repository<SurplusTransfer>()).Returns(_mockTransferRepo.Object);
            _mockUow.Setup(u => u.Repository<SurplusRequest>()).Returns(_mockRequestRepo.Object);
            _mockUow.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

            SetupRequestItems(DefaultItem());
            SetupTransfers();

            _handler = new CloseSurplusRequestItemCommandHandler(
                _mockUow.Object,
                _mockCurrentUserService.Object);
        }

        [Fact]
        public async Task UTCID01_Handle_ValidRequest_ShouldReturnSuccess()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.SiteEngineer);
            var item = DefaultItem();
            SetupRequestItems(item);

            var result = await _handler.Handle(Command(), CancellationToken.None);

            result.Success.Should().BeTrue();
            item.Status.Should().Be(SurplusRequestItemStatus.Cancelled);
            item.CloseReason.Should().Be("Không thể xử lý tiếp");
        }

        [Fact]
        public async Task UTCID02_Handle_ReasonTooShort_ShouldThrowBusinessException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.SiteEngineer);

            var act = async () => await _handler.Handle(Command(reason: "Quá ngắn"), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("VAL_001");
        }

        [Fact]
        public async Task UTCID03_Handle_ItemNotFound_ShouldThrowNotFoundException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.SiteEngineer);
            SetupRequestItems();

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<NotFoundException>();
            exception.Which.ErrorCode.Should().Be("BIZ_001");
        }

        [Fact]
        public async Task UTCID04_Handle_BatchAlreadyProcessed_ShouldThrowBusinessException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.SiteEngineer);
            SetupRequestItems(DefaultItem(batchStatus: SurplusRequestStatus.Processed));

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("BIZ_005");
        }

        [Fact]
        public async Task UTCID05_Handle_ItemAlreadyClosed_ShouldThrowBusinessException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.SiteEngineer);
            SetupRequestItems(DefaultItem(itemStatus: SurplusRequestItemStatus.Cancelled));

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("BIZ_005");
        }

        [Fact]
        public async Task UTCID06_Handle_ActiveTransferExists_ShouldThrowBusinessException()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.SiteEngineer);
            SetupTransfers(new SurplusTransfer { SurplusRequestItemId = SurplusRequestItemId, Status = SurplusTransferStatus.Pending });

            var act = async () => await _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be("BIZ_005");
        }

        [Fact]
        public async Task UTCID07_Handle_AllOtherItemsDone_ShouldUpdateBatchStatusToProcessed()
        {
            _mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.SiteEngineer);
            var itemToClose = DefaultItem();
            var otherItem = DefaultItem(itemId: 201, itemStatus: SurplusRequestItemStatus.Completed);
            SetupRequestItems(itemToClose, otherItem);

            await _handler.Handle(Command(), CancellationToken.None);

            itemToClose.SurplusRequest.Status.Should().Be(SurplusRequestStatus.Processed);
            _mockRequestRepo.Verify(r => r.Update(It.IsAny<SurplusRequest>()), Times.Once);
        }

        // ==================== Factory Methods ====================

        private static CloseSurplusRequestItemCommand Command(long itemId = SurplusRequestItemId, string reason = "Không thể xử lý tiếp")
            => new(itemId, reason);

        private static SurplusRequestItem DefaultItem(
            long itemId = SurplusRequestItemId,
            string batchStatus = SurplusRequestStatus.Processing,
            string itemStatus = SurplusRequestItemStatus.Processing)
            => new()
            {
                SurplusRequestItemId = itemId,
                SurplusRequestId = SurplusRequestId,
                Status = itemStatus,
                SurplusRequest = new SurplusRequest
                {
                    SurplusRequestId = SurplusRequestId,
                    ProjectId = ProjectId,
                    Status = batchStatus
                }
            };

        // ==================== Setup Methods ====================

        private void SetupRequestItems(params SurplusRequestItem[] items)
        {
            _mockRequestItemRepo.Setup(r => r.Query()).Returns(items.AsQueryable().BuildMock());
        }

        private void SetupTransfers(params SurplusTransfer[] transfers)
        {
            _mockTransferRepo.Setup(r => r.Query()).Returns(transfers.AsQueryable().BuildMock());
        }
    }
}
