using BPG.Application.IRepositories;
using BPG.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.PurchaseOrders.Services
{
    /// <summary>
    /// Sinh mã đơn mua hàng dạng <c>PO-yyyyMMdd-0001</c>.
    ///
    /// Không đếm số PO trong ngày rồi +1: cách đó cấp lại đúng một mã khi có PO bị xóa mềm
    /// (bản ghi bị query filter loại nên số đếm tụt), và hai người tạo cùng lúc sẽ nhận cùng
    /// một số đếm. Thay vào đó lấy số thứ tự LỚN NHẤT đã phát trong ngày rồi +1, và đọc cả
    /// bản ghi đã xóa mềm — mã chứng từ đã phát ra thì không được dùng lại.
    ///
    /// Phần chống chạy đua do người gọi lo: <see cref="CreatePurchaseOrderCommandHandler"/>
    /// bọc trong transaction kèm sp_getapplock theo <see cref="LockResource"/>.
    /// </summary>
    internal static class PoNumberGenerator
    {
        public static string Prefix(DateOnly orderDate) => $"PO-{orderDate:yyyyMMdd}-";

        /// <summary>Khóa theo ngày: chỉ chặn những người cùng tạo PO trong một ngày, không chặn toàn hệ thống.</summary>
        public static string LockResource(DateOnly orderDate) => $"PurchaseOrder_Number_{orderDate:yyyyMMdd}";

        public static async Task<string> NextAsync(IUnitOfWork uow, DateOnly orderDate, CancellationToken ct)
        {
            var prefix = Prefix(orderDate);

            // Hậu tố D4 nên so sánh chuỗi cũng ra đúng thứ tự số. IgnoreQueryFilters để không
            // cấp lại mã của PO đã xóa mềm.
            var lastNumber = await uow.Repository<PurchaseOrder>().Query()
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(po => po.PONumber.StartsWith(prefix))
                .OrderByDescending(po => po.PONumber)
                .Select(po => po.PONumber)
                .FirstOrDefaultAsync(ct);

            var next = 1;
            if (lastNumber != null && lastNumber.Length > prefix.Length
                && int.TryParse(lastNumber[prefix.Length..], out var lastSequence))
            {
                next = lastSequence + 1;
            }

            return $"{prefix}{next:D4}";
        }

        /// <summary>Kiểm mã do người dùng tự nhập, tính cả PO đã xóa mềm.</summary>
        public static Task<bool> ExistsAsync(IUnitOfWork uow, string poNumber, CancellationToken ct) =>
            uow.Repository<PurchaseOrder>().Query()
                .IgnoreQueryFilters()
                .AnyAsync(po => po.PONumber == poNumber, ct);
    }
}
