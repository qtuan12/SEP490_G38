using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Infrastructure.Services
{
    public class InventoryService : IInventoryService
    {
        private readonly IUnitOfWork _uow;
        private readonly ILogger<InventoryService> _logger;

        public InventoryService(IUnitOfWork uow, ILogger<InventoryService> logger)
        {
            _uow = uow;
            _logger = logger;
        }

        public async Task<CurrentInventory> UpdateStockAsync(
            long projectId,
            long materialId,
            decimal quantityChange,
            byte transactionType,
            long referenceId,
            string referenceType,
            long userId,
            CancellationToken cancellationToken)
        {
            _logger.LogInformation(
                "Bắt đầu cập nhật tồn kho: Dự án {ProjectId} | Vật tư {MaterialId} | Lượng thay đổi {QuantityChange} | Loại giao dịch {TransactionType} | Tham chiếu {ReferenceType} #{ReferenceId}",
                projectId, materialId, quantityChange, transactionType, referenceType, referenceId
            );

            int maxRetries = 3;
            int delayMs = 100;

            for (int i = 0; i < maxRetries; i++)
            {
                try
                {
                    // 1. Tìm hoặc tạo bản ghi CurrentInventory cho dự án + vật tư này
                    var inv = await _uow.Repository<CurrentInventory>().Query()
                        .FirstOrDefaultAsync(ci => ci.ProjectId == projectId && ci.MaterialId == materialId, cancellationToken);

                    if (inv == null)
                    {
                        // Nếu chưa tồn tại bản ghi tồn kho, ta bắt buộc phải lấy thông tin base unit của vật tư
                        var material = await _uow.Repository<MaterialCatalog>().Query()
                            .FirstOrDefaultAsync(m => m.MaterialId == materialId, cancellationToken);

                        if (material == null)
                        {
                            _logger.LogWarning("Không tìm thấy thông tin vật tư {MaterialId} để khởi tạo tồn kho.", materialId);
                            throw new NotFoundException(nameof(MaterialCatalog), materialId);
                        }

                        inv = new CurrentInventory
                        {
                            ProjectId = projectId,
                            MaterialId = materialId,
                            UnitId = material.BaseUnitId,
                            Quantity = quantityChange,
                            ReservedQuantity = 0,
                            LastUpdated = DateTime.UtcNow
                        };

                        await _uow.Repository<CurrentInventory>().AddAsync(inv, cancellationToken);
                        _logger.LogInformation("Khởi tạo bản ghi tồn kho mới cho Vật tư {MaterialId} tại Dự án {ProjectId} với số lượng {Quantity}.", materialId, projectId, quantityChange);
                    }
                    else
                    {
                        inv.Quantity += quantityChange;
                        inv.LastUpdated = DateTime.UtcNow;
                        _uow.Repository<CurrentInventory>().Update(inv);
                        _logger.LogInformation("Cập nhật số lượng tồn kho cho Vật tư {MaterialId} tại Dự án {ProjectId}: Thay đổi {QuantityChange} -> Lượng mới {NewQuantity}.", materialId, projectId, quantityChange, inv.Quantity);
                    }

                    // Lưu thay đổi tạm thời trước khi tạo dòng thẻ kho
                    await _uow.SaveChangesAsync(cancellationToken);

                    // 2. Ghi nhận Nhật ký Thẻ kho (InventoryTransaction)
                    var transaction = new InventoryTransaction
                    {
                        ProjectId = projectId,
                        MaterialId = materialId,
                        TransactionType = transactionType,
                        ReferenceId = referenceId,
                        ReferenceType = referenceType,
                        QuantityChange = quantityChange,
                        BalanceAfter = inv.Quantity,
                        CreatedBy = userId,
                        CreatedAt = DateTime.UtcNow
                    };

                    await _uow.Repository<InventoryTransaction>().AddAsync(transaction, cancellationToken);
                    await _uow.SaveChangesAsync(cancellationToken);

                    _logger.LogInformation(
                        "Ghi nhận thẻ kho thành công: Giao dịch #{TransactionId} | Dự án {ProjectId} | Vật tư {MaterialId} | Tham chiếu {ReferenceType} #{ReferenceId}",
                        transaction.TransactionId, projectId, materialId, referenceType, referenceId
                    );

                    return inv;
                }
                catch (DbUpdateConcurrencyException ex)
                {
                    if (i == maxRetries - 1)
                    {
                        _logger.LogError(ex, "Thất bại hoàn toàn khi cập nhật tồn kho do xung đột đồng thời kéo dài sau {MaxRetries} lần thử cho Vật tư {MaterialId} tại Dự án {ProjectId}.", maxRetries, materialId, projectId);
                        throw;
                    }

                    _logger.LogWarning(ex, "Phát hiện xung đột đồng thời khi cập nhật tồn kho vật tư {MaterialId} tại dự án {ProjectId}. Đang thử tải lại dữ liệu và lưu lại (Lần thử {RetryCount}).", materialId, projectId, i + 1);

                    // Tìm entry bị lỗi và tải lại dữ liệu mới nhất từ database
                    var entry = ex.Entries.FirstOrDefault(e => e.Entity is CurrentInventory);
                    if (entry != null)
                    {
                        await entry.ReloadAsync(cancellationToken);
                    }

                    // Chờ một thời gian ngắn trước khi thử lại để tránh xung đột tức thời
                    await Task.Delay(delayMs, cancellationToken);
                }
            }

            throw new BusinessException("CONCURRENCY_ERROR", "Không thể cập nhật tồn kho do xung đột đồng thời kéo dài.");
        }
    }
}
