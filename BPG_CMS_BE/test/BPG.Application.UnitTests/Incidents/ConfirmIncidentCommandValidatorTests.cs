using BPG.Application.Features.Incidents.Commands.ConfirmIncident;
using FluentAssertions;

namespace BPG.Application.UnitTests.Incidents;

public class ConfirmIncidentCommandValidatorTests
{
    private readonly ConfirmIncidentCommandValidator _validator = new();

    [Fact]
    public void UTCID01_Validate_ReworkEndingEarlierOnSameCalendarDay_ShouldHaveNoDateError()
    {
        var command = ReworkCommand(
            new DateTime(2026, 8, 14, 17, 0, 0),
            new DateTime(2026, 8, 14, 8, 0, 0));

        var result = _validator.Validate(command);

        result.Errors.Should().NotContain(error =>
            error.PropertyName == nameof(command.ReworkTaskEndDate));
    }

    [Fact]
    public void UTCID02_Validate_ReworkEndingOnEarlierCalendarDay_ShouldReturnDateError()
    {
        var command = ReworkCommand(
            new DateTime(2026, 8, 14, 8, 0, 0),
            new DateTime(2026, 8, 13, 17, 0, 0));

        var result = _validator.Validate(command);

        result.Errors.Should().Contain(error =>
            error.PropertyName == nameof(command.ReworkTaskEndDate));
    }

    private static ConfirmIncidentCommand ReworkCommand(DateTime startDate, DateTime endDate)
        => new(
            IncidentId: 50,
            CreateReworkTask: true,
            ReworkTaskName: "Làm lại móng",
            ReworkTaskStartDate: startDate,
            ReworkTaskEndDate: endDate,
            ReworkAssigneeId: 10,
            DecreaseProgressTo: null,
            DecreaseProgressReason: null,
            HandlingInstruction: "Khắc phục",
            RecoveryPlanText: null,
            RecoveryEstimateCost: null,
            Decision: null);
}
