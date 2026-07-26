namespace BPG.Application.IServices;

public sealed record SurplusMaterialSupplier(long SupplierId, string SupplierName);

public interface ISurplusMaterialSupplierService
{
    Task<IReadOnlyList<SurplusMaterialSupplier>> GetApprovedSuppliersAsync(
        long projectId,
        CancellationToken cancellationToken);

    Task<IReadOnlyDictionary<long, SurplusMaterialSupplier>> GetLatestApprovedSuppliersAsync(
        long projectId,
        IReadOnlyCollection<long> materialIds,
        CancellationToken cancellationToken);
}
