using BPG.Domain.Common;
using BPG.Domain.Exceptions;

namespace BPG.Application.Common.Helpers;

public readonly record struct ReportDateRange(DateTime? From, DateTime? ToInclusive)
{
    public static ReportDateRange Create(DateTime? fromDate, DateTime? toDate)
    {
        DateTime? from = fromDate.HasValue ? ToUtcStartOfVietnamDay(fromDate.Value) : null;
        DateTime? to = toDate.HasValue ? ToUtcStartOfVietnamDay(toDate.Value).AddDays(1).AddTicks(-1) : null;

        if (from.HasValue && to.HasValue && from.Value > to.Value)
        {
            throw new BusinessException(
                "ERR_REPORT_DATE_RANGE_INVALID",
                "Ngày bắt đầu kỳ báo cáo không được sau ngày kết thúc.");
        }

        return new ReportDateRange(from, to);
    }

    private static DateTime ToUtcStartOfVietnamDay(DateTime value)
    {
        var vietnamDay = DateOnly.FromDateTime(value);
        return DateTime.SpecifyKind(
            vietnamDay.ToDateTime(TimeOnly.MinValue).Subtract(VietnamTime.Offset),
            DateTimeKind.Utc);
    }
}
