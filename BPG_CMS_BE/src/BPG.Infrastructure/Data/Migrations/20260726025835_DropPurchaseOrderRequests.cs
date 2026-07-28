using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BPG.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class DropPurchaseOrderRequests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PurchaseOrderRequests");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
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
        }
    }
}
