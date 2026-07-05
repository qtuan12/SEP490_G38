namespace BPG.Domain.Entities;

public class MaterialReturnItem
{
    public long ReturnItemId { get; set; }
    public long MaterialReturnId { get; set; }
    public long MaterialId { get; set; }
    public int UnitId { get; set; }

    /// <summary>
    /// Số lượng hoàn trả theo đơn vị hiển thị (UnitId).
    /// </summary>
    public decimal Quantity { get; set; }

    /// <summary>
    /// Tỉ lệ quy đổi từ đơn vị hiển thị về đơn vị cơ bản của vật tư.
    /// BaseQty = Quantity / ConversionRate.
    /// </summary>
    public decimal ConversionRate { get; set; } = 1;

    public MaterialReturn Return { get; set; } = null!;
    public MaterialCatalog Material { get; set; } = null!;
    public Unit Unit { get; set; } = null!;
}
