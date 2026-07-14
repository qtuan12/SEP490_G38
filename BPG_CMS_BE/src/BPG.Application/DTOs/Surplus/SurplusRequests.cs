using Microsoft.AspNetCore.Http;
using System.Collections.Generic;

namespace BPG.Application.DTOs.Surplus;

public record CreateSurplusRequestBody(string? Reason);

public record CreateSurplusTransferBody(long ToProjectId, decimal TransferQuantity);
public record ReviewSurplusTransferBody(bool IsApproved);

public class CreateSurplusReturnForm
{
    public long? SupplierId { get; set; }
    public decimal ReturnQuantity { get; set; }
    public decimal? RefundAmount { get; set; }
    public string? Note { get; set; }
    public List<IFormFile>? Attachments { get; set; }
}

public class CreateSurplusLiquidationForm
{
    public string BuyerName { get; set; } = string.Empty;
    public decimal LiquidationQuantity { get; set; }
    public decimal TotalAmount { get; set; }
    public List<IFormFile>? Attachments { get; set; }
}

public class DispatchTransferForm
{
    public List<IFormFile>? Attachments { get; set; }
}

public class ReceiveTransferForm
{
    public List<IFormFile>? Attachments { get; set; }
}
