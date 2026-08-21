using BPG.Domain.Constants;
using FluentAssertions;

namespace BPG.Application.UnitTests.DailyLogs;

public class DailyLogSourceTests
{
    [Theory]
    [InlineData("Thi công cốt thép tầng 2", DailyLogSource.Manual)]
    [InlineData("Hệ thống ghi nhận điều chỉnh tiến độ trực tiếp từ 80% thành 70%.", DailyLogSource.DirectAdjustment)]
    [InlineData("Hệ thống ghi nhận giảm tiến độ từ 70% xuống 50% do sự cố #12.", DailyLogSource.IncidentAdjustment)]
    public void Resolve_ShouldClassifyDailyLogSource(string description, string expected)
    {
        DailyLogSource.Resolve(description).Should().Be(expected);
    }
}
