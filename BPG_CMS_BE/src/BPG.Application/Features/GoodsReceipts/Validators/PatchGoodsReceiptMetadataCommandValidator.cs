using BPG.Application.Features.GoodsReceipts.Commands;
using FluentValidation;

namespace BPG.Application.Features.GoodsReceipts.Validators
{
    public class PatchGoodsReceiptMetadataCommandValidator : AbstractValidator<PatchGoodsReceiptMetadataCommand>
    {
        public PatchGoodsReceiptMetadataCommandValidator()
        {
            RuleFor(x => x.ReceiptId)
                .GreaterThan(0).WithMessage("Mã phiếu nhập kho (ReceiptId) không hợp lệ.");

            RuleFor(x => x.DelivererInfo)
                .MaximumLength(200).WithMessage("Thông tin người giao hàng không vượt quá 200 ký tự.");

            RuleFor(x => x.DeliveryDocNo)
                .MaximumLength(100).WithMessage("Số hóa đơn/chứng từ giao hàng không vượt quá 100 ký tự.");

            RuleFor(x => x.Images)
                .Must(images => images == null || images.Count <= 5)
                .WithMessage("Tối đa chỉ được đính kèm 5 hình ảnh chứng từ giao nhận.");
        }
    }
}
