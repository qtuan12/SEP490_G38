using BPG.Infrastructure.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BPG.Infrastructure.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260825101000_EnforceSingleInventoryAdjustmentPerIncident")]
    public partial class EnforceSingleInventoryAdjustmentPerIncident : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Preserve every historical adjustment, but keep the incident link only
            // on the row that best represents the incident's current workflow state.
            migrationBuilder.Sql(
                """
                ;WITH [RankedAdjustments] AS (
                    SELECT
                        [adjustment].[AdjustmentId],
                        ROW_NUMBER() OVER (
                            PARTITION BY [adjustment].[IncidentId]
                            ORDER BY
                                CASE
                                    WHEN [incident].[Status] = N'Resolved'
                                        AND [adjustment].[Status] = N'Approved' THEN 0
                                    WHEN [incident].[Status] = N'UnderResolution'
                                        AND [adjustment].[Status] = N'Pending' THEN 0
                                    WHEN [incident].[Status] = N'UnderResolution'
                                        AND [adjustment].[Status] = N'RevisionRequired' THEN 1
                                    WHEN [adjustment].[Status] = N'Approved' THEN 2
                                    WHEN [adjustment].[Status] = N'Pending' THEN 3
                                    WHEN [adjustment].[Status] = N'RevisionRequired' THEN 4
                                    ELSE 5
                                END,
                                [adjustment].[AdjustmentId] DESC
                        ) AS [DuplicateRank]
                    FROM [InventoryAdjustments] AS [adjustment]
                    LEFT JOIN [Incidents] AS [incident]
                        ON [incident].[IncidentId] = [adjustment].[IncidentId]
                    WHERE [adjustment].[IncidentId] IS NOT NULL
                      AND [adjustment].[IsDeleted] = CAST(0 AS bit)
                )
                UPDATE [adjustment]
                SET [adjustment].[IncidentId] = NULL
                FROM [InventoryAdjustments] AS [adjustment]
                INNER JOIN [RankedAdjustments] AS [ranked]
                    ON [ranked].[AdjustmentId] = [adjustment].[AdjustmentId]
                WHERE [ranked].[DuplicateRank] > 1;
                """);

            migrationBuilder.DropIndex(
                name: "IX_InventoryAdjustments_IncidentId",
                table: "InventoryAdjustments");

            migrationBuilder.CreateIndex(
                name: "IX_InventoryAdjustments_IncidentId",
                table: "InventoryAdjustments",
                column: "IncidentId",
                unique: true,
                filter: "[IncidentId] IS NOT NULL AND [IsDeleted] = 0");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
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
    }
}
