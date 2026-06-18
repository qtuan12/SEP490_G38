namespace BPG.Application.Features.MaterialCatalogs.DTOs;

public class UpdateMaterialCatalogRequest
{
    public long CategoryId { get; set; }
    public int BaseUnitId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Specification { get; set; }
}
