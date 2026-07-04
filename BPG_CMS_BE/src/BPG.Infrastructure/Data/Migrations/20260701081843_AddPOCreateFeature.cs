using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BPG.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPOCreateFeature : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_PurchaseOrders_MaterialRequests_RequestId",
                table: "PurchaseOrders");

            migrationBuilder.AlterColumn<long>(
                name: "RequestId",
                table: "PurchaseOrders",
                type: "bigint",
                nullable: true,
                oldClrType: typeof(long),
                oldType: "bigint");

            migrationBuilder.AddColumn<string>(
                name: "DeliveryAddress",
                table: "PurchaseOrders",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Notes",
                table: "PurchaseOrders",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaymentTerms",
                table: "PurchaseOrders",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "ProjectId",
                table: "PurchaseOrders",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Notes",
                table: "PurchaseOrderItems",
                type: "nvarchar(max)",
                nullable: true);

            // Backfill ProjectId for existing POs from their linked MaterialRequest's Phase
            migrationBuilder.Sql(@"
                UPDATE po
                SET po.ProjectId = ph.ProjectId
                FROM PurchaseOrders po
                INNER JOIN MaterialRequests mr ON mr.RequestId = po.RequestId
                INNER JOIN Phases ph ON ph.PhaseId = mr.PhaseId
                WHERE po.RequestId IS NOT NULL AND po.ProjectId IS NULL
            ");

            migrationBuilder.CreateTable(
                name: "PurchaseOrderRequests",
                columns: table => new
                {
                    POId = table.Column<long>(type: "bigint", nullable: false),
                    RequestId = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PurchaseOrderRequests", x => new { x.POId, x.RequestId });
                    table.ForeignKey(
                        name: "FK_PurchaseOrderRequests_MaterialRequests_RequestId",
                        column: x => x.RequestId,
                        principalTable: "MaterialRequests",
                        principalColumn: "RequestId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PurchaseOrderRequests_PurchaseOrders_POId",
                        column: x => x.POId,
                        principalTable: "PurchaseOrders",
                        principalColumn: "POId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PurchaseOrderRequests_RequestId",
                table: "PurchaseOrderRequests",
                column: "RequestId");

            migrationBuilder.AddForeignKey(
                name: "FK_PurchaseOrders_MaterialRequests_RequestId",
                table: "PurchaseOrders",
                column: "RequestId",
                principalTable: "MaterialRequests",
                principalColumn: "RequestId",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_PurchaseOrders_MaterialRequests_RequestId",
                table: "PurchaseOrders");

            migrationBuilder.DropTable(
                name: "PurchaseOrderRequests");

            migrationBuilder.DropColumn(
                name: "DeliveryAddress",
                table: "PurchaseOrders");

            migrationBuilder.DropColumn(
                name: "Notes",
                table: "PurchaseOrders");

            migrationBuilder.DropColumn(
                name: "PaymentTerms",
                table: "PurchaseOrders");

            migrationBuilder.DropColumn(
                name: "ProjectId",
                table: "PurchaseOrders");

            migrationBuilder.DropColumn(
                name: "Notes",
                table: "PurchaseOrderItems");

            migrationBuilder.AlterColumn<long>(
                name: "RequestId",
                table: "PurchaseOrders",
                type: "bigint",
                nullable: false,
                defaultValue: 0L,
                oldClrType: typeof(long),
                oldType: "bigint",
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_PurchaseOrders_MaterialRequests_RequestId",
                table: "PurchaseOrders",
                column: "RequestId",
                principalTable: "MaterialRequests",
                principalColumn: "RequestId",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
