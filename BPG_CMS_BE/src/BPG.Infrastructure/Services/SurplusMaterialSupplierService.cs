using BPG.Application.IRepositories;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using BPG.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace BPG.Infrastructure.Services;

public sealed class SurplusMaterialSupplierService : ISurplusMaterialSupplierService
{
    private readonly IUnitOfWork _unitOfWork;

    public SurplusMaterialSupplierService(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<IReadOnlyList<SurplusMaterialSupplier>> GetApprovedSuppliersAsync(
        long projectId,
        CancellationToken cancellationToken)
    {
        var suppliers = await _unitOfWork.Repository<GoodsReceipt>()
            .Query()
            .AsNoTracking()
            .Where(receipt =>
                receipt.Status == GoodsReceiptStatus.Approved
                && receipt.PurchaseOrder.SupplierId != null
                && (receipt.PurchaseOrder.ProjectId == projectId
                    || (receipt.PurchaseOrder.Request != null
                        && receipt.PurchaseOrder.Request.Phase.ProjectId == projectId)))
            .Select(receipt => new
            {
                SupplierId = receipt.PurchaseOrder.SupplierId!.Value,
                receipt.PurchaseOrder.Supplier!.SupplierName
            })
            .ToListAsync(cancellationToken);

        return suppliers
            .GroupBy(supplier => supplier.SupplierId)
            .Select(group => new SurplusMaterialSupplier(
                group.Key,
                group.First().SupplierName))
            .OrderBy(supplier => supplier.SupplierName)
            .ToList();
    }

    public async Task<IReadOnlyDictionary<long, SurplusMaterialSupplier>> GetLatestApprovedSuppliersAsync(
        long projectId,
        IReadOnlyCollection<long> materialIds,
        CancellationToken cancellationToken)
    {
        if (materialIds.Count == 0)
            return new Dictionary<long, SurplusMaterialSupplier>();

        var supplierReceipts = await _unitOfWork.Repository<GoodsReceiptItem>()
            .Query()
            .AsNoTracking()
            .Where(item =>
                materialIds.Contains(item.MaterialId)
                && item.Receipt.Status == GoodsReceiptStatus.Approved
                && item.Receipt.PurchaseOrder.SupplierId != null
                && (item.Receipt.PurchaseOrder.ProjectId == projectId
                    || (item.Receipt.PurchaseOrder.Request != null
                        && item.Receipt.PurchaseOrder.Request.Phase.ProjectId == projectId)))
            .OrderByDescending(item => item.Receipt.CreatedAt)
            .ThenByDescending(item => item.Receipt.PurchaseOrder.OrderDate)
            .Select(item => new
            {
                item.MaterialId,
                SupplierId = item.Receipt.PurchaseOrder.SupplierId!.Value,
                item.Receipt.PurchaseOrder.Supplier!.SupplierName
            })
            .ToListAsync(cancellationToken);

        return supplierReceipts
            .GroupBy(item => item.MaterialId)
            .ToDictionary(
                group => group.Key,
                group => new SurplusMaterialSupplier(
                    group.First().SupplierId,
                    group.First().SupplierName));
    }
}
