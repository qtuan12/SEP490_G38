using BPG.Application.Common.Models;
using BPG.Application.DTOs.PurchaseOrders;
using MediatR;
namespace BPG.Application.Features.PurchaseOrders.Queries
{
    public class GetPurchaseOrdersQuery : PaginationRequest, IRequest<PagedList<PurchaseOrderDto>>
    {
        public long? ProjectId { get; set; }
        public string? Status { get; set; }

        // Search (káº¿ thá»«a tá»« PaginationRequest): tÃ¬m theo sá»‘ Ä‘Æ¡n hÃ ng hoáº·c tÃªn nhÃ  cung cáº¥p

        public DateOnly? OrderDateFrom { get; set; }
        public DateOnly? OrderDateTo { get; set; }
        // Khong truyen ProjectId -> xem danh sach PO cua tat ca du an theo role duoc phep.
    }
}


