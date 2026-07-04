namespace BPG.Domain.Entities;

public class MaterialReturn : BaseEntity
{
    public long MaterialReturnId { get; set; }

    /// <summary>
    /// Mã phiếu hoàn trả nghiệp vụ, ví dụ: PTra-20240630-A3F8B2.
    /// Sinh tự động khi tạo phiếu. Dùng để in phiếu, tra cứu và đối chiếu kiểm toán.
    /// </summary>
    public string ReturnNo { get; set; } = string.Empty;

    /// <summary>
    /// Liên kết tới phiếu xuất kho gốc mà vật tư được hoàn trả từ đó.
    /// Đảm bảo tính truy vết: biết rõ hoàn trả từ phiếu xuất nào, cho task nào.
    /// </summary>
    public long OriginalIssuanceId { get; set; }

    /// <summary>
    /// Lý do hoàn trả, ví dụ: "Dư sau khi thi công tầng 2 – không dùng hết".
    /// </summary>
    public string Reason { get; set; } = string.Empty;

    public MaterialIssuance OriginalIssuance { get; set; } = null!;
    public ICollection<MaterialReturnItem> Items { get; set; } = new List<MaterialReturnItem>();
}
