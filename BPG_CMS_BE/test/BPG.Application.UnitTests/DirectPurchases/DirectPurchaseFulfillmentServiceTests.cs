using BPG.Application.DTOs.DirectPurchases;
using BPG.Application.Features.DirectPurchases.Services;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using FluentAssertions;
using System;
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
    /// Trọng tâm: quy tắc lũy kế định mức BOQ của Direct Purchase.
    /// Phiếu Draft KHÔNG tính (chưa nhập kho); phiếu Rejected VẪN tính (đã nhập kho, chỉ là không hoàn tiền).
    /// Đây là chỗ ngược với Material Request nên rất dễ bị "đồng bộ" nhầm.
    /// </summary>
    public class DirectPurchaseFulfillmentServiceTests
    {
        private const long PhaseId = 10;
        private const long MaterialId = 77;

        private readonly Mock<IUnitOfWork> _mockUow = new();
        private readonly Mock<IGenericRepository<BOQItem>> _mockBoqRepo = new();
        private readonly Mock<IGenericRepository<MaterialRequestItem>> _mockMrItemRepo = new();
        private readonly Mock<IGenericRepository<DirectPurchaseItem>> _mockDpItemRepo = new();
        private readonly DirectPurchaseFulfillmentService _service;

        public DirectPurchaseFulfillmentServiceTests()
        {
            _mockUow.Setup(u => u.Repository<BOQItem>()).Returns(_mockBoqRepo.Object);
            _mockUow.Setup(u => u.Repository<MaterialRequestItem>()).Returns(_mockMrItemRepo.Object);
            _mockUow.Setup(u => u.Repository<DirectPurchaseItem>()).Returns(_mockDpItemRepo.Object);

            SetBoq(100m);
            SetMaterialRequestItems();
            SetDirectPurchaseItems();

            _service = new DirectPurchaseFulfillmentService(_mockUow.Object, Mock.Of<IInventoryService>());
        }

        private void SetBoq(decimal quantity) =>
            _mockBoqRepo.Setup(r => r.Query()).Returns(new List<BOQItem>
            {
                new() { BOQItemId = 1, PhaseId = PhaseId, MaterialId = MaterialId, Quantity = quantity, ConversionRate = 1m, IsDeleted = false }
            }.AsQueryable().BuildMock());

        private void SetMaterialRequestItems(params MaterialRequestItem[] items) =>
            _mockMrItemRepo.Setup(r => r.Query()).Returns(items.ToList().AsQueryable().BuildMock());

        private void SetDirectPurchaseItems(params DirectPurchaseItem[] items) =>
            _mockDpItemRepo.Setup(r => r.Query()).Returns(items.ToList().AsQueryable().BuildMock());

        private static DirectPurchaseItem DpItem(long dpId, string status, decimal quantity, bool isDeleted = false) =>
            new()
            {
                DirectPurchaseId = dpId,
                MaterialId = MaterialId,
                Quantity = quantity,
                ConversionRate = 1m,
                DirectPurchaseRequest = new DirectPurchaseRequest
                {
                    DirectPurchaseId = dpId,
                    PhaseId = PhaseId,
                    Status = status,
                    IsDeleted = isDeleted,
                }
            };

        private static List<ResolvedDirectPurchaseItem> Request(decimal quantity) => new()
        {
            new ResolvedDirectPurchaseItem
            {
                MaterialId = MaterialId,
                MaterialName = "Xi măng",
                UnitId = 1,
                UnitName = "Bao",
                ConversionRate = 1m,
                Quantity = quantity,
                UnitPrice = 1000m,
            }
        };

        [Fact]
        public async Task EvaluateBoq_WithinAllowance_ShouldNotFlagOverBoq()
        {
            var items = Request(40m);

            var anyOver = await _service.EvaluateBoqAsync(PhaseId, null, items, CancellationToken.None);

            anyOver.Should().BeFalse();
            items[0].IsOverBOQ.Should().BeFalse();
            items[0].Explanation.Should().BeNull();
        }

        [Fact]
        public async Task EvaluateBoq_ExceedingAllowance_ShouldFlagOverBoqWithExplanation()
        {
            var items = Request(140m);

            var anyOver = await _service.EvaluateBoqAsync(PhaseId, null, items, CancellationToken.None);

            anyOver.Should().BeTrue();
            items[0].IsOverBOQ.Should().BeTrue();
            items[0].Explanation.Should().Contain("Vượt định mức BOQ");
        }

        [Fact]
        public async Task EvaluateBoq_BoqLineRemovedAfterDrafting_ShouldFlagOverBoq()
        {
            // ResolveItemsAsync đã chặn vật tư ngoài BOQ ngay từ khâu soạn nháp, nên trường hợp này
            // chỉ còn xảy ra khi dòng BOQ bị xóa sau đó. Phiếu không được lọt qua im lặng.
            _mockBoqRepo.Setup(r => r.Query()).Returns(new List<BOQItem>().AsQueryable().BuildMock());
            var items = Request(1m);

            var anyOver = await _service.EvaluateBoqAsync(PhaseId, null, items, CancellationToken.None);

            anyOver.Should().BeTrue();
            items[0].IsOverBOQ.Should().BeTrue();
            items[0].Explanation.Should().Contain("không còn trong định mức BOQ");
        }

        [Fact]
        public async Task EvaluateBoq_DraftDirectPurchase_ShouldNotConsumeAllowance()
        {
            // Phiếu nháp chưa gửi -> chưa sinh phiếu nhập kho -> không được giữ chỗ định mức.
            SetDirectPurchaseItems(DpItem(1, DirectPurchaseStatus.Draft, 90m));
            var items = Request(50m);

            var anyOver = await _service.EvaluateBoqAsync(PhaseId, null, items, CancellationToken.None);

            anyOver.Should().BeFalse();
        }

        [Fact]
        public async Task EvaluateBoq_RejectedDirectPurchase_ShouldStillConsumeAllowance()
        {
            // Từ chối duyệt chi KHÔNG hoàn hàng: vật tư đã nhập kho nên vẫn ăn định mức.
            SetDirectPurchaseItems(DpItem(1, DirectPurchaseStatus.Rejected, 90m));
            var items = Request(50m);

            var anyOver = await _service.EvaluateBoqAsync(PhaseId, null, items, CancellationToken.None);

            anyOver.Should().BeTrue();
        }

        [Theory]
        [InlineData(DirectPurchaseStatus.Pending)]
        [InlineData(DirectPurchaseStatus.WaitingApproval)]
        [InlineData(DirectPurchaseStatus.Approved)]
        public async Task EvaluateBoq_SubmittedDirectPurchase_ShouldConsumeAllowance(string status)
        {
            SetDirectPurchaseItems(DpItem(1, status, 90m));
            var items = Request(50m);

            var anyOver = await _service.EvaluateBoqAsync(PhaseId, null, items, CancellationToken.None);

            anyOver.Should().BeTrue();
        }

        [Fact]
        public async Task EvaluateBoq_ExcludedDirectPurchase_ShouldNotCountItself()
        {
            // Khi gửi lại chính phiếu này, số lượng của nó không được tính hai lần.
            SetDirectPurchaseItems(DpItem(42, DirectPurchaseStatus.Pending, 90m));
            var items = Request(50m);

            var anyOver = await _service.EvaluateBoqAsync(PhaseId, 42, items, CancellationToken.None);

            anyOver.Should().BeFalse();
        }

        [Fact]
        public async Task EvaluateBoq_SoftDeletedDirectPurchase_ShouldNotConsumeAllowance()
        {
            SetDirectPurchaseItems(DpItem(1, DirectPurchaseStatus.Approved, 90m, isDeleted: true));
            var items = Request(50m);

            var anyOver = await _service.EvaluateBoqAsync(PhaseId, null, items, CancellationToken.None);

            anyOver.Should().BeFalse();
        }

        [Theory]
        [InlineData(MaterialRequestStatus.Rejected, false)]
        [InlineData(MaterialRequestStatus.Cancelled, false)]
        [InlineData(MaterialRequestStatus.Pending, true)]
        [InlineData(MaterialRequestStatus.Approved, true)]
        public async Task EvaluateBoq_MaterialRequest_ShouldExcludeRejectedAndCancelledOnly(string status, bool expectOver)
        {
            // Ngược với Direct Purchase: MR bị từ chối/hủy thì không có vật tư nào được mua.
            SetMaterialRequestItems(new MaterialRequestItem
            {
                MaterialId = MaterialId,
                Quantity = 90m,
                ConversionRate = 1m,
                Request = new MaterialRequest { PhaseId = PhaseId, Status = status, IsDeleted = false }
            });
            var items = Request(50m);

            var anyOver = await _service.EvaluateBoqAsync(PhaseId, null, items, CancellationToken.None);

            anyOver.Should().Be(expectOver);
        }

        // ---------- Quy tắc suy ra đơn vị tính: người dùng không chọn ----------

        [Fact]
        public async Task ResolveItems_MaterialInBoq_ShouldUseBoqUnitAndRate()
        {
            SetupCatalogForResolve();
            _mockBoqRepo.Setup(r => r.Query()).Returns(new List<BOQItem>
            {
                new()
                {
                    BOQItemId = 1, PhaseId = PhaseId, MaterialId = MaterialId,
                    Quantity = 100m, ConversionRate = 0.2m, UnitId = 9, IsDeleted = false,
                    Unit = new Unit { UnitId = 9, UnitName = "Thùng" }
                }
            }.AsQueryable().BuildMock());

            var resolved = await _service.ResolveItemsAsync(PhaseId, new[]
            {
                new DirectPurchaseItemInput { MaterialId = MaterialId, Quantity = 3m, UnitPrice = 100m }
            }, CancellationToken.None);

            resolved.Should().ContainSingle();
            resolved[0].UnitId.Should().Be(9);
            resolved[0].UnitName.Should().Be("Thùng");
            resolved[0].ConversionRate.Should().Be(0.2m);
        }

        [Fact]
        public async Task ResolveItems_MaterialNotInBoq_ShouldThrow()
        {
            // Chỉ mua khẩn cấp được vật tư đã có trong định mức BOQ của giai đoạn.
            SetupCatalogForResolve();
            _mockBoqRepo.Setup(r => r.Query()).Returns(new List<BOQItem>().AsQueryable().BuildMock());

            var act = () => _service.ResolveItemsAsync(PhaseId, new[]
            {
                new DirectPurchaseItemInput { MaterialId = MaterialId, Quantity = 3m, UnitPrice = 100m }
            }, CancellationToken.None);

            (await act.Should().ThrowAsync<BusinessException>())
                .Which.ErrorCode.Should().Be(ErrorCodes.DpMaterialNotInBoq);
        }

        [Fact]
        public async Task ResolveItems_DiscreteUnitWithFractionalQuantity_ShouldThrow()
        {
            SetupCatalogForResolve(baseUnitIsDiscrete: true);
            // Vật tư phải nằm trong BOQ, nếu không sẽ dừng ở kiểm tra định mức chứ không tới
            // được kiểm tra số lượng nguyên.
            _mockBoqRepo.Setup(r => r.Query()).Returns(new List<BOQItem>
            {
                new()
                {
                    BOQItemId = 1, PhaseId = PhaseId, MaterialId = MaterialId,
                    Quantity = 100m, ConversionRate = 1m, UnitId = 1, IsDeleted = false,
                    Unit = new Unit { UnitId = 1, UnitName = "Bao", IsDiscrete = true }
                }
            }.AsQueryable().BuildMock());

            var act = () => _service.ResolveItemsAsync(PhaseId, new[]
            {
                new DirectPurchaseItemInput { MaterialId = MaterialId, Quantity = 2.5m, UnitPrice = 100m }
            }, CancellationToken.None);

            (await act.Should().ThrowAsync<BusinessException>())
                .Which.ErrorCode.Should().Be(ErrorCodes.InvalidUnitQuantity);
        }

        // ---------- Người dùng tự chọn đơn vị tính ----------

        [Fact]
        public async Task ResolveItems_UserPicksBaseUnit_ShouldUseRateOne()
        {
            SetupCatalogForResolve();
            SetupConversions();
            _mockBoqRepo.Setup(r => r.Query()).Returns(new List<BOQItem>
            {
                new()
                {
                    BOQItemId = 1, PhaseId = PhaseId, MaterialId = MaterialId,
                    Quantity = 100m, ConversionRate = 0.2m, UnitId = 9, IsDeleted = false,
                    Unit = new Unit { UnitId = 9, UnitName = "Thùng" }
                }
            }.AsQueryable().BuildMock());

            // Dòng BOQ tính theo Thùng nhưng người dùng mua theo Bao (đơn vị cơ bản).
            var resolved = await _service.ResolveItemsAsync(PhaseId, new[]
            {
                new DirectPurchaseItemInput { MaterialId = MaterialId, UnitId = 1, Quantity = 3m, UnitPrice = 100m }
            }, CancellationToken.None);

            resolved[0].UnitId.Should().Be(1);
            resolved[0].UnitName.Should().Be("Bao");
            resolved[0].ConversionRate.Should().Be(1m);
        }

        [Fact]
        public async Task ResolveItems_UserPicksAlternativeUnit_ShouldUseConversionRateFromDb()
        {
            SetupCatalogForResolve();
            SetupConversions();
            SetupBoqForResolve();

            var resolved = await _service.ResolveItemsAsync(PhaseId, new[]
            {
                new DirectPurchaseItemInput { MaterialId = MaterialId, UnitId = 5, Quantity = 2m, UnitPrice = 100m }
            }, CancellationToken.None);

            resolved[0].UnitId.Should().Be(5);
            resolved[0].UnitName.Should().Be("Tấn");
            resolved[0].ConversionRate.Should().Be(0.05m);
        }

        [Fact]
        public async Task ResolveItems_UserPicksUnitWithoutConversion_ShouldThrow()
        {
            SetupCatalogForResolve();
            SetupConversions();
            SetupBoqForResolve();

            var act = () => _service.ResolveItemsAsync(PhaseId, new[]
            {
                new DirectPurchaseItemInput { MaterialId = MaterialId, UnitId = 999, Quantity = 2m, UnitPrice = 100m }
            }, CancellationToken.None);

            (await act.Should().ThrowAsync<BusinessException>())
                .Which.ErrorCode.Should().Be(ErrorCodes.DpInvalidUnit);
        }

        /// <summary>
        /// Dòng BOQ tối thiểu để qua được kiểm tra "vật tư phải có trong định mức" — dùng cho các
        /// test chỉ quan tâm tới quy tắc suy ra đơn vị tính.
        /// </summary>
        private void SetupBoqForResolve()
        {
            _mockBoqRepo.Setup(r => r.Query()).Returns(new List<BOQItem>
            {
                new()
                {
                    BOQItemId = 1, PhaseId = PhaseId, MaterialId = MaterialId,
                    Quantity = 100m, ConversionRate = 1m, UnitId = 1, IsDeleted = false,
                    Unit = new Unit { UnitId = 1, UnitName = "Bao" }
                }
            }.AsQueryable().BuildMock());
        }

        private void SetupCatalogForResolve(bool baseUnitIsDiscrete = false)
        {
            var baseUnit = new Unit { UnitId = 1, UnitName = "Bao", IsDiscrete = baseUnitIsDiscrete };
            var altUnit = new Unit { UnitId = 5, UnitName = "Tấn" };
            var mockMaterialRepo = new Mock<IGenericRepository<MaterialCatalog>>();
            var mockUnitRepo = new Mock<IGenericRepository<Unit>>();

            mockMaterialRepo.Setup(r => r.Query()).Returns(new List<MaterialCatalog>
            {
                new() { MaterialId = MaterialId, Code = "MAT-77", Name = "Xi măng", BaseUnitId = 1, BaseUnit = baseUnit, IsDeleted = false }
            }.AsQueryable().BuildMock());
            mockUnitRepo.Setup(r => r.Query()).Returns(new List<Unit> { baseUnit, altUnit }.AsQueryable().BuildMock());

            _mockUow.Setup(u => u.Repository<MaterialCatalog>()).Returns(mockMaterialRepo.Object);
            _mockUow.Setup(u => u.Repository<Unit>()).Returns(mockUnitRepo.Object);
        }

        /// <summary>Xi măng: 1 tấn = 20 bao, tức 0.05 tấn trên một bao (đơn vị cơ bản).</summary>
        private void SetupConversions()
        {
            var mockConversionRepo = new Mock<IGenericRepository<MaterialConversion>>();
            mockConversionRepo.Setup(r => r.Query()).Returns(new List<MaterialConversion>
            {
                new() { MaterialId = MaterialId, AlternativeUnitId = 5, ConversionRate = 0.05m }
            }.AsQueryable().BuildMock());

            _mockUow.Setup(u => u.Repository<MaterialConversion>()).Returns(mockConversionRepo.Object);
        }
    }
}
