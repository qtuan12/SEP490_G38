using BPG.Application.DTOs.DirectPurchases;
using BPG.Domain.Entities;

namespace BPG.Application.IServices
{
    /// <summary>
    /// Một dòng vật tư đã được resolve đơn vị tính + tỷ lệ quy đổi và đối chiếu định mức BOQ.
    /// </summary>
    public class ResolvedDirectPurchaseItem
    {
        public long MaterialId { get; set; }
        public string MaterialName { get; set; } = string.Empty;
        public int UnitId { get; set; }
        public string UnitName { get; set; } = string.Empty;
        public decimal ConversionRate { get; set; } = 1m;
        public decimal Quantity { get; set; }
        public decimal UnitPrice { get; set; }
        public bool IsOverBOQ { get; set; }
        public string? Explanation { get; set; }

        public decimal LineTotal => Quantity * UnitPrice;
        /// <summary>Quy ước toàn hệ thống: quy đổi về đơn vị cơ bản bằng phép CHIA.</summary>
        public decimal QuantityInBase => Quantity / (ConversionRate == 0 ? 1m : ConversionRate);
    }

    public interface IDirectPurchaseFulfillmentService
    {
        /// <summary>
        /// Tra vật tư và suy ra đơn vị tính từ chính vật tư: dùng đơn vị của dòng BOQ nếu vật tư nằm
        /// trong định mức của giai đoạn, ngược lại dùng đơn vị cơ bản. Người dùng không chọn đơn vị.
        /// KHÔNG đối chiếu số lượng BOQ - dùng được cho cả lúc lưu nháp.
        /// </summary>
        Task<List<ResolvedDirectPurchaseItem>> ResolveItemsAsync(
            long phaseId,
            IReadOnlyList<DirectPurchaseItemInput> items,
            CancellationToken ct);

        /// <summary>
        /// Đối chiếu định mức BOQ của Phase và đánh dấu <see cref="ResolvedDirectPurchaseItem.IsOverBOQ"/>.
        /// Lũy kế gồm Material Request còn hiệu lực hoặc đã ghi nhận điều chuyển nội bộ,
        /// cùng Direct Purchase đã gửi (trừ Draft).
        /// Trả về true nếu có ít nhất một dòng vượt định mức.
        /// </summary>
        Task<bool> EvaluateBoqAsync(
            long phaseId,
            long? excludeDirectPurchaseId,
            List<ResolvedDirectPurchaseItem> resolvedItems,
            CancellationToken ct);

        /// <summary>
        /// Sinh PurchaseOrder + GoodsReceipt và cộng tồn kho cho phiếu vừa được gửi.
        /// Phải được gọi bên trong transaction do caller mở.
        /// Gán <c>AutoPOId</c>/<c>AutoReceiptId</c> lên <paramref name="dp"/>.
        /// </summary>
        Task MaterializeAsync(
            DirectPurchaseRequest dp,
            IReadOnlyList<DirectPurchaseItem> dpItems,
            long userId,
            CancellationToken ct);
    }
}
