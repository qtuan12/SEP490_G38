using BPG.Application.DTOs.DirectPurchases;
using MediatR;

namespace BPG.Application.Features.DirectPurchases.Commands
{
    /// <summary>
    /// Tạo phiếu mua trực tiếp ở trạng thái NHÁP. Chưa sinh PO/GR/tồn kho.
    /// Dùng <see cref="SubmitDirectPurchaseCommand"/> để gửi phiếu.
    /// </summary>
    public class CreateDirectPurchaseRequestCommand : IRequest<long>
    {
        public long ProjectId { get; set; }
        public long PhaseId { get; set; }
        public long? TaskId { get; set; }
        /// <summary>Lý do mua khẩn cấp - cũng là phần giải trình khi phiếu vượt định mức BOQ.</summary>
        public string Reason { get; set; } = string.Empty;
        public DateOnly PurchaseDate { get; set; }
        public List<DirectPurchaseItemInput> Items { get; set; } = new();
        public List<string> InvoicePhotoUrls { get; set; } = new();
    }
}
