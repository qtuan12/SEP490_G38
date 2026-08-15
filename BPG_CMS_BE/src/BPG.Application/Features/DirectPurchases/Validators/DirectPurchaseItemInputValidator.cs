using BPG.Application.DTOs.DirectPurchases;
using FluentValidation;

namespace BPG.Application.Features.DirectPurchases.Validators
{
    /// <summary>
    /// Dùng chung cho tạo và sửa nháp. Ngưỡng phải khớp với chốt chặn ở bước Gửi phiếu
    /// (SubmitDirectPurchaseCommandHandler) để một dòng đã lưu được thì cũng gửi được.
    /// </summary>
    public class DirectPurchaseItemInputValidator : AbstractValidator<DirectPurchaseItemInput>
    {
        public DirectPurchaseItemInputValidator()
        {
            RuleFor(i => i.MaterialId)
                .GreaterThan(0).WithMessage("Vật tư không hợp lệ.");

            // UnitId = 0 là hợp lệ: quy ước để backend tự suy ra đơn vị tính từ dòng BOQ
            // hoặc đơn vị cơ bản của vật tư.
            RuleFor(i => i.UnitId)
                .GreaterThanOrEqualTo(0).WithMessage("Đơn vị tính không hợp lệ.");

            RuleFor(i => i.Quantity)
                .GreaterThan(0).WithMessage("Số lượng phải lớn hơn 0.");

            RuleFor(i => i.UnitPrice)
                .GreaterThan(0).WithMessage("Đơn giá phải lớn hơn 0.");
        }
    }
}
