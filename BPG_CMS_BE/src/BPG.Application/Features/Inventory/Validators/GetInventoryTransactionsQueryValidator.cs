using BPG.Application.Features.Inventory.Queries;
using FluentValidation;

namespace BPG.Application.Features.Inventory.Validators
{
    public class GetInventoryTransactionsQueryValidator : AbstractValidator<GetInventoryTransactionsQuery>
    {
        public GetInventoryTransactionsQueryValidator()
        {
            RuleFor(x => x.ProjectId)
                .GreaterThan(0).WithMessage("Mã dự án (ProjectId) không hợp lệ.");

            RuleFor(x => x.MaterialId)
                .GreaterThan(0).When(x => x.MaterialId.HasValue).WithMessage("Mã vật tư không hợp lệ.");

            RuleFor(x => x.PageNumber)
                .GreaterThanOrEqualTo(1).WithMessage("Số trang phải lớn hơn hoặc bằng 1.");

            RuleFor(x => x.PageSize)
                .InclusiveBetween(1, 100).WithMessage("Kích thước trang phải từ 1 đến 100.");
        }
    }
}
