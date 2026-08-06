namespace BPG.Domain.Common;

/// <summary>
/// Giờ Việt Nam (UTC+7) dùng cho các so sánh nghiệp vụ.
///
/// QUY ƯỚC: mọi mốc thời gian vẫn được LƯU bằng UTC (<c>DateTime.UtcNow</c>) — frontend giả định
/// backend trả UTC rồi tự quy về giờ máy để hiển thị, đổi quy ước lưu sẽ làm lệch toàn bộ hiển thị.
/// Lớp này chỉ dùng khi cần biết "hôm nay / bây giờ theo giờ Việt Nam", ví dụ:
/// chặn ngày ở tương lai, chặn ngày trong quá khứ, sinh mã phiếu theo ngày.
///
/// Không dùng <c>DateTime.Today</c> / <c>DateTime.Now</c> cho các so sánh đó: chúng lấy theo giờ
/// hệ điều hành của máy chủ, deploy lên server chạy UTC là lệch một ngày trong khoảng 00:00-07:00.
/// </summary>
public static class VietnamTime
{
    /// <summary>Độ lệch múi giờ Việt Nam so với UTC. Việt Nam không áp dụng giờ mùa hè.</summary>
    public static readonly TimeSpan Offset = TimeSpan.FromHours(7);

    /// <summary>Thời điểm hiện tại theo giờ Việt Nam. Chỉ dùng để so sánh/hiển thị, không dùng để lưu.</summary>
    public static DateTime Now => DateTime.UtcNow.Add(Offset);

    /// <summary>Ngày hôm nay theo giờ Việt Nam.</summary>
    public static DateOnly Today => DateOnly.FromDateTime(Now.Date);

    /// <summary>Quy một mốc UTC đã lưu về ngày theo giờ Việt Nam.</summary>
    public static DateOnly ToVnDate(DateTime utcInstant) => DateOnly.FromDateTime(utcInstant.Add(Offset).Date);
}
