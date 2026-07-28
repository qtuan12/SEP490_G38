using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BPG.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSurplusItemCloseReason : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CloseReason",
                table: "SurplusRequestItems",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CloseReason",
                table: "SurplusRequestItems");
        }
    }
}
