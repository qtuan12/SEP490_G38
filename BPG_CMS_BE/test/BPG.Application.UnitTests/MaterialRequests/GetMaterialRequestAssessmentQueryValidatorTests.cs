using BPG.Application.Features.MaterialRequests.Queries;
using BPG.Application.Features.MaterialRequests.Validators;
using FluentAssertions;

namespace BPG.Application.UnitTests.MaterialRequests;

public sealed class GetMaterialRequestAssessmentQueryValidatorTests
{
    private readonly GetMaterialRequestAssessmentQueryValidator _validator = new();

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void UTCID09_Validate_NonPositiveRequestId_ShouldFail(long requestId)
    {
        var result = _validator.Validate(new GetMaterialRequestAssessmentQuery(requestId));

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(error => error.PropertyName == "RequestId");
    }

    [Fact]
    public void UTCID10_Validate_PositiveRequestId_ShouldPass()
    {
        var result = _validator.Validate(new GetMaterialRequestAssessmentQuery(1));

        result.IsValid.Should().BeTrue();
    }
}
