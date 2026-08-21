namespace BPG.Application.DTOs.MaterialRequests;

public sealed class MaterialRequestAssessmentDto
{
    public long RequestId { get; init; }
    public long ProjectId { get; init; }
    public List<MaterialRequestAssessmentItemDto> Items { get; init; } = new();
}

public sealed class MaterialRequestAssessmentItemDto
{
    public long RequestItemId { get; init; }
    public long MaterialId { get; init; }
    public int UnitId { get; init; }
    public string UnitName { get; init; } = string.Empty;
    public decimal ProjectInventoryQuantity { get; init; }
    public List<MaterialRequestActiveSupplyDto> ActiveSupplies { get; init; } = new();
    public List<MaterialRequestInternalSourceDto> InternalSources { get; init; } = new();
    public MaterialRequestLastPurchasePriceDto? LastPurchasePrice { get; init; }
}

public sealed class MaterialRequestActiveSupplyDto
{
    public long POId { get; init; }
    public string PONumber { get; init; } = string.Empty;
    public decimal RemainingQuantity { get; init; }
}

public sealed class MaterialRequestInternalSourceDto
{
    public long ProjectId { get; init; }
    public string ProjectName { get; init; } = string.Empty;
    public decimal AvailableQuantity { get; init; }
}

public sealed class MaterialRequestLastPurchasePriceDto
{
    public long POId { get; init; }
    public string PONumber { get; init; } = string.Empty;
    public decimal UnitPrice { get; init; }
    public DateOnly OrderDate { get; init; }
}
