using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Entities;
using BPG.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Infrastructure.Services
{
    public class InventoryService : IInventoryService
    {
        private readonly IUnitOfWork _uow;

        public InventoryService(IUnitOfWork uow)
        {
            _uow = uow;
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
            }
            else
            {
                inv.Quantity += quantityChange;
                inv.LastUpdated = DateTime.UtcNow;
                _uow.Repository<CurrentInventory>().Update(inv);
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

            return inv;
        }
    }
}
