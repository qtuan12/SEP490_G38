namespace BPG.Domain.Entities;

public class MaterialIssuance : BaseEntity
{
    public long MaterialIssuanceId { get; set; }
    /// <summary>
    /// Mã phiếu xuất kho nghiệp vụ, ví dụ: PXK-20240624-A3F8.
    /// Được sinh tự động khi tạo phiếu. Dùng để in phiếu, tra cứu và đối chiếu kiểm toán.
    /// </summary>
    public string IssuanceNo { get; set; } = string.Empty;
    public long TaskId { get; set; }
    public string Purpose { get; set; } = string.Empty;

    public ProjectTask Task { get; set; } = null!;
    public ICollection<MaterialIssuanceItem> Items { get; set; } = new List<MaterialIssuanceItem>();
}
