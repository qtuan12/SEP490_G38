namespace BPG.Domain.Entities;

public class Unit : BaseEntity
{
    public int UnitId { get; set; }
    public string UnitCode { get; set; } = string.Empty;
    public string UnitName { get; set; } = string.Empty;

    public ICollection<MaterialCatalog> MaterialsAsBaseUnit { get; set; } = new List<MaterialCatalog>();
    public ICollection<MaterialConversion> AlternativeConversions { get; set; } = new List<MaterialConversion>();
}
