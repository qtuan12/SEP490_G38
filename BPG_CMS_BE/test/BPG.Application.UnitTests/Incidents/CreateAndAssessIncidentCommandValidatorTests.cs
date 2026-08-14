using BPG.Application.Features.Incidents.Commands.CreateAndAssessIncident;
using FluentAssertions;

namespace BPG.Application.UnitTests.Incidents;

public class CreateAndAssessIncidentCommandValidatorTests
{
    private readonly CreateAndAssessIncidentCommandValidator _validator = new();

    [Fact]
    public void UTCID01_Validate_UnknownIncidentType_ShouldReturnIncidentTypeError()
    {
        var command = ValidConstructionCommand() with { IncidentType = "Unknown" };

        var result = _validator.Validate(command);

        result.Errors.Should().Contain(error => error.PropertyName == nameof(command.IncidentType));
    }

    [Fact]
    public void UTCID02_Validate_InventoryIncidentWithoutDamageDescription_ShouldReturnDamageDescriptionError()
    {
        var command = new CreateAndAssessIncidentCommand(
            100, null, 200, "InventoryDamage", "Vật tư bị hư", null,
            null, null, null, null, false);

        var result = _validator.Validate(command);

        result.Errors.Should().Contain(error => error.PropertyName == nameof(command.DamageDescription));
    }

    [Fact]
    public void UTCID03_Validate_EmergencyInventoryIncident_ShouldReturnEmergencyError()
    {
        var command = new CreateAndAssessIncidentCommand(
            100, null, 200, "InventoryLoss", "Mất vật tư", "Thiếu 10 bao xi măng",
            null, null, null, null, true);

        var result = _validator.Validate(command);

        result.Errors.Should().Contain(error => error.PropertyName == nameof(command.IsEmergency));
    }

    [Fact]
    public void UTCID04_Validate_ValidInventoryIncident_ShouldHaveNoErrors()
    {
        var command = new CreateAndAssessIncidentCommand(
            100, null, 200, "InventoryLoss", "Mất vật tư", "Thiếu 10 bao xi măng",
            null, null, null, null, false);

        var result = _validator.Validate(command);

        result.IsValid.Should().BeTrue();
    }

    private static CreateAndAssessIncidentCommand ValidConstructionCommand()
        => new(100, 300, 200, "Construction", "Máy hỏng động cơ", null,
            null, null, null, null, false);
}
