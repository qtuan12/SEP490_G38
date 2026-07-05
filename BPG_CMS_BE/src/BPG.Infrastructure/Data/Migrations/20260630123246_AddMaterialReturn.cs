using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BPG.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddMaterialReturn : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "MaterialReturns",
                columns: table => new
                {
                    MaterialReturnId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ReturnNo = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    OriginalIssuanceId = table.Column<long>(type: "bigint", nullable: false),
                    Reason = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedBy = table.Column<long>(type: "bigint", nullable: true),
                    UpdatedBy = table.Column<long>(type: "bigint", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MaterialReturns", x => x.MaterialReturnId);
                    table.ForeignKey(
                        name: "FK_MaterialReturns_MaterialIssuances_OriginalIssuanceId",
                        column: x => x.OriginalIssuanceId,
                        principalTable: "MaterialIssuances",
                        principalColumn: "MaterialIssuanceId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "MaterialReturnItems",
                columns: table => new
                {
                    ReturnItemId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    MaterialReturnId = table.Column<long>(type: "bigint", nullable: false),
                    MaterialId = table.Column<long>(type: "bigint", nullable: false),
                    UnitId = table.Column<int>(type: "int", nullable: false),
                    Quantity = table.Column<decimal>(type: "decimal(18,3)", precision: 18, scale: 3, nullable: false),
                    ConversionRate = table.Column<decimal>(type: "decimal(18,6)", precision: 18, scale: 6, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MaterialReturnItems", x => x.ReturnItemId);
                    table.ForeignKey(
                        name: "FK_MaterialReturnItems_MaterialCatalogs_MaterialId",
                        column: x => x.MaterialId,
                        principalTable: "MaterialCatalogs",
                        principalColumn: "MaterialId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_MaterialReturnItems_MaterialReturns_MaterialReturnId",
                        column: x => x.MaterialReturnId,
                        principalTable: "MaterialReturns",
                        principalColumn: "MaterialReturnId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_MaterialReturnItems_Units_UnitId",
                        column: x => x.UnitId,
                        principalTable: "Units",
                        principalColumn: "UnitId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_MaterialReturnItems_MaterialId",
                table: "MaterialReturnItems",
                column: "MaterialId");

            migrationBuilder.CreateIndex(
                name: "IX_MaterialReturnItems_MaterialReturnId",
                table: "MaterialReturnItems",
                column: "MaterialReturnId");

            migrationBuilder.CreateIndex(
                name: "IX_MaterialReturnItems_UnitId",
                table: "MaterialReturnItems",
                column: "UnitId");

            migrationBuilder.CreateIndex(
                name: "IX_MaterialReturns_OriginalIssuanceId",
                table: "MaterialReturns",
                column: "OriginalIssuanceId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MaterialReturnItems");

            migrationBuilder.DropTable(
                name: "MaterialReturns");
        }
    }
}
