using BPG.Application.Features.DirectPurchases.Commands;
using BPG.Application.Features.DirectPurchases.Handlers;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using MockQueryable;
using MockQueryable.Moq;
using Moq;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Xunit;

namespace BPG.Application.UnitTests.DirectPurchases
{
    /// <summary>
    /// Trọng tâm: Kế toán soát hóa đơn là bước CHỐT duyệt chi cho phiếu trong định mức,
    /// nhưng chỉ là bước SÀNG LỌC cho phiếu vượt định mức (còn phải trình Giám đốc).
    /// </summary>
    public class AuditDirectPurchaseCommandHandlerTests
    {
        private const long DpId = 1;
        private const long UserId = 9;

        private readonly Mock<IUnitOfWork> _mockUow = new();
        private readonly Mock<IGenericRepository<DirectPurchaseRequest>> _mockDpRepo = new();
        private readonly Mock<IGenericRepository<User>> _mockUserRepo = new();
        private readonly Mock<ICurrentUserService> _mockCurrentUser = new();
        private readonly AuditDirectPurchaseCommandHandler _handler;

        public AuditDirectPurchaseCommandHandlerTests()
        {
            _mockUow.Setup(u => u.Repository<DirectPurchaseRequest>()).Returns(_mockDpRepo.Object);
            _mockUow.Setup(u => u.Repository<User>()).Returns(_mockUserRepo.Object);
            _mockCurrentUser.Setup(c => c.GetRequiredUserId()).Returns(UserId);
            _mockUserRepo
                .Setup(r => r.GetByIdAsync(UserId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new User { UserId = UserId, FullName = "Kế toán A" });

            _handler = new AuditDirectPurchaseCommandHandler(
                _mockUow.Object,
                _mockCurrentUser.Object,
                Mock.Of<IRealtimeNotificationSender>(),
                Mock.Of<INotificationService>());
        }

        private DirectPurchaseRequest SetDp(string status, string boqCheck,
            string auditStatus = DirectPurchaseAuditStatus.PendingAudit)
        {
            var dp = new DirectPurchaseRequest
            {
                DirectPurchaseId = DpId,
                ProjectId = 100,
                PhaseId = 10,
                RequestedBy = 5,
                Status = status,
                AuditStatus = auditStatus,
                BOQCheckStatus = boqCheck,
                TotalAmount = 1_000_000m,
                Phase = new Phase { PhaseId = 10, Name = "Giai đoạn 1" },
                Project = new Project { ProjectId = 100, Name = "Dự án A" },
            };
            _mockDpRepo.Setup(r => r.Query()).Returns(new List<DirectPurchaseRequest> { dp }.AsQueryable().BuildMock());
            return dp;
        }

        private Task<string> Audit(bool approve, string? note = null) =>
            _handler.Handle(new AuditDirectPurchaseCommand
            {
                DirectPurchaseId = DpId,
                Approve = approve,
                AuditNote = note,
            }, CancellationToken.None);

        // Mua khẩn cấp luôn cần chữ ký Giám đốc, kể cả phiếu nằm trong định mức BOQ —
        // Kế toán soát hóa đơn xong chỉ trình lên, không tự chốt duyệt chi.
        [Theory]
        [InlineData(BOQCheckStatus.WithinBOQ)]
        [InlineData(BOQCheckStatus.OverBOQ)]
        public async Task Audit_Approve_ShouldEscalateToDirector(string boqCheck)
        {
            var dp = SetDp(DirectPurchaseStatus.Pending, boqCheck);

            await Audit(true);

            dp.Status.Should().Be(DirectPurchaseStatus.WaitingApproval);
            dp.AuditStatus.Should().Be(DirectPurchaseAuditStatus.Audited);
            dp.AuditedBy.Should().Be(UserId);
        }

        [Theory]
        [InlineData(BOQCheckStatus.WithinBOQ)]
        [InlineData(BOQCheckStatus.OverBOQ)]
        public async Task Audit_Reject_ShouldRejectBothAxes(string boqCheck)
        {
            var dp = SetDp(DirectPurchaseStatus.Pending, boqCheck);

            await Audit(false, "Hóa đơn không khớp số tiền");

            dp.Status.Should().Be(DirectPurchaseStatus.Rejected);
            dp.AuditStatus.Should().Be(DirectPurchaseAuditStatus.Rejected);
        }

        [Fact]
        public async Task Audit_RejectWithoutNote_ShouldThrow()
        {
            SetDp(DirectPurchaseStatus.Pending, BOQCheckStatus.WithinBOQ);

            var act = () => Audit(false, "   ");

            (await act.Should().ThrowAsync<BusinessException>())
                .Which.ErrorCode.Should().Be(ErrorCodes.DpAuditNoteRequired);
        }

        [Fact]
        public async Task Audit_DraftNotSubmitted_ShouldThrow()
        {
            SetDp(DirectPurchaseStatus.Draft, BOQCheckStatus.WithinBOQ);

            var act = () => Audit(true);

            (await act.Should().ThrowAsync<BusinessException>())
                .Which.ErrorCode.Should().Be(ErrorCodes.DpNotSubmitted);
        }

        [Fact]
        public async Task Audit_AlreadyAudited_ShouldThrow()
        {
            SetDp(DirectPurchaseStatus.Approved, BOQCheckStatus.WithinBOQ, DirectPurchaseAuditStatus.Audited);

            var act = () => Audit(true);

            (await act.Should().ThrowAsync<BusinessException>())
                .Which.ErrorCode.Should().Be(ErrorCodes.DpAlreadyAudited);
        }
    }
}
