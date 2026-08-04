using BPG.Application.DTOs.DirectPurchases;
using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace BPG.Application.Features.DirectPurchases.Services
{
    /// <summary>
    /// Ghi phần thân phiếu nháp (dòng vật tư + ảnh hóa đơn). Dùng chung cho Create và Update.
    /// </summary>
    internal static class DirectPurchaseDraftWriter
    {
        public static void EnsureNoDuplicateMaterial(IReadOnlyList<DirectPurchaseItemInput> items)
        {
            var dup = items.GroupBy(i => i.MaterialId).FirstOrDefault(g => g.Count() > 1);
            if (dup != null)
                throw new BusinessException(ErrorCodes.DpDuplicateMaterial,
                    $"Vật tư ID {dup.Key} bị trùng lặp trong phiếu.");
        }

        public static async Task ReplaceItemsAsync(
            IUnitOfWork uow,
            long directPurchaseId,
            IReadOnlyList<ResolvedDirectPurchaseItem> resolved,
            CancellationToken ct)
        {
            var existing = await uow.Repository<DirectPurchaseItem>().Query()
                .Where(i => i.DirectPurchaseId == directPurchaseId)
                .ToListAsync(ct);

            if (existing.Count > 0)
            {
                uow.Repository<DirectPurchaseItem>().RemoveRange(existing);
                // Xóa trước khi thêm để không đụng unique index (DirectPurchaseId, MaterialId).
                await uow.SaveChangesAsync(ct);
            }

            if (resolved.Count == 0) return;

            var items = resolved.Select(r => new DirectPurchaseItem
            {
                DirectPurchaseId = directPurchaseId,
                MaterialId = r.MaterialId,
                UnitId = r.UnitId,
                Quantity = r.Quantity,
                ConversionRate = r.ConversionRate,
                UnitPrice = r.UnitPrice,
                LineTotal = r.LineTotal,
                IsOverBOQ = r.IsOverBOQ,
                Explanation = r.Explanation,
            }).ToList();

            await uow.Repository<DirectPurchaseItem>().AddRangeAsync(items, ct);
        }

        public static async Task ReplaceInvoicePhotosAsync(
            IUnitOfWork uow,
            long directPurchaseId,
            IReadOnlyList<string> urls,
            long userId,
            CancellationToken ct)
        {
            var existing = await uow.Repository<Attachment>().Query()
                .Where(a => a.EntityType == EntityType.DirectPurchaseRequest &&
                            a.EntityId == directPurchaseId &&
                            a.AttachmentType == AttachmentType.InvoicePhoto &&
                            !a.IsDeleted)
                .ToListAsync(ct);

            foreach (var att in existing)
            {
                if (urls.Contains(att.FileUrl)) continue;
                att.IsDeleted = true;
                att.UpdatedAt = DateTime.UtcNow;
                att.UpdatedBy = userId;
                uow.Repository<Attachment>().Update(att);
            }

            var keptUrls = existing.Where(a => !a.IsDeleted).Select(a => a.FileUrl).ToHashSet();

            foreach (var url in urls.Distinct())
            {
                if (keptUrls.Contains(url)) continue;

                await uow.Repository<Attachment>().AddAsync(new Attachment
                {
                    EntityType = EntityType.DirectPurchaseRequest,
                    EntityId = directPurchaseId,
                    AttachmentType = AttachmentType.InvoicePhoto,
                    FileName = Path.GetFileName(new Uri(url).AbsolutePath),
                    FileUrl = url,
                    ContentType = "image/jpeg",
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = userId,
                }, ct);
            }
        }
    }
}
