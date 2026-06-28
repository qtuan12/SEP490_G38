using BPG.Application.Features.GoodsReceipts.Commands;
using FluentValidation;

namespace BPG.Application.Features.GoodsReceipts.Validators
{
    public class CreateGoodsReceiptCommandValidator : AbstractValidator<CreateGoodsReceiptCommand>
    {
        public CreateGoodsReceiptCommandValidator()
        {
            RuleFor(x => x.POId)
                .GreaterThan(0).WithMessage("Mã đơn mua hàng (POId) không hợp lệ.");

            RuleFor(x => x.DelivererInfo)
                .MaximumLength(200).WithMessage("Thông tin người giao hàng không vượt quá 200 ký tự.");

            RuleFor(x => x.DeliveryDocNo)
                .MaximumLength(100).WithMessage("Số hóa đơn/chứng từ giao hàng không vượt quá 100 ký tự.");

            RuleFor(x => x.Images)
                .NotEmpty().WithMessage("Bắt buộc đính kèm ít nhất 1 ảnh hóa đơn/chứng từ thực tế.");

            RuleFor(x => x.Items)
                .NotEmpty().WithMessage("Danh sách vật tư nhập kho không được để trống.")
                .Must(items => items == null || items.Select(i => i.MaterialId).Distinct().Count() == items.Count)
                .WithMessage("Danh sách vật tư nhập kho không được chứa vật tư trùng lặp.");

            RuleForEach(x => x.Items).ChildRules(item =>
            {
                item.RuleFor(i => i.MaterialId)
                    .GreaterThan(0).WithMessage("Mã vật tư không hợp lệ.");

                item.RuleFor(i => i.UnitId)
                    .GreaterThan(0).WithMessage("Mã đơn vị tính không hợp lệ.");

                item.RuleFor(i => i.Quantity)
                    .GreaterThan(0).WithMessage("Số lượng nhập kho phải lớn hơn 0.");
            });
        }
    }
}
