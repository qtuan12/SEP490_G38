using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BPG.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDirectPurchaseDraftAndOverBoqApproval : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ApprovalNote",
                table: "DirectPurchaseRequests",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ApprovedAt",
                table: "DirectPurchaseRequests",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "ApprovedBy",
                table: "DirectPurchaseRequests",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BOQCheckStatus",
                table: "DirectPurchaseRequests",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Explanation",
                table: "DirectPurchaseRequests",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "SubmittedAt",
                table: "DirectPurchaseRequests",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Explanation",
                table: "DirectPurchaseItems",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsOverBOQ",
                table: "DirectPurchaseItems",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_DirectPurchaseRequests_ApprovedBy",
                table: "DirectPurchaseRequests",
                column: "ApprovedBy");

            migrationBuilder.AddForeignKey(
                name: "FK_DirectPurchaseRequests_Users_ApprovedBy",
                table: "DirectPurchaseRequests",
                column: "ApprovedBy",
                principalTable: "Users",
                principalColumn: "UserId",
                onDelete: ReferentialAction.Restrict);

            // ---- Backfill dữ liệu cũ ----
            // Mọi phiếu trước đây đều bị chặn cứng nếu vượt định mức, nên chắc chắn là WithinBOQ.
            migrationBuilder.Sql(
                "UPDATE [DirectPurchaseRequests] SET [BOQCheckStatus] = N'WithinBOQ' WHERE [BOQCheckStatus] = N'';");

            // Phiếu cũ được ghi nhận ngay lúc tạo nên coi thời điểm gửi = thời điểm tạo.
            migrationBuilder.Sql(
                "UPDATE [DirectPurchaseRequests] SET [SubmittedAt] = [CreatedAt] WHERE [SubmittedAt] IS NULL;");

            // Trạng thái 'Draft' trước đây không được luồng cũ sử dụng, nhưng nếu tồn tại bản ghi
            // đã sinh Đơn hàng tự động thì nó đã nhập kho -> phải coi là đã gửi, không phải nháp.
            migrationBuilder.Sql(
                "UPDATE [DirectPurchaseRequests] SET [Status] = N'Approved' " +
                "WHERE [Status] = N'Draft' AND [AutoPOId] IS NOT NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_DirectPurchaseRequests_Users_ApprovedBy",
                table: "DirectPurchaseRequests");

            migrationBuilder.DropIndex(
                name: "IX_DirectPurchaseRequests_ApprovedBy",
                table: "DirectPurchaseRequests");

            migrationBuilder.DropColumn(
                name: "ApprovalNote",
                table: "DirectPurchaseRequests");

            migrationBuilder.DropColumn(
                name: "ApprovedAt",
                table: "DirectPurchaseRequests");

            migrationBuilder.DropColumn(
                name: "ApprovedBy",
                table: "DirectPurchaseRequests");

            migrationBuilder.DropColumn(
                name: "BOQCheckStatus",
                table: "DirectPurchaseRequests");

            migrationBuilder.DropColumn(
                name: "Explanation",
                table: "DirectPurchaseRequests");

            migrationBuilder.DropColumn(
                name: "SubmittedAt",
                table: "DirectPurchaseRequests");

            migrationBuilder.DropColumn(
                name: "Explanation",
                table: "DirectPurchaseItems");

            migrationBuilder.DropColumn(
                name: "IsOverBOQ",
                table: "DirectPurchaseItems");
        }
    }
}
