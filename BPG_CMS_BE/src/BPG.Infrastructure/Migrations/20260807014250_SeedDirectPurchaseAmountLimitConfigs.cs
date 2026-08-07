using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BPG.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class SeedDirectPurchaseAmountLimitConfigs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Không đổi schema - chỉ thêm dữ liệu cấu hình.
            //
            // DbSeeder thoát sớm khi CSDL đã có dữ liệu nên key mới không bao giờ tới được các
            // môi trường đang chạy. Chèn thẳng ở đây để hạn mức có hiệu lực ngay sau khi cập nhật.
            // Quản trị viên chỉnh lại ở trang Cấu hình hệ thống, đặt 0 nếu muốn bỏ giới hạn.
            //
            // Ghi đè cả row đã tồn tại: bản nháp trước của migration này từng seed giá trị khác, nên
            // môi trường nào lỡ chạy bản đó phải được kéo về đúng hạn mức chốt cuối là 20tr/giai đoạn.
            migrationBuilder.Sql(@"
MERGE SystemConfigs AS target
USING (VALUES
    ('DirectPurchasePhaseMaxAmount', '20000000',
     N'Hạn mức mua khẩn cấp một giai đoạn',
     N'Tổng giá trị mua khẩn cấp cộng dồn tối đa của một giai đoạn, tính cả phiếu bị từ chối duyệt chi. Đặt 0 để bỏ giới hạn.')
) AS source (ConfigKey, ConfigValue, DisplayName, Description)
ON target.ConfigKey = source.ConfigKey
WHEN MATCHED THEN UPDATE SET
    target.ConfigValue = source.ConfigValue,
    target.DataType    = 'number',
    target.DisplayName = source.DisplayName,
    target.Description = source.Description,
    target.Unit        = N'đ',
    target.IsDeleted   = 0
WHEN NOT MATCHED THEN INSERT
    (ConfigKey, ConfigValue, DataType, DisplayName, Description, Unit, CreatedAt, IsDeleted)
    VALUES (source.ConfigKey, source.ConfigValue, 'number', source.DisplayName, source.Description,
            N'đ', GETUTCDATE(), 0);

-- Hạn mức theo TỪNG PHIẾU đã bị bỏ, chỉ còn hạn mức cộng dồn theo giai đoạn. Dọn row nếu môi
-- trường nào đã lỡ nhận key này, tránh để lại tham số chết trên trang Cấu hình hệ thống.
DELETE FROM SystemConfigs WHERE ConfigKey = 'DirectPurchaseMaxAmount';
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                "DELETE FROM SystemConfigs WHERE ConfigKey = 'DirectPurchasePhaseMaxAmount';");
        }
    }
}
