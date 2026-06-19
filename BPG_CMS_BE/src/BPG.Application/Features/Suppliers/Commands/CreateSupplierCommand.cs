using BPG.Application.DTOs.Suppliers;
using MediatR;

namespace BPG.Application.Features.Suppliers.Commands
{
    public record CreateSupplierCommand(
        string SupplierName,
        string? ContactInfo,
        string? Address,
        string? ServiceArea,
        decimal? Rating,
        string? EvaluationNote,
        string CollaborationStatus
    ) : IRequest<SupplierDto>;
}
