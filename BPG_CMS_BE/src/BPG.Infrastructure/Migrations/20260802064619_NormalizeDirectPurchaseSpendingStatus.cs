using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BPG.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class NormalizeDirectPurchaseSpendingStatus : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Không đổi schema - chỉ chuẩn hóa dữ liệu theo ngữ nghĩa mới của Status.
            //
            // Trước đây phiếu mua trực tiếp được gán Status = 'Approved' ngay lúc tạo, nên tồn tại
            // cặp trạng thái vô nghĩa: "Đã duyệt chi" nhưng "Chờ kiểm toán" - chưa ai duyệt gì cả.
            // Nay 'Approved' chỉ được gán khi khoản chi thật sự được chuẩn thuận (Kế toán soát xong
            // nếu trong định mức, Giám đốc ký nếu vượt định mức), tức 'Approved' luôn kéo theo
            // AuditStatus = 'Audited'.
            //
            // Đưa các phiếu chưa kiểm toán về đúng điểm chờ của chúng.
            migrationBuilder.Sql(@"
                UPDATE [DirectPurchaseRequests]
                SET [Status] = N'Pending'
                WHERE [Status] = N'Approved' AND [AuditStatus] = N'PendingAudit';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Khôi phục hành vi cũ: phiếu chưa kiểm toán từng được coi là đã duyệt chi sẵn.
            migrationBuilder.Sql(@"
                UPDATE [DirectPurchaseRequests]
                SET [Status] = N'Approved'
                WHERE [Status] = N'Pending' AND [AuditStatus] = N'PendingAudit';");
        }
    }
}
