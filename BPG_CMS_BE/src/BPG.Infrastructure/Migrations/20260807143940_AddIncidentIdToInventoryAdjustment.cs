using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BPG.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddIncidentIdToInventoryAdjustment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "IncidentId",
                table: "InventoryAdjustments",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_InventoryAdjustments_IncidentId",
                table: "InventoryAdjustments",
                column: "IncidentId");

            migrationBuilder.AddForeignKey(
                name: "FK_InventoryAdjustments_Incidents_IncidentId",
                table: "InventoryAdjustments",
                column: "IncidentId",
                principalTable: "Incidents",
                principalColumn: "IncidentId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_InventoryAdjustments_Incidents_IncidentId",
                table: "InventoryAdjustments");

            migrationBuilder.DropIndex(
                name: "IX_InventoryAdjustments_IncidentId",
                table: "InventoryAdjustments");

            migrationBuilder.DropColumn(
                name: "IncidentId",
                table: "InventoryAdjustments");
        }
    }
}
