using BPG.Infrastructure.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BPG.Infrastructure.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260824190000_DecoupleInventoryIncidentAdjustmentWorkflow")]
    public partial class DecoupleInventoryIncidentAdjustmentWorkflow : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                UPDATE [Incidents]
                SET [Status] = N'UnderResolution'
                WHERE [Status] = N'WaitingDirector';

                UPDATE [adjustment]
                SET [adjustment].[Status] = N'RevisionRequired'
                FROM [InventoryAdjustments] AS [adjustment]
                INNER JOIN [Incidents] AS [incident]
                    ON [incident].[IncidentId] = [adjustment].[IncidentId]
                WHERE [incident].[Status] = N'Rejected'
                  AND [incident].[IncidentType] IN (N'InventoryLoss', N'InventoryDamage')
                  AND [incident].[HandlingInstruction] LIKE N'Giám đốc đã từ chối phiếu giảm tồn kho liên quan.%'
                  AND [adjustment].[AdjustmentType] = N'Decrease'
                  AND [adjustment].[Status] = N'Rejected'
                  AND [adjustment].[IsDeleted] = CAST(0 AS bit);

                UPDATE [Incidents]
                SET [Status] = N'UnderResolution',
                    [ReviewedBy] = NULL,
                    [HandlingInstruction] = NULL
                WHERE [Status] = N'Rejected'
                  AND [IncidentType] IN (N'InventoryLoss', N'InventoryDamage')
                  AND [HandlingInstruction] LIKE N'Giám đốc đã từ chối phiếu giảm tồn kho liên quan.%';

                UPDATE [Incidents]
                SET [Status] = N'Resolved'
                WHERE [Status] = N'Approved'
                  AND [IncidentType] IN (N'InventoryLoss', N'InventoryDamage')
                  AND EXISTS (
                      SELECT 1
                      FROM [InventoryAdjustments] AS [adjustment]
                      WHERE [adjustment].[IncidentId] = [Incidents].[IncidentId]
                        AND [adjustment].[AdjustmentType] = N'Decrease'
                        AND [adjustment].[Status] = N'Approved'
                        AND [adjustment].[IsDeleted] = CAST(0 AS bit)
                  );
                """);

            migrationBuilder.DropIndex(
                name: "IX_InventoryAdjustments_IncidentId",
                table: "InventoryAdjustments");

            migrationBuilder.CreateIndex(
                name: "IX_InventoryAdjustments_IncidentId",
                table: "InventoryAdjustments",
                column: "IncidentId",
                unique: true,
                filter: "[IncidentId] IS NOT NULL AND [IsDeleted] = 0 AND [Status] = N'Pending'");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_InventoryAdjustments_IncidentId",
                table: "InventoryAdjustments");

            migrationBuilder.Sql(
                """
                UPDATE [Incidents]
                SET [Status] = N'WaitingDirector'
                WHERE [Status] = N'UnderResolution';

                UPDATE [Incidents]
                SET [Status] = N'Approved'
                WHERE [Status] = N'Resolved'
                  AND [IncidentType] IN (N'InventoryLoss', N'InventoryDamage');
                """);

            migrationBuilder.CreateIndex(
                name: "IX_InventoryAdjustments_IncidentId",
                table: "InventoryAdjustments",
                column: "IncidentId",
                unique: true,
                filter: "[IncidentId] IS NOT NULL AND [IsDeleted] = 0");
        }
    }
}
