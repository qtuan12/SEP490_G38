namespace BPG.Application.Features.Surplus.DTOs;

public class SurplusRequestDto
{
    public long SurplusRequestId { get; set; }
    public long ProjectId { get; set; }
    public string ProjectName { get; set; } = string.Empty;
    public string? Reason { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public string CreatedByName { get; set; } = string.Empty;
    public int TotalItems { get; set; }
    public int ProcessedItems { get; set; }
}

public class SurplusRequestDetailDto : SurplusRequestDto
{
    public List<SurplusRequestItemDto> Items { get; set; } = new();
}

public class SurplusRequestItemDto
{
    public long SurplusRequestItemId { get; set; }
    public long SurplusRequestId { get; set; }
    public long MaterialId { get; set; }
    public string MaterialCode { get; set; } = string.Empty;
    public string MaterialName { get; set; } = string.Empty;
    public int UnitId { get; set; }
    public string UnitName { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public decimal ProcessedQuantity { get; set; }
    public string Status { get; set; } = string.Empty;
    public List<SurplusActionSummaryDto> Actions { get; set; } = new();
}

public class SurplusActionSummaryDto
{
    public string ActionType { get; set; } = string.Empty; // ReturnSupplier | Transfer | Liquidation
    public long ActionId { get; set; }
    public string Status { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
}

public class SurplusReturnSupplierDto
{
    public long SurplusReturnSupplierId { get; set; }
    public long SurplusRequestItemId { get; set; }
    public long? SupplierId { get; set; }
    public string? SupplierName { get; set; }
    public decimal ReturnQuantity { get; set; }
    public decimal? RefundAmount { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<BPG.Application.Features.Projects.DTOs.AttachmentDto> Attachments { get; set; } = new();
}

public class SurplusTransferDto
{
    public long SurplusTransferId { get; set; }
    public long SurplusRequestItemId { get; set; }
    public long FromProjectId { get; set; }
    public string FromProjectName { get; set; } = string.Empty;
    public long ToProjectId { get; set; }
    public string ToProjectName { get; set; } = string.Empty;
    public decimal TransferQuantity { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? ApproverName { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public DateTime? DispatchedAt { get; set; }
    public DateTime? ReceivedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<BPG.Application.Features.Projects.DTOs.AttachmentDto> Attachments { get; set; } = new();
}

public class SurplusLiquidationDto
{
    public long SurplusLiquidationId { get; set; }
    public long SurplusRequestItemId { get; set; }
    public string BuyerName { get; set; } = string.Empty;
    public decimal LiquidationQuantity { get; set; }
    public decimal TotalAmount { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<BPG.Application.Features.Projects.DTOs.AttachmentDto> Attachments { get; set; } = new();
}
