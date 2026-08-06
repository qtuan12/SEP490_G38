namespace BPG.Domain.Entities;

public class DirectPurchaseItem
{
    public long DirectPurchaseItemId { get; set; }
    public long DirectPurchaseId { get; set; }
    public long MaterialId { get; set; }
    public int UnitId { get; set; }
    public decimal Quantity { get; set; }
    public decimal ConversionRate { get; set; } = 1;
    public decimal UnitPrice { get; set; }
    public decimal LineTotal { get; set; }
    /// <summary>
    /// Dòng này vượt SỐ LƯỢNG định mức BOQ của Phase. Vật tư ngoài BOQ không mua khẩn cấp được nên
    /// không rơi vào đây, trừ khi dòng BOQ bị xóa sau lúc soạn nháp.
    /// </summary>
    public bool IsOverBOQ { get; set; }
    public string? Explanation { get; set; }

    public DirectPurchaseRequest DirectPurchaseRequest { get; set; } = null!;
    public MaterialCatalog Material { get; set; } = null!;
    public Unit Unit { get; set; } = null!;
}
