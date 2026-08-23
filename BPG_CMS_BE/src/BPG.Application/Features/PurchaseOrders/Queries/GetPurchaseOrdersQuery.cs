using BPG.Application.Common.Models;
using BPG.Application.DTOs.PurchaseOrders;
using MediatR;
namespace BPG.Application.Features.PurchaseOrders.Queries
{
    public class GetPurchaseOrdersQuery : PaginationRequest, IRequest<PagedList<PurchaseOrderDto>>
    {
        public long? ProjectId { get; set; }
        public string? Status { get; set; }

        // Search (kế thừa từ PaginationRequest): tìm theo số đơn hàng hoặc tên nhà cung cấp

        public DateOnly? OrderDateFrom { get; set; }
        public DateOnly? OrderDateTo { get; set; }

        // Phân loại nguồn gốc PO: "normal" = PO thường (qua NCC), "direct" = PO tự sinh
        // từ phiếu mua khẩn cấp (PONumber "DP-PO-...", SupplierId null). Bỏ trống = không lọc.
        public string? SourceType { get; set; }
        // Khong truyen ProjectId -> xem danh sach PO cua tat ca du an theo role duoc phep.
    }
}


