using BPG.Application.Features.DirectPurchases.Commands;
using BPG.Application.Features.DirectPurchases.Handlers;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using FluentValidation;
using MockQueryable;
using MockQueryable.Moq;
using Moq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Threading;
using System.Threading.Tasks;
using Xunit;
using UserRole = BPG.Domain.Constants.UserRole;

namespace BPG.Application.UnitTests.DirectPurchases
{
    /// <summary>
    /// Trọng tâm: các rule chặn tại bước Gửi phiếu - ngày mua và trạng thái dự án/giai đoạn.
    /// Bước Gửi là điểm không thể quay lại (sinh PO + phiếu nhập kho + cộng tồn kho).
    /// </summary>
    public class SubmitDirectPurchaseCommandHandlerTests
    {
        private const long DpId = 1;
        private const long PhaseId = 10;
        private const long ProjectId = 100;
        private const long UserId = 7;

        private readonly Mock<IUnitOfWork> _mockUow = new();
        private readonly Mock<IGenericRepository<DirectPurchaseRequest>> _mockDpRepo = new();
        private readonly Mock<IGenericRepository<Project>> _mockProjectRepo = new();
        private readonly Mock<IGenericRepository<Attachment>> _mockAttachmentRepo = new();
        private readonly Mock<IGenericRepository<ProjectMember>> _mockMemberRepo = new();
        private readonly Mock<IGenericRepository<MaterialCatalog>> _mockMaterialRepo = new();
        private readonly Mock<IGenericRepository<Unit>> _mockUnitRepo = new();
        private readonly Mock<IGenericRepository<SystemConfig>> _mockConfigRepo = new();
        private readonly List<DirectPurchaseRequest> _dpRows = new();
        private readonly Mock<ICurrentUserService> _mockCurrentUser = new();
        private readonly Mock<IDirectPurchaseFulfillmentService> _mockFulfillment = new();
        private readonly SubmitDirectPurchaseCommandHandler _handler;

        private static DateOnly TodayVn => DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7).Date);

        public SubmitDirectPurchaseCommandHandlerTests()
        {
            _mockUow.Setup(u => u.Repository<DirectPurchaseRequest>()).Returns(_mockDpRepo.Object);
            _mockUow.Setup(u => u.Repository<Project>()).Returns(_mockProjectRepo.Object);
            _mockUow.Setup(u => u.Repository<Attachment>()).Returns(_mockAttachmentRepo.Object);
            _mockUow.Setup(u => u.Repository<ProjectMember>()).Returns(_mockMemberRepo.Object);
            _mockUow.Setup(u => u.Repository<MaterialCatalog>()).Returns(_mockMaterialRepo.Object);
            _mockUow.Setup(u => u.Repository<Unit>()).Returns(_mockUnitRepo.Object);
            _mockUow.Setup(u => u.Repository<DirectPurchaseItem>()).Returns(Mock.Of<IGenericRepository<DirectPurchaseItem>>());
            _mockUow.Setup(u => u.Repository<SystemConfig>()).Returns(_mockConfigRepo.Object);

            // Mặc định không có hạn mức để các test khác không vướng rule tiền.
            SetPhaseLimitConfig();

            _mockMaterialRepo.Setup(r => r.Query()).Returns(new List<MaterialCatalog>
            {
                new() { MaterialId = 5, Code = "MAT-5", Name = "Xi măng" }
            }.AsQueryable().BuildMock());
            _mockUnitRepo.Setup(r => r.Query()).Returns(new List<Unit>
            {
                new() { UnitId = 1, UnitName = "Bao" }
            }.AsQueryable().BuildMock());

            _mockCurrentUser.Setup(c => c.GetRequiredUserId()).Returns(UserId);
            // Người gửi là Trưởng dự án - điều kiện duy nhất để thao tác phiếu mua khẩn cấp.
            _mockMemberRepo
                .Setup(r => r.AnyAsync(It.IsAny<Expression<Func<ProjectMember, bool>>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);

            _mockProjectRepo.Setup(r => r.Query()).Returns(new List<Project>
            {
                new() { ProjectId = ProjectId, Name = "Dự án A", Status = ProjectStatus.InProgress }
            }.AsQueryable().BuildMock());

            // Có 1 ảnh hóa đơn để không vướng rule NO_INVOICE
            _mockAttachmentRepo.Setup(r => r.Query()).Returns(new List<Attachment>
            {
                new()
                {
                    EntityType = EntityType.DirectPurchaseRequest,
                    EntityId = DpId,
                    AttachmentType = AttachmentType.InvoicePhoto,
                    FileUrl = "https://example.com/a.jpg",
                    IsDeleted = false,
                }
            }.AsQueryable().BuildMock());

            _handler = new SubmitDirectPurchaseCommandHandler(
                _mockUow.Object,
                _mockCurrentUser.Object,
                _mockFulfillment.Object,
                Mock.Of<IRealtimeNotificationSender>(),
                Mock.Of<INotificationService>());
        }

        private void SetDraft(DateOnly purchaseDate, DateOnly? phaseStart = null, DateOnly? phaseEnd = null,
            string phaseStatus = PhaseStatus.InProgress, string projectStatus = ProjectStatus.InProgress,
            DateOnly? projectStart = null)
        {
            _mockProjectRepo.Setup(r => r.Query()).Returns(new List<Project>
            {
                new()
                {
                    ProjectId = ProjectId,
                    Name = "Dự án A",
                    Status = projectStatus,
                    PlannedStart = projectStart ?? DateOnly.MinValue,
                }
            }.AsQueryable().BuildMock());

            var dp = new DirectPurchaseRequest
            {
                DirectPurchaseId = DpId,
                ProjectId = ProjectId,
                PhaseId = PhaseId,
                RequestedBy = UserId,
                Reason = "Hết xi măng giữa ca",
                Status = DirectPurchaseStatus.Draft,
                PurchaseDate = purchaseDate.ToDateTime(TimeOnly.MinValue),
                Phase = new Phase
                {
                    PhaseId = PhaseId,
                    ProjectId = ProjectId,
                    Name = "Giai đoạn 1",
                    StartDate = phaseStart,
                    EndDate = phaseEnd,
                    Status = phaseStatus,
                },
                Items = new List<DirectPurchaseItem>
                {
                    new() { DirectPurchaseId = DpId, MaterialId = 5, UnitId = 1, Quantity = 10m, ConversionRate = 1m, UnitPrice = 1000m }
                }
            };

            _dpRows.Clear();
            _dpRows.Add(dp);
            RefreshDpRepo();
        }

        private void RefreshDpRepo() =>
            _mockDpRepo.Setup(r => r.Query()).Returns(_dpRows.AsQueryable().BuildMock());

        /// <summary>Thêm một phiếu đã gửi trước đó để kiểm tra phần cộng dồn theo giai đoạn.</summary>
        private void AddSubmittedDp(decimal totalAmount, string status = DirectPurchaseStatus.Approved,
            long phaseId = PhaseId, bool isDeleted = false)
        {
            _dpRows.Add(new DirectPurchaseRequest
            {
                DirectPurchaseId = 1000 + _dpRows.Count,
                ProjectId = ProjectId,
                PhaseId = phaseId,
                RequestedBy = UserId,
                Status = status,
                TotalAmount = totalAmount,
                IsDeleted = isDeleted,
            });
            RefreshDpRepo();
        }

        /// <summary>Đặt hạn mức tiền cộng dồn của giai đoạn; null = chưa cấu hình key (không giới hạn).</summary>
        private void SetPhaseLimitConfig(string? perPhase = null)
        {
            var rows = perPhase is null
                ? new List<SystemConfig>()
                : new List<SystemConfig>
                {
                    new() { ConfigKey = SystemConfigKeys.DirectPurchasePhaseMaxAmount, ConfigValue = perPhase, DataType = "number" }
                };
            _mockConfigRepo.Setup(r => r.Query()).Returns(rows.AsQueryable().BuildMock());
        }

        private DirectPurchaseRequest Draft() => _dpRows.Single(r => r.DirectPurchaseId == DpId);

        private Task<string> Submit() => _handler.Handle(new SubmitDirectPurchaseCommand(DpId), CancellationToken.None);

        [Fact]
        public async Task Submit_PurchaseDateInFuture_ShouldThrow()
        {
            SetDraft(TodayVn.AddDays(1));

            var act = Submit;

            (await act.Should().ThrowAsync<BusinessException>())
                .Which.ErrorCode.Should().Be(ErrorCodes.DpPurchaseDateInFuture);
        }

        [Fact]
        public async Task Submit_PurchaseDateToday_ShouldPassDateValidation()
        {
            SetDraft(TodayVn);

            await Submit();

            _mockFulfillment.Verify(f => f.MaterializeAsync(
                It.IsAny<DirectPurchaseRequest>(),
                It.IsAny<IReadOnlyList<DirectPurchaseItem>>(),
                UserId,
                It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task Submit_PurchaseDateBeforeProjectStart_ShouldThrow()
        {
            SetDraft(TodayVn.AddDays(-10), projectStart: TodayVn.AddDays(-5));

            var act = Submit;

            (await act.Should().ThrowAsync<BusinessException>())
                .Which.ErrorCode.Should().Be(ErrorCodes.DpPurchaseDateBeforeProject);
        }

        /// <summary>
        /// Ngày mua không bắt buộc nằm trong khoảng của giai đoạn: mua trước khi giai đoạn bắt đầu
        /// vẫn hợp lệ, miễn là từ ngày bắt đầu dự án trở đi.
        /// </summary>
        [Fact]
        public async Task Submit_PurchaseDateBeforePhaseStartButAfterProjectStart_ShouldPass()
        {
            SetDraft(TodayVn.AddDays(-10), phaseStart: TodayVn.AddDays(-5), projectStart: TodayVn.AddDays(-30));

            await Submit();

            _mockFulfillment.Verify(f => f.MaterializeAsync(
                It.IsAny<DirectPurchaseRequest>(),
                It.IsAny<IReadOnlyList<DirectPurchaseItem>>(),
                UserId,
                It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task Submit_PurchaseDateAfterPhaseEnd_ShouldThrow()
        {
            SetDraft(TodayVn.AddDays(-1), phaseEnd: TodayVn.AddDays(-5));

            var act = Submit;

            (await act.Should().ThrowAsync<BusinessException>())
                .Which.ErrorCode.Should().Be(ErrorCodes.DpPurchaseDateAfterPhase);
        }

        [Fact]
        public async Task Submit_PhaseAlreadyAccepted_ShouldThrowPhaseFrozen()
        {
            SetDraft(TodayVn, phaseStatus: PhaseStatus.Approved);

            var act = Submit;

            (await act.Should().ThrowAsync<BusinessException>())
                .Which.ErrorCode.Should().Be(ErrorCodes.DpPhaseFrozen);
        }

        [Fact]
        public async Task Submit_ProjectNotActive_ShouldThrow()
        {
            SetDraft(TodayVn, projectStatus: ProjectStatus.Paused);

            var act = Submit;

            (await act.Should().ThrowAsync<BusinessException>())
                .Which.ErrorCode.Should().Be(ErrorCodes.DpProjectNotActive);
        }

        // ---------- Hạn mức tiền mua khẩn cấp cộng dồn theo giai đoạn ----------
        // Phiếu mẫu: 10 x 1.000đ = 10.000đ.

        [Fact]
        public async Task Submit_MaxAmountZero_ShouldMeanUnlimited()
        {
            SetDraft(TodayVn);
            SetPhaseLimitConfig("0");
            AddSubmittedDp(999_999_999m);

            await Submit();

            Draft().Status.Should().Be(DirectPurchaseStatus.Pending);
        }

        [Fact]
        public async Task Submit_PhaseSpendingOverLimit_ShouldThrowAndNotTouchInventory()
        {
            SetDraft(TodayVn);
            SetPhaseLimitConfig("25000");
            AddSubmittedDp(20000m);   // đã tiêu 20.000, phiếu này 10.000 -> 30.000 > 25.000

            var act = Submit;

            (await act.Should().ThrowAsync<BusinessException>())
                .Which.ErrorCode.Should().Be(ErrorCodes.DpOverPhaseMaxAmount);

            _mockFulfillment.Verify(f => f.MaterializeAsync(
                It.IsAny<DirectPurchaseRequest>(), It.IsAny<List<DirectPurchaseItem>>(),
                It.IsAny<long>(), It.IsAny<CancellationToken>()), Times.Never);
            Draft().Status.Should().Be(DirectPurchaseStatus.Draft);
        }

        [Fact]
        public async Task Submit_PhaseSpendingExactlyAtLimit_ShouldPass()
        {
            SetDraft(TodayVn);
            SetPhaseLimitConfig("30000");
            AddSubmittedDp(20000m);

            await Submit();

            Draft().Status.Should().Be(DirectPurchaseStatus.Pending);
        }

        [Fact]
        public async Task Submit_PhaseSpending_ShouldCountRejectedRequests()
        {
            // Phiếu bị từ chối duyệt chi vẫn đã nhập kho và vẫn tiêu thụ định mức BOQ,
            // nên cũng phải tiêu thụ hạn mức tiền của giai đoạn.
            SetDraft(TodayVn);
            SetPhaseLimitConfig("25000");
            AddSubmittedDp(20000m, status: DirectPurchaseStatus.Rejected);

            var act = Submit;

            (await act.Should().ThrowAsync<BusinessException>())
                .Which.ErrorCode.Should().Be(ErrorCodes.DpOverPhaseMaxAmount);
        }

        [Fact]
        public async Task Submit_PhaseSpending_ShouldIgnoreDraftsOtherPhasesAndDeleted()
        {
            SetDraft(TodayVn);
            SetPhaseLimitConfig("25000");
            AddSubmittedDp(20000m, status: DirectPurchaseStatus.Draft);   // nháp: chưa phát sinh gì
            AddSubmittedDp(20000m, phaseId: PhaseId + 1);                 // giai đoạn khác
            AddSubmittedDp(20000m, isDeleted: true);                      // đã xóa mềm

            await Submit();

            Draft().Status.Should().Be(DirectPurchaseStatus.Pending);
        }

        [Fact]
        public async Task Submit_AlreadySubmitted_ShouldThrowNotDraft()
        {
            SetDraft(TodayVn);
            var dp = _mockDpRepo.Object.Query().First();
            dp.Status = DirectPurchaseStatus.Approved;

            var act = Submit;

            (await act.Should().ThrowAsync<BusinessException>())
                .Which.ErrorCode.Should().Be(ErrorCodes.DpNotDraft);
        }

        [Fact]
        public async Task Submit_NeitherLeaderNorTechnicalManager_ShouldThrowForbidden()
        {
            SetDraft(TodayVn);
            _mockCurrentUser.Setup(c => c.IsInRole(UserRole.TechnicalManager)).Returns(false);
            _mockMemberRepo
                .Setup(r => r.AnyAsync(It.IsAny<Expression<Func<ProjectMember, bool>>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(false);

            var act = Submit;

            await act.Should().ThrowAsync<ForbiddenException>();
        }

        [Fact]
        public async Task Submit_TechnicalManagerNotLeader_ShouldBeAllowed()
        {
            SetDraft(TodayVn);
            _mockCurrentUser.Setup(c => c.IsInRole(UserRole.TechnicalManager)).Returns(true);
            _mockMemberRepo
                .Setup(r => r.AnyAsync(It.IsAny<Expression<Func<ProjectMember, bool>>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(false);

            await Submit();

            _mockDpRepo.Object.Query().First().Status.Should().Be(DirectPurchaseStatus.Pending);
        }

        [Fact]
        public async Task Submit_MissingReason_ShouldThrow()
        {
            // Lý do mua khẩn cấp là bắt buộc, và cũng chính là phần giải trình khi vượt định mức.
            SetDraft(TodayVn);
            _mockDpRepo.Object.Query().First().Reason = "   ";

            var act = Submit;

            (await act.Should().ThrowAsync<BusinessException>())
                .Which.ErrorCode.Should().Be(ErrorCodes.DpNoReason);
        }

        [Fact]
        public async Task Submit_InvalidItems_ShouldReportEveryFailingLineWithItsPosition()
        {
            // Gom hết lỗi của mọi dòng trong một lần, kèm vị trí dòng, để FE gắn được dòng đỏ
            // dưới đúng ô nhập thay vì bắt người dùng sửa từng lỗi một.
            SetDraft(TodayVn);
            var dp = _mockDpRepo.Object.Query().First();
            dp.Items = new List<DirectPurchaseItem>
            {
                new() { DirectPurchaseItemId = 1, DirectPurchaseId = DpId, MaterialId = 5, UnitId = 1, Quantity = 0m, ConversionRate = 1m, UnitPrice = 1000m },
                new() { DirectPurchaseItemId = 2, DirectPurchaseId = DpId, MaterialId = 6, UnitId = 1, Quantity = 3m, ConversionRate = 1m, UnitPrice = 0m },
            };

            var act = Submit;

            var failures = (await act.Should().ThrowAsync<ValidationException>()).Which.Errors.ToList();
            failures.Should().HaveCount(2);
            failures.Should().ContainSingle(f =>
                f.PropertyName == "Items[0].Quantity" && f.ErrorCode == ErrorCodes.DpInvalidQuantity);
            failures.Should().ContainSingle(f =>
                f.PropertyName == "Items[1].UnitPrice" && f.ErrorCode == ErrorCodes.DpInvalidUnitPrice);
        }

        [Fact]
        public async Task Submit_InvalidItems_ShouldNotTouchInventory()
        {
            SetDraft(TodayVn);
            _mockDpRepo.Object.Query().First().Items.First().Quantity = 0m;

            var act = Submit;

            await act.Should().ThrowAsync<ValidationException>();
            _mockFulfillment.Verify(f => f.MaterializeAsync(
                It.IsAny<DirectPurchaseRequest>(),
                It.IsAny<IReadOnlyList<DirectPurchaseItem>>(),
                It.IsAny<long>(),
                It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task Submit_OverBoq_ShouldGoToPendingAndFlagOverBoq()
        {
            SetDraft(TodayVn);
            _mockFulfillment
                .Setup(f => f.EvaluateBoqAsync(PhaseId, DpId, It.IsAny<List<ResolvedDirectPurchaseItem>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);

            await Submit();

            var dp = _mockDpRepo.Object.Query().First();
            dp.Status.Should().Be(DirectPurchaseStatus.Pending);
            dp.BOQCheckStatus.Should().Be(BOQCheckStatus.OverBOQ);
        }

        [Fact]
        public async Task Submit_WithinBoq_ShouldAlsoGoToPending()
        {
            // Gửi phiếu KHÔNG tự duyệt chi, kể cả khi trong định mức:
            // Approved phải là kết quả của một quyết định thật, không phải trạng thái khởi tạo.
            SetDraft(TodayVn);

            await Submit();

            var dp = _mockDpRepo.Object.Query().First();
            dp.Status.Should().Be(DirectPurchaseStatus.Pending);
            dp.AuditStatus.Should().Be(DirectPurchaseAuditStatus.PendingAudit);
            dp.BOQCheckStatus.Should().Be(BOQCheckStatus.WithinBOQ);
        }
    }
}
