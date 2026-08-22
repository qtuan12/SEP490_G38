using BPG.Application.Features.MaterialRequests.Queries;
using FluentValidation;

namespace BPG.Application.Features.MaterialRequests.Validators;

public sealed class GetMaterialRequestAssessmentQueryValidator
    : AbstractValidator<GetMaterialRequestAssessmentQuery>
{
    public GetMaterialRequestAssessmentQueryValidator()
    {
        RuleFor(query => query.RequestId).GreaterThan(0);
    }
}
