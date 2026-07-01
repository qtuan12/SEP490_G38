using BPG.Application.Common.Models;
using FluentValidation;
using MediatR;
using System.Collections.Generic;

namespace BPG.Application.Features.InventoryAdjustments.Commands
{
    public class CreateDecreaseAdjustmentCommand : IRequest<ApiResponse<long>>
    {
        public long ProjectId { get; set; }
        public long IncidentId { get; set; } // Decrease requires an Incident
        public string Reason { get; set; } = string.Empty;
        public string? Description { get; set; }
        public List<AdjustmentItemRequest> Items { get; set; } = new List<AdjustmentItemRequest>();
    }

    public class CreateDecreaseAdjustmentCommandValidator : AbstractValidator<CreateDecreaseAdjustmentCommand>
    {
        public CreateDecreaseAdjustmentCommandValidator()
        {
            RuleFor(x => x.ProjectId).GreaterThan(0).WithMessage("ERR_VALIDATION");
            RuleFor(x => x.IncidentId).GreaterThan(0).WithMessage("ERR_VALIDATION");
            RuleFor(x => x.Reason).NotEmpty().WithMessage("ERR_VALIDATION");
            RuleFor(x => x.Items).NotEmpty().WithMessage("ERR_VALIDATION");
            RuleForEach(x => x.Items).ChildRules(items =>
            {
                items.RuleFor(i => i.MaterialId).GreaterThan(0).WithMessage("ERR_VALIDATION");
                items.RuleFor(i => i.Quantity).GreaterThan(0).WithMessage("ERR_VALIDATION");
            });
        }
    }
}
