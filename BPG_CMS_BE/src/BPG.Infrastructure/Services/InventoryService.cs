using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System;
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
                projectId,
                materialId,
                quantityChange,
                transactionType,
                referenceType,
                referenceId);

            try
            {
                var inventory = await _uow.Repository<CurrentInventory>()
                    .Query()
                    .FirstOrDefaultAsync(
                        x => x.ProjectId == projectId && x.MaterialId == materialId,
                        cancellationToken);

                if (inventory == null)
                {
                    var material = await _uow.Repository<MaterialCatalog>()
                        .Query()
                        .FirstOrDefaultAsync(x => x.MaterialId == materialId, cancellationToken);

                    if (material == null)
                    {
                        _logger.LogWarning(
                            "Không tìm thấy thông tin vật tư {MaterialId} để khởi tạo tồn kho.",
                            materialId);
                        throw new NotFoundException(nameof(MaterialCatalog), materialId);
                    }

                    EnsureSufficientStock(materialId, currentQuantity: 0, quantityChange);

                    inventory = new CurrentInventory
                    {
                        ProjectId = projectId,
                        MaterialId = materialId,
                        UnitId = material.BaseUnitId,
                        Quantity = quantityChange,
                        ReservedQuantity = 0,
                        LastUpdated = DateTime.UtcNow
                    };

                    await _uow.Repository<CurrentInventory>().AddAsync(inventory, cancellationToken);
                    _logger.LogInformation(
                        "Khởi tạo bản ghi tồn kho mới cho Vật tư {MaterialId} tại Dự án {ProjectId} với số lượng {Quantity}.",
                        materialId,
                        projectId,
                        quantityChange);
                }
                else
                {
                    EnsureSufficientStock(materialId, inventory.Quantity, quantityChange);

                    inventory.Quantity += quantityChange;
                    inventory.LastUpdated = DateTime.UtcNow;
                    _uow.Repository<CurrentInventory>().Update(inventory);

                    _logger.LogInformation(
                        "Cập nhật số lượng tồn kho cho Vật tư {MaterialId} tại Dự án {ProjectId}: Thay đổi {QuantityChange} -> Lượng mới {NewQuantity}.",
                        materialId,
                        projectId,
                        quantityChange,
                        inventory.Quantity);
                }

                var transaction = new InventoryTransaction
                {
                    ProjectId = projectId,
                    MaterialId = materialId,
                    TransactionType = transactionType,
                    ReferenceId = referenceId,
                    ReferenceType = referenceType,
                    QuantityChange = quantityChange,
                    BalanceAfter = inventory.Quantity,
                    CreatedBy = userId,
                    CreatedAt = DateTime.UtcNow
                };

                await _uow.Repository<InventoryTransaction>().AddAsync(transaction, cancellationToken);

                // Current inventory and its ledger entry must succeed or fail together.
                await _uow.SaveChangesAsync(cancellationToken);

                _logger.LogInformation(
                    "Ghi nhận thẻ kho thành công: Giao dịch #{TransactionId} | Dự án {ProjectId} | Vật tư {MaterialId} | Tham chiếu {ReferenceType} #{ReferenceId}",
                    transaction.TransactionId,
                    projectId,
                    materialId,
                    referenceType,
                    referenceId);

                return inventory;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogWarning(
                    ex,
                    "Phát hiện xung đột đồng thời khi cập nhật tồn kho Vật tư {MaterialId} tại Dự án {ProjectId}.",
                    materialId,
                    projectId);
                throw;
            }
            catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex))
            {
                _logger.LogWarning(
                    ex,
                    "Hai yêu cầu cùng khởi tạo tồn kho Vật tư {MaterialId} tại Dự án {ProjectId}.",
                    materialId,
                    projectId);

                throw new DbUpdateConcurrencyException(
                    "Tồn kho vừa được khởi tạo bởi một phiên làm việc khác. Vui lòng tải lại dữ liệu và thực hiện lại.",
                    ex);
            }
        }

        private static void EnsureSufficientStock(
            long materialId,
            decimal currentQuantity,
            decimal quantityChange)
        {
            if (currentQuantity + quantityChange >= 0)
            {
                return;
            }

            throw new BusinessException(
                ErrorCodes.InsufficientStock,
                $"Không đủ tồn kho cho vật tư ID {materialId}. "
                + $"Tồn kho hiện tại: {currentQuantity}, yêu cầu giảm: {-quantityChange}.");
        }

        private static bool IsUniqueConstraintViolation(DbUpdateException exception)
        {
            Exception? current = exception;

            while (current != null)
            {
                if (current is SqlException sqlException
                    && (sqlException.Number == 2601 || sqlException.Number == 2627))
                {
                    return true;
                }

                current = current.InnerException;
            }

            return false;
        }
    }
}
