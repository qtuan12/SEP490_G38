using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BPG.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class FixLegacySystemConfigKeyNames : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 'inventory.low_stock_threshold' là key sót lại từ migration cũ (AddSystemConfigMetaAndSeed),
            // nhưng GetCurrentInventoryQueryHandler chỉ đọc key 'NguongTonKhoThap'/'LowStockThreshold'.
            // Đổi tên key về đúng key mà handler thực tế dùng, giữ nguyên giá trị đang cấu hình.
            migrationBuilder.Sql(@"
IF EXISTS (SELECT 1 FROM SystemConfigs WHERE ConfigKey = 'inventory.low_stock_threshold')
BEGIN
    IF EXISTS (SELECT 1 FROM SystemConfigs WHERE ConfigKey = 'NguongTonKhoThap')
        DELETE FROM SystemConfigs WHERE ConfigKey = 'inventory.low_stock_threshold';
    ELSE
        UPDATE SystemConfigs SET ConfigKey = 'NguongTonKhoThap', DataType = 'number',
            DisplayName = N'Ngưỡng tồn kho thấp',
            Description = N'Số lượng tồn kho tối thiểu. Khi tồn kho thấp hơn ngưỡng này, hệ thống sẽ cảnh báo.',
            Unit = N'đơn vị'
        WHERE ConfigKey = 'inventory.low_stock_threshold';
END
");

            // 'ticket.cancellation_deadline_hours' cũng là key sót lại, không khớp key 'HanHuyPhieuNgay'
            // mà CancelGoodsReceiptCommandHandler đọc. Giá trị cũ (24) mang đơn vị giờ, còn HanHuyPhieuNgay
            // được handler hiểu theo đơn vị NGÀY nên không tái sử dụng giá trị cũ — đặt lại mặc định 7 ngày.
            migrationBuilder.Sql(@"
IF EXISTS (SELECT 1 FROM SystemConfigs WHERE ConfigKey = 'ticket.cancellation_deadline_hours')
BEGIN
    IF EXISTS (SELECT 1 FROM SystemConfigs WHERE ConfigKey = 'HanHuyPhieuNgay')
        DELETE FROM SystemConfigs WHERE ConfigKey = 'ticket.cancellation_deadline_hours';
    ELSE
        UPDATE SystemConfigs SET ConfigKey = 'HanHuyPhieuNgay', ConfigValue = '7', DataType = 'number',
            DisplayName = N'Hạn hủy phiếu nhập kho',
            Description = N'Số ngày tối đa kể từ khi tạo phiếu nhập kho mà người dùng có thể hủy phiếu.',
            Unit = N'ngày'
        WHERE ConfigKey = 'ticket.cancellation_deadline_hours';
END
");

            // 'task.delay_warning_percentage' không có handler nào đọc (kể cả constant ExpectedDelayPercent
            // tương ứng) — xóa khỏi DB để không hiển thị như một tham số "sửa được" trong khi vô tác dụng.
            migrationBuilder.Sql("DELETE FROM SystemConfigs WHERE ConfigKey = 'task.delay_warning_percentage';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF EXISTS (SELECT 1 FROM SystemConfigs WHERE ConfigKey = 'NguongTonKhoThap')
    UPDATE SystemConfigs SET ConfigKey = 'inventory.low_stock_threshold' WHERE ConfigKey = 'NguongTonKhoThap';

IF EXISTS (SELECT 1 FROM SystemConfigs WHERE ConfigKey = 'HanHuyPhieuNgay')
    UPDATE SystemConfigs SET ConfigKey = 'ticket.cancellation_deadline_hours', ConfigValue = '24' WHERE ConfigKey = 'HanHuyPhieuNgay';

IF NOT EXISTS (SELECT 1 FROM SystemConfigs WHERE ConfigKey = 'task.delay_warning_percentage')
    INSERT INTO SystemConfigs (ConfigKey, ConfigValue, DataType, DisplayName, CreatedAt, IsDeleted)
    VALUES ('task.delay_warning_percentage', '20', 'percentage', N'% trễ kỳ vọng công việc', GETUTCDATE(), 0);
");
        }
    }
}
