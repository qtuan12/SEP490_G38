using BPG.Application.DTOs.DirectPurchases;
using BPG.Application.Common.Authorization;
using BPG.Domain.Constants;
using MediatR;

namespace BPG.Application.Features.DirectPurchases.Commands
{
    public class CreateDirectPurchaseRequestCommand : IRequest<long>, IProjectResourceRequirement
    {
        public long ProjectId { get; set; }
        public ProjectResource ProjectResource => ProjectResource.Project(ProjectId);
        public string RequiredPermission => ProjectPermission.View;
        public long PhaseId { get; set; }
        public long? TaskId { get; set; }
        public string Reason { get; set; } = string.Empty;
        public DateTime PurchaseDate { get; set; }
        public List<DirectPurchaseItemInput> Items { get; set; } = new();
        public List<string> InvoicePhotoUrls { get; set; } = new();
    }
}
