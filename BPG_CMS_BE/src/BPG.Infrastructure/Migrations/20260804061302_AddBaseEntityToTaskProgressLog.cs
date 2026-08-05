using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BPG.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddBaseEntityToTaskProgressLog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<DateTime>(
                name: "UpdatedAt",
                table: "TaskProgressLogs",
                type: "datetime2",
                nullable: true,
                oldClrType: typeof(DateTime),
                oldType: "datetime2");

            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "TaskProgressLogs",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<long>(
                name: "CreatedBy",
                table: "TaskProgressLogs",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                table: "TaskProgressLogs",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<long>(
                name: "UpdatedBy",
                table: "TaskProgressLogs",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_TaskProgressLogs_CreatedBy",
                table: "TaskProgressLogs",
                column: "CreatedBy");

            migrationBuilder.AddForeignKey(
                name: "FK_TaskProgressLogs_Users_CreatedBy",
                table: "TaskProgressLogs",
                column: "CreatedBy",
                principalTable: "Users",
                principalColumn: "UserId",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TaskProgressLogs_Users_CreatedBy",
                table: "TaskProgressLogs");

            migrationBuilder.DropIndex(
                name: "IX_TaskProgressLogs_CreatedBy",
                table: "TaskProgressLogs");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "TaskProgressLogs");

            migrationBuilder.DropColumn(
                name: "CreatedBy",
                table: "TaskProgressLogs");

            migrationBuilder.DropColumn(
                name: "IsDeleted",
                table: "TaskProgressLogs");

            migrationBuilder.DropColumn(
                name: "UpdatedBy",
                table: "TaskProgressLogs");

            migrationBuilder.AlterColumn<DateTime>(
                name: "UpdatedAt",
                table: "TaskProgressLogs",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified),
                oldClrType: typeof(DateTime),
                oldType: "datetime2",
                oldNullable: true);
        }
    }
}
