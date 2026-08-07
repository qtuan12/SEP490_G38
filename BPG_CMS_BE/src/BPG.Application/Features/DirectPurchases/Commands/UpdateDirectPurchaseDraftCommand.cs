using BPG.Application.DTOs.DirectPurchases;
using MediatR;

namespace BPG.Application.Features.DirectPurchases.Commands
{
    /// <summary>Sửa phiếu nháp. Chỉ người tạo và chỉ khi Status = Draft.</summary>
    public class UpdateDirectPurchaseDraftCommand : IRequest<bool>
    {
        public long DirectPurchaseId { get; set; }
        public long PhaseId { get; set; }
        public long? TaskId { get; set; }
        public string Reason { get; set; } = string.Empty;
        public DateOnly PurchaseDate { get; set; }
        public List<DirectPurchaseItemInput> Items { get; set; } = new();
        public List<string> InvoicePhotoUrls { get; set; } = new();
    }
}
