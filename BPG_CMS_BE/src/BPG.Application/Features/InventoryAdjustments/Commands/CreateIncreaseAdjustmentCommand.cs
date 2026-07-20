using BPG.Application.Common.Models;
using FluentValidation;
using MediatR;
using System.Collections.Generic;

namespace BPG.Application.Features.InventoryAdjustments.Commands
{
    public class CreateIncreaseAdjustmentCommand : IRequest<ApiResponse<long>>
    {
        public long ProjectId { get; set; }
        public long PhaseId { get; set; }
        public string Reason { get; set; } = string.Empty;
        public string? Description { get; set; }
        public List<AdjustmentItemRequest> Items { get; set; } = new List<AdjustmentItemRequest>();
    }

    public class AdjustmentItemRequest
    {
        public long MaterialId { get; set; }
        public decimal Quantity { get; set; }
    }

    public class CreateIncreaseAdjustmentCommandValidator : AbstractValidator<CreateIncreaseAdjustmentCommand>
    {
        public CreateIncreaseAdjustmentCommandValidator()
        {
            RuleFor(x => x.ProjectId).GreaterThan(0).WithMessage("ERR_VALIDATION");
            RuleFor(x => x.PhaseId).GreaterThan(0).WithMessage("ERR_VALIDATION");
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
