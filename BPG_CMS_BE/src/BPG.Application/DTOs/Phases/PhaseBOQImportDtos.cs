namespace BPG.Application.DTOs.Phases;

public class PreviewPhaseBOQImportRequest
{
    public List<PhaseBOQImportRowRequest> Rows { get; set; } = new();
}

public class PhaseBOQImportRowRequest
{
    public int RowNumber { get; set; }
    public string MaterialCode { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public string UnitCode { get; set; } = string.Empty;
}

public class PhaseBOQImportPreviewDto
{
    public bool CanApply { get; set; }
    public int NewCount { get; set; }
    public int UpdatedCount { get; set; }
    public int UnchangedCount { get; set; }
    public int DeletedCount { get; set; }
    public int ErrorCount { get; set; }
    public List<PhaseBOQImportRowResultDto> Rows { get; set; } = new();
    public List<PhaseBOQImportMergedItemDto> MergedItems { get; set; } = new();
}

public class PhaseBOQImportRowResultDto
{
    public int RowNumber { get; set; }
    public string MaterialCode { get; set; } = string.Empty;
    public string MaterialName { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public string UnitCode { get; set; } = string.Empty;
    public string UnitName { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public List<string> Errors { get; set; } = new();
}

public class PhaseBOQImportMergedItemDto
{
    public long MaterialId { get; set; }
    public string MaterialCode { get; set; } = string.Empty;
    public string MaterialName { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public int UnitId { get; set; }
    public string UnitCode { get; set; } = string.Empty;
    public string UnitName { get; set; } = string.Empty;
}
