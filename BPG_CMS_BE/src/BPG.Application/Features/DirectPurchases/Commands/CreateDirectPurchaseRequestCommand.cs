using BPG.Application.DTOs.DirectPurchases;
using MediatR;

namespace BPG.Application.Features.DirectPurchases.Commands
{
    public class CreateDirectPurchaseRequestCommand : IRequest<long>
    {
        public long ProjectId { get; set; }
        public long PhaseId { get; set; }
        public long? TaskId { get; set; }
        public string Reason { get; set; } = string.Empty;
        public DateTime PurchaseDate { get; set; }
        public List<DirectPurchaseItemInput> Items { get; set; } = new();
        public List<string> InvoicePhotoUrls { get; set; } = new();
    }
}
