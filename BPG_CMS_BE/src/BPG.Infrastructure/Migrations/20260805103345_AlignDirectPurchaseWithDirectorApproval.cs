using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BPG.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AlignDirectPurchaseWithDirectorApproval : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Không đổi schema - chỉ chuẩn hóa dữ liệu theo luật mới của mua khẩn cấp.
            //
            // Trước đây phiếu nằm TRONG định mức BOQ được chốt duyệt chi ngay khi Kế toán soát xong
            // hóa đơn, không cần Giám đốc ký. Nay mọi phiếu mua khẩn cấp - trong hay vượt định mức -
            // đều phải qua Giám đốc duyệt chi.
            //
            // Phiếu 'Approved' mà ApprovedBy rỗng chính là phiếu được Kế toán tự chốt theo luật cũ
            // (Giám đốc duyệt chi luôn ghi ApprovedBy). Đưa chúng về đúng điểm chờ mới.
            migrationBuilder.Sql(@"
                UPDATE [DirectPurchaseRequests]
                SET [Status] = N'WaitingApproval'
                WHERE [Status] = N'Approved'
                  AND [AuditStatus] = N'Audited'
                  AND [ApprovedBy] IS NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Khôi phục luật cũ: chỉ phiếu TRONG định mức mới được Kế toán chốt duyệt chi.
            // Phiếu vượt định mức vẫn nằm ở 'WaitingApproval' chờ Giám đốc như trước.
            migrationBuilder.Sql(@"
                UPDATE [DirectPurchaseRequests]
                SET [Status] = N'Approved'
                WHERE [Status] = N'WaitingApproval'
                  AND [AuditStatus] = N'Audited'
                  AND [ApprovedBy] IS NULL
                  AND [BOQCheckStatus] = N'WithinBOQ';");
        }
    }
}
