using BPG.Application.Features.MaterialRequests.Commands;
using BPG.Application.Features.MaterialRequests.Validators;
using BPG.Domain.Constants;
using FluentAssertions;

namespace BPG.Application.UnitTests.MaterialRequests;

public sealed class ProcessMaterialRequestByAccountantCommandValidatorTests
{
    private readonly ProcessMaterialRequestByAccountantCommandValidator _validator = new();

    [Fact]
    public async Task Validate_ValidCommand_ShouldSucceed()
    {
        var command = new ProcessMaterialRequestByAccountantCommand(
            1,
            MaterialRequestProcurementDecision.ExternalPurchase,
            "Có căn cứ từ tồn kho và tiến độ.");

        var result = await _validator.ValidateAsync(command);

        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData(0, MaterialRequestProcurementDecision.ExternalPurchase, "Cơ sở hợp lệ")]
    [InlineData(1, "Unknown", "Cơ sở hợp lệ")]
    [InlineData(1, MaterialRequestProcurementDecision.ExternalPurchase, "   ")]
    [InlineData(1, MaterialRequestProcurementDecision.ExternalPurchase, "1234")]
    public async Task Validate_InvalidInput_ShouldFail(long requestId, string decision, string note)
    {
        var command = new ProcessMaterialRequestByAccountantCommand(requestId, decision, note);

        var result = await _validator.ValidateAsync(command);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public async Task Validate_NoteOverMaximumLength_ShouldFail()
    {
        var command = new ProcessMaterialRequestByAccountantCommand(
            1,
            MaterialRequestProcurementDecision.ExternalPurchase,
            new string('a', 1001));

        var result = await _validator.ValidateAsync(command);

        result.IsValid.Should().BeFalse();
    }
}
