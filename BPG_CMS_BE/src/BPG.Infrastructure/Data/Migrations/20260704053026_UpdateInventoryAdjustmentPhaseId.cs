using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BPG.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class UpdateInventoryAdjustmentPhaseId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_InventoryAdjustments_Incidents_IncidentId",
                table: "InventoryAdjustments");

            // Clean up existing data to prevent FK constraint violations when adding PhaseId
            migrationBuilder.Sql("DELETE FROM [AdjustmentItems];");
            migrationBuilder.Sql("DELETE FROM [InventoryAdjustments];");

            migrationBuilder.DropIndex(
                name: "IX_InventoryAdjustments_IncidentId",
                table: "InventoryAdjustments");

            migrationBuilder.DropColumn(
                name: "IncidentId",
                table: "InventoryAdjustments");

            migrationBuilder.AddColumn<long>(
                name: "PhaseId",
                table: "InventoryAdjustments",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.CreateIndex(
                name: "IX_InventoryAdjustments_PhaseId",
                table: "InventoryAdjustments",
                column: "PhaseId");

            migrationBuilder.AddForeignKey(
                name: "FK_InventoryAdjustments_Phases_PhaseId",
                table: "InventoryAdjustments",
                column: "PhaseId",
                principalTable: "Phases",
                principalColumn: "PhaseId",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_InventoryAdjustments_Phases_PhaseId",
                table: "InventoryAdjustments");

            migrationBuilder.DropIndex(
                name: "IX_InventoryAdjustments_PhaseId",
                table: "InventoryAdjustments");

            migrationBuilder.DropColumn(
                name: "PhaseId",
                table: "InventoryAdjustments");

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
    }
}
