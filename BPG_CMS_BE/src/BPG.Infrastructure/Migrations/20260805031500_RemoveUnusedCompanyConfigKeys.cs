using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BPG.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RemoveUnusedCompanyConfigKeys : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Không đổi schema - chỉ dọn dữ liệu.
            //
            // CompanyTaxCode và CompanyAddress từng được seed vào SystemConfigs nhưng không nghiệp vụ
            // nào đọc: GetCompanyInfoQuery/UpdateCompanySettingsCommand chỉ xử lý CompanyName và
            // CompanyLogoUrl, phía FE cũng không có chỗ nào dùng. Trang Cấu hình hệ thống liệt kê mọi
            // row nên hai tham số chết này vẫn hiện ra và sửa được mà không có tác dụng gì.
            migrationBuilder.Sql(
                "DELETE FROM SystemConfigs WHERE ConfigKey IN ('CompanyTaxCode', 'CompanyAddress');");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF NOT EXISTS (SELECT 1 FROM SystemConfigs WHERE ConfigKey = 'CompanyTaxCode')
INSERT INTO SystemConfigs (ConfigKey, ConfigValue, DataType, DisplayName, Description, Unit, CreatedAt, IsDeleted)
VALUES ('CompanyTaxCode', '0108326945', 'string',
        N'Mã số thuế',
        N'Mã số thuế doanh nghiệp.',
        NULL, GETUTCDATE(), 0);

IF NOT EXISTS (SELECT 1 FROM SystemConfigs WHERE ConfigKey = 'CompanyAddress')
INSERT INTO SystemConfigs (ConfigKey, ConfigValue, DataType, DisplayName, Description, Unit, CreatedAt, IsDeleted)
VALUES ('CompanyAddress', N'Tầng 4, LK 4B-(7) khu tái định cư đô thị Mỗ Lao, Phường Mộ Lao, Quận Hà Đông, Thành phố Hà Nội, Việt Nam', 'string',
        N'Địa chỉ trụ sở',
        N'Địa chỉ theo nguồn mã số thuế công khai.',
        NULL, GETUTCDATE(), 0);
");
        }
    }
}
