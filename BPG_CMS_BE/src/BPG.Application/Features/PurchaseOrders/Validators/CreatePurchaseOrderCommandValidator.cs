using BPG.Application.Features.PurchaseOrders.Commands;
using BPG.Domain.Common;
using FluentValidation;

namespace BPG.Application.Features.PurchaseOrders.Validators
{
    public class CreatePurchaseOrderCommandValidator : AbstractValidator<CreatePurchaseOrderCommand>
    {
        public CreatePurchaseOrderCommandValidator()
        {
            RuleFor(x => x.ProjectId).GreaterThan(0).WithMessage("Vui lòng chọn dự án.");
            // Đơn hàng luôn gửi tới một nhà cung cấp cụ thể — form tạo PO cũng đánh dấu trường này bắt buộc.
            RuleFor(x => x.SupplierId)
                .NotNull().WithMessage("Vui lòng chọn nhà cung cấp.")
                .GreaterThan(0).WithMessage("Vui lòng chọn nhà cung cấp.");
            // So theo ngày giờ Việt Nam, không dùng DateTime.Today (giờ hệ điều hành của máy chủ):
            // server chạy UTC sẽ hiểu sai "hôm nay" trong khoảng 00:00-07:00 giờ VN.
            RuleFor(x => x.OrderDate)
                .NotEmpty()
                .Must(d => d >= VietnamTime.Today)
                .WithMessage("Ngày đơn hàng không được là ngày trong quá khứ.");
            RuleFor(x => x.RequestId).GreaterThan(0).WithMessage("Phải chọn một yêu cầu vật tư.");
            RuleFor(x => x.ExpectedDeliveryDate)
                .Must((command, deliveryDate) => !deliveryDate.HasValue || deliveryDate.Value >= command.OrderDate)
                .WithMessage("Hạn giao hàng không được trước ngày đơn hàng.");
            RuleFor(x => x.Items).NotEmpty().WithMessage("Đơn hàng phải có ít nhất một dòng vật tư.");
            RuleFor(x => x.PONumber).MaximumLength(50).When(x => !string.IsNullOrEmpty(x.PONumber));
            RuleForEach(x => x.Items).ChildRules(item =>
            {
                item.RuleFor(i => i.MaterialId).GreaterThan(0);
                item.RuleFor(i => i.UnitId).GreaterThan(0);
                item.RuleFor(i => i.Quantity).GreaterThan(0).WithMessage("Số lượng đặt phải lớn hơn 0.");
                // Đơn hàng gửi nhà cung cấp thì phải có giá: bỏ trống sẽ thành đơn trị giá 0đ,
                // kéo theo sai lệch báo cáo chi phí. Cùng mức chặt với phiếu mua khẩn cấp.
                item.RuleFor(i => i.UnitPrice).GreaterThan(0).WithMessage("Đơn giá phải lớn hơn 0.");
            });
        }
    }
}
