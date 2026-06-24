using System.Threading;
using System.Threading.Tasks;
using BPG.Domain.Entities;

namespace BPG.Application.IServices
{
    public interface IInventoryService
    {
        /// <summary>
        /// Cập nhật tồn kho ảo (CurrentInventory) và ghi nhận thẻ kho (InventoryTransaction) tương ứng.
        /// Thao tác này tự động chuyển đổi, cập nhật số dư và lưu vết kế toán.
        /// </summary>
        /// <param name="projectId">ID Dự án</param>
        /// <param name="materialId">ID Vật tư</param>
        /// <param name="quantityChange">Số lượng thay đổi (dương = tăng kho, âm = giảm kho, tính theo đơn vị base unit)</param>
        /// <param name="transactionType">Loại giao dịch (1: GoodsReceipt, 2: Issuance, 6: Adjustment...)</param>
        /// <param name="referenceId">ID tài liệu nguồn (ReceiptId, IssuanceId...)</param>
        /// <param name="referenceType">Tên tài liệu nguồn ("GoodsReceipt", "MaterialIssuance", "GoodsReceiptReversal")</param>
        /// <param name="userId">ID người thực hiện</param>
        /// <param name="cancellationToken">Cancellation token</param>
        /// <returns>CurrentInventory sau khi được cập nhật số dư mới nhất</returns>
        Task<CurrentInventory> UpdateStockAsync(
            long projectId,
            long materialId,
            decimal quantityChange,
            byte transactionType,
            long referenceId,
            string referenceType,
            long userId,
            CancellationToken cancellationToken);
    }
}
