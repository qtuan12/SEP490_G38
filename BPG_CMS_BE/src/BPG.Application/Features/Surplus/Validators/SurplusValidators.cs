using BPG.Application.Features.Surplus.Commands;
using BPG.Domain.Constants;
using FluentValidation;

namespace BPG.Application.Features.Surplus.Validators;

public class CreateSurplusRequestValidator : AbstractValidator<CreateSurplusRequestCommand>
{
    public CreateSurplusRequestValidator()
    {
        RuleFor(x => x.ProjectId).GreaterThan(0).WithMessage(ValidationMessages.MustBeGreaterThanZero);
        RuleFor(x => x.Reason).MaximumLength(500).WithMessage(ValidationMessages.MaxLength);
    }
}

public class CreateSurplusReturnActionValidator : AbstractValidator<CreateSurplusReturnActionCommand>
{
    public CreateSurplusReturnActionValidator()
    {
        RuleFor(x => x.SurplusRequestItemId).GreaterThan(0).WithMessage(ValidationMessages.MustBeGreaterThanZero);
        RuleFor(x => x.ReturnQuantity).GreaterThan(0).WithMessage(ValidationMessages.MustBeGreaterThanZero);
        RuleFor(x => x.RefundAmount).GreaterThanOrEqualTo(0).When(x => x.RefundAmount.HasValue).WithMessage(ValidationMessages.MustBePositive);
    }
}

public class CreateSurplusTransferActionValidator : AbstractValidator<CreateSurplusTransferActionCommand>
{
    public CreateSurplusTransferActionValidator()
    {
        RuleFor(x => x.SurplusRequestItemId).GreaterThan(0).WithMessage(ValidationMessages.MustBeGreaterThanZero);
        RuleFor(x => x.ToProjectId).GreaterThan(0).WithMessage(ValidationMessages.MustBeGreaterThanZero);
        RuleFor(x => x.TransferQuantity).GreaterThan(0).WithMessage(ValidationMessages.MustBeGreaterThanZero);
    }
}

public class CreateSurplusLiquidationActionValidator : AbstractValidator<CreateSurplusLiquidationActionCommand>
{
    public CreateSurplusLiquidationActionValidator()
    {
        RuleFor(x => x.SurplusRequestItemId).GreaterThan(0).WithMessage(ValidationMessages.MustBeGreaterThanZero);
        RuleFor(x => x.BuyerName).NotEmpty().WithMessage(ValidationMessages.Required).MaximumLength(200).WithMessage(ValidationMessages.MaxLength);
        RuleFor(x => x.LiquidationQuantity).GreaterThan(0).WithMessage(ValidationMessages.MustBeGreaterThanZero);
        RuleFor(x => x.TotalAmount).GreaterThanOrEqualTo(0).WithMessage(ValidationMessages.MustBePositive);
    }
}
