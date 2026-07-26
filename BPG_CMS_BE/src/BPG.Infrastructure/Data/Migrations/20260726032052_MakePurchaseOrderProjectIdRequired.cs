using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BPG.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class MakePurchaseOrderProjectIdRequired : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Backfill PO chưa gán ProjectId trực tiếp bằng ProjectId suy ra từ
            // MaterialRequest -> Phase liên kết (đường tạo PO cũ trước khi ProjectId bắt buộc).
            migrationBuilder.Sql(@"
                UPDATE po
                SET po.ProjectId = ph.ProjectId
                FROM PurchaseOrders po
                INNER JOIN MaterialRequests mr ON mr.RequestId = po.RequestId
                INNER JOIN Phases ph ON ph.PhaseId = mr.PhaseId
                WHERE po.ProjectId IS NULL;
            ");

            migrationBuilder.AlterColumn<long>(
                name: "ProjectId",
                table: "PurchaseOrders",
                type: "bigint",
                nullable: false,
                defaultValue: 0L,
                oldClrType: typeof(long),
                oldType: "bigint",
                oldNullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<long>(
                name: "ProjectId",
                table: "PurchaseOrders",
                type: "bigint",
                nullable: true,
                oldClrType: typeof(long),
                oldType: "bigint");
        }
    }
}
