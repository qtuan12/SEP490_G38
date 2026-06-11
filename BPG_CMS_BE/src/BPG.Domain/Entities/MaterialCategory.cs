namespace BPG.Domain.Entities;

public class MaterialCategory : BaseEntity
{
    public long CategoryId { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public string? Description { get; set; }

    public ICollection<MaterialCatalog> Materials { get; set; } = new List<MaterialCatalog>();
}
