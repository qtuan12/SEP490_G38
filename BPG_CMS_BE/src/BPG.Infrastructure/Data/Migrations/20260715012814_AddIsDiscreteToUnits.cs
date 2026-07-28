using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BPG.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddIsDiscreteToUnits : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsDiscrete",
                table: "Units",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsDiscrete",
                table: "Units");
        }
    }
}
