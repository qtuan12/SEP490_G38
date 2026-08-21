using BPG.Domain.Exceptions;

namespace BPG.Application.Common.Helpers;

public readonly record struct ReportDateRange(DateTime? From, DateTime? ToInclusive)
{
    public static ReportDateRange Create(DateTime? fromDate, DateTime? toDate)
    {
        var from = fromDate?.Date;
        var to = toDate?.Date.AddDays(1).AddTicks(-1);

        if (from.HasValue && to.HasValue && from.Value > to.Value)
        {
            throw new BusinessException(
                "ERR_REPORT_DATE_RANGE_INVALID",
                "Ngày bắt đầu kỳ báo cáo không được sau ngày kết thúc.");
        }

        return new ReportDateRange(from, to);
    }
}
