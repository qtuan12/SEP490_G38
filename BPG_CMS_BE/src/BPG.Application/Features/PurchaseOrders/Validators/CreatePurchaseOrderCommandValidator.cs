using BPG.Application.Features.PurchaseOrders.Commands;
using FluentValidation;

namespace BPG.Application.Features.PurchaseOrders.Validators
{
    public class CreatePurchaseOrderCommandValidator : AbstractValidator<CreatePurchaseOrderCommand>
    {
        public CreatePurchaseOrderCommandValidator()
        {
            RuleFor(x => x.ProjectId).GreaterThan(0);
            RuleFor(x => x.OrderDate)
                .NotEmpty()
                .Must(d => d.Date >= DateTime.Today)
                .WithMessage("Ngày đơn hàng không được là ngày trong quá khứ.");
            RuleFor(x => x.RequestId).GreaterThan(0).WithMessage("Phải chọn một yêu cầu vật tư.");
            RuleFor(x => x.ExpectedDeliveryDate)
                .Must((command, deliveryDate) => !deliveryDate.HasValue || deliveryDate.Value >= DateOnly.FromDateTime(command.OrderDate.Date))
                .WithMessage("Hạn giao hàng không được trước ngày đơn hàng.");
            RuleFor(x => x.Items).NotEmpty().WithMessage("Đơn hàng phải có ít nhất một dòng vật tư.");
            RuleFor(x => x.PONumber).MaximumLength(50).When(x => !string.IsNullOrEmpty(x.PONumber));
            RuleForEach(x => x.Items).ChildRules(item =>
            {
                item.RuleFor(i => i.MaterialId).GreaterThan(0);
                item.RuleFor(i => i.UnitId).GreaterThan(0);
                item.RuleFor(i => i.Quantity).GreaterThan(0);
                item.RuleFor(i => i.UnitPrice).GreaterThanOrEqualTo(0);
            });
        }
    }
}
