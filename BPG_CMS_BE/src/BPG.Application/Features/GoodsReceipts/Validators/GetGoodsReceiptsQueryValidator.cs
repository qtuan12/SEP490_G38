using BPG.Application.Features.GoodsReceipts.Queries;
using FluentValidation;

namespace BPG.Application.Features.GoodsReceipts.Validators
{
    public class GetGoodsReceiptsQueryValidator : AbstractValidator<GetGoodsReceiptsQuery>
    {
        public GetGoodsReceiptsQueryValidator()
        {
            RuleFor(x => x.ProjectId)
                .GreaterThan(0).When(x => x.ProjectId.HasValue).WithMessage("Mã dự án (ProjectId) không hợp lệ.");

            RuleFor(x => x.PageNumber)
                .GreaterThanOrEqualTo(1).WithMessage("Số trang phải lớn hơn hoặc bằng 1.");

            RuleFor(x => x.PageSize)
                .InclusiveBetween(1, 100).WithMessage("Kích thước trang phải từ 1 đến 100.");
        }
    }
}
