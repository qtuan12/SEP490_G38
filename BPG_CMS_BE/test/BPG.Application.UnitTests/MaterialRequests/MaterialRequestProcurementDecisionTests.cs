using BPG.Domain.Constants;
using FluentAssertions;

namespace BPG.Application.UnitTests.MaterialRequests;

public sealed class MaterialRequestProcurementDecisionTests
{
    [Theory]
    [InlineData(MaterialRequestProcurementDecision.ExternalPurchase, BOQCheckStatus.WithinBOQ, MaterialRequestStatus.Approved)]
    [InlineData(MaterialRequestProcurementDecision.ExternalPurchase, BOQCheckStatus.OverBOQ, MaterialRequestStatus.WaitingApproval)]
    [InlineData(MaterialRequestProcurementDecision.InternalTransfer, BOQCheckStatus.WithinBOQ, MaterialRequestStatus.Rejected)]
    [InlineData(MaterialRequestProcurementDecision.InternalTransfer, BOQCheckStatus.OverBOQ, MaterialRequestStatus.Rejected)]
    [InlineData(MaterialRequestProcurementDecision.WaitSupply, BOQCheckStatus.WithinBOQ, MaterialRequestStatus.Rejected)]
    [InlineData(MaterialRequestProcurementDecision.NeedMoreInfo, BOQCheckStatus.WithinBOQ, MaterialRequestStatus.Rejected)]
    [InlineData(MaterialRequestProcurementDecision.NotApproved, BOQCheckStatus.WithinBOQ, MaterialRequestStatus.Rejected)]
    public void ResolveTechnicalStatus_ShouldFollowProcurementDecisionMatrix(
        string decision,
        string boqCheckStatus,
        string expectedStatus)
    {
        var result = MaterialRequestProcurementDecision.ResolveTechnicalStatus(decision, boqCheckStatus);

        result.Should().Be(expectedStatus);
    }

    [Fact]
    public void ResolveTechnicalStatus_InvalidDecision_ShouldThrow()
    {
        var act = () => MaterialRequestProcurementDecision.ResolveTechnicalStatus("Unknown", BOQCheckStatus.WithinBOQ);

        act.Should().Throw<ArgumentException>();
    }
}
