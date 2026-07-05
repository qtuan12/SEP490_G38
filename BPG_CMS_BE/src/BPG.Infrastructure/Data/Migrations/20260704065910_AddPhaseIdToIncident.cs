using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BPG.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPhaseIdToIncident : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "PhaseId",
                table: "Incidents",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Incidents_PhaseId",
                table: "Incidents",
                column: "PhaseId");

            migrationBuilder.AddForeignKey(
                name: "FK_Incidents_Phases_PhaseId",
                table: "Incidents",
                column: "PhaseId",
                principalTable: "Phases",
                principalColumn: "PhaseId",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Incidents_Phases_PhaseId",
                table: "Incidents");

            migrationBuilder.DropIndex(
                name: "IX_Incidents_PhaseId",
                table: "Incidents");

            migrationBuilder.DropColumn(
                name: "PhaseId",
                table: "Incidents");
        }
    }
}
