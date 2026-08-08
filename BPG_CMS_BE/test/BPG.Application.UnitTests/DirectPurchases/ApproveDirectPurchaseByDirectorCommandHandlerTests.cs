using BPG.Application.Features.DirectPurchases.Commands;
using BPG.Application.Features.DirectPurchases.Handlers;
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

namespace BPG.Application.UnitTests.DirectPurchases
{
    public class ApproveDirectPurchaseByDirectorCommandHandlerTests
    {
        private const long CurrentUserId = 10;
        private const long RequesterId = 11;
        private const long ProjectId = 100;
        private const long PhaseId = 10;
        private const long DpId = 700;

        private readonly Mock<IUnitOfWork> _mockUow;
        private readonly Mock<IGenericRepository<DirectPurchaseRequest>> _mockDpRepo;
        private readonly Mock<IGenericRepository<User>> _mockUserRepo;
        private readonly ApproveDirectPurchaseByDirectorCommandHandler _handler;

        public ApproveDirectPurchaseByDirectorCommandHandlerTests()
        {
            _mockUow = new Mock<IUnitOfWork>();
            _mockDpRepo = new Mock<IGenericRepository<DirectPurchaseRequest>>();
            _mockUserRepo = new Mock<IGenericRepository<User>>();

            _mockUow.Setup(u => u.Repository<DirectPurchaseRequest>()).Returns(_mockDpRepo.Object);
            _mockUow.Setup(u => u.Repository<User>()).Returns(_mockUserRepo.Object);
            _mockUow.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

            _mockUserRepo.Setup(r => r.GetByIdAsync(CurrentUserId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new User { UserId = CurrentUserId, FullName = "Trần Giám Đốc" });

            var mockCurrentUserService = new Mock<ICurrentUserService>();
            mockCurrentUserService.SetupUser(CurrentUserId, RoleConstants.Director);

            SetupDirectPurchases(Request(DirectPurchaseStatus.WaitingApproval));

            _handler = new ApproveDirectPurchaseByDirectorCommandHandler(
                _mockUow.Object,
                mockCurrentUserService.Object,
                ServiceStubFactory.RealtimeSender(),
                ServiceStubFactory.NotificationService());
        }

        [Fact]
        public async Task UTCID01_Handle_RequestWaitingForDirector_ShouldReturnTrue()
        {
            var result = await _handler.Handle(Command(), CancellationToken.None);

            result.Should().BeTrue();
        }

        [Fact]
        public async Task UTCID02_Handle_DirectPurchaseNotFound_ShouldThrowNotFoundException()
        {
            SetupDirectPurchases();

            Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<NotFoundException>();
            exception.Which.ErrorCode.Should().Be("BIZ_001");
        }

        [Fact]
        public async Task UTCID03_Handle_SoftDeletedRequest_ShouldThrowNotFoundException()
        {
            var dp = Request(DirectPurchaseStatus.WaitingApproval);
            dp.IsDeleted = true;
            SetupDirectPurchases(dp);

            Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<NotFoundException>();
            exception.Which.ErrorCode.Should().Be("BIZ_001");
        }

        [Theory]
        [InlineData(DirectPurchaseStatus.Draft)]
        [InlineData(DirectPurchaseStatus.Pending)]
        [InlineData(DirectPurchaseStatus.Approved)]
        [InlineData(DirectPurchaseStatus.Rejected)]
        public async Task UTCID04_Handle_RequestNotWaitingForDirector_ShouldThrowBusinessException(string status)
        {
            SetupDirectPurchases(Request(status));

            Func<Task> act = () => _handler.Handle(Command(), CancellationToken.None);

            var exception = await act.Should().ThrowAsync<BusinessException>();
            exception.Which.ErrorCode.Should().Be(ErrorCodes.DpInvalidStatusForApproval);
        }

        [Fact]
        public async Task UTCID05_Handle_ApprovalNoteIsNull_ShouldReturnTrue()
        {
            var result = await _handler.Handle(Command(approvalNote: null), CancellationToken.None);

            result.Should().BeTrue();
        }

        private static ApproveDirectPurchaseByDirectorCommand Command(
            long directPurchaseId = DpId,
            string? approvalNote = "Đồng ý hoàn tiền theo hóa đơn đính kèm.")
            => new() { DirectPurchaseId = directPurchaseId, ApprovalNote = approvalNote };

        private static DirectPurchaseRequest Request(string status)
            => new()
            {
                DirectPurchaseId = DpId,
                ProjectId = ProjectId,
                PhaseId = PhaseId,
                RequestedBy = RequesterId,
                Status = status,
                AuditStatus = DirectPurchaseAuditStatus.Audited,
                BOQCheckStatus = BOQCheckStatus.WithinBOQ,
                TotalAmount = 15_000_000m,
                Phase = new Phase { PhaseId = PhaseId, ProjectId = ProjectId, Name = "Phần thô" },
                Project = new Project { ProjectId = ProjectId, Name = "Nhà máy Bắc Ninh" }
            };

        private void SetupDirectPurchases(params DirectPurchaseRequest[] requests)
            => _mockDpRepo.Setup(r => r.Query()).Returns(requests.AsQueryable().BuildMock());
    }
}
