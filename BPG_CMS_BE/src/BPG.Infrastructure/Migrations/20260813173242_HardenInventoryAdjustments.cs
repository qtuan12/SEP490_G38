using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BPG.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class HardenInventoryAdjustments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_InventoryAdjustments_IncidentId",
                table: "InventoryAdjustments");

            migrationBuilder.AddColumn<byte[]>(
                name: "RowVersion",
                table: "InventoryAdjustments",
                type: "rowversion",
                rowVersion: true,
                nullable: false,
                defaultValue: new byte[0]);

            // Backfill one unambiguous legacy marker only when the adjustment and
            // incident workflow states agree. Existing explicit links always win.
            migrationBuilder.Sql(
                """
                WITH [ParsedLegacyLinks] AS
                (
                    SELECT
                        [adjustment].[AdjustmentId],
                        TRY_CONVERT(
                            bigint,
                            LEFT(
                                [marker].[IdTail],
                                PATINDEX(N'%[^0-9]%', [marker].[IdTail] + N'X') - 1
                            )
                        ) AS [ParsedIncidentId]
                    FROM [InventoryAdjustments] AS [adjustment]
                    CROSS APPLY
                    (
                        VALUES
                        (
                            CASE
                                WHEN CHARINDEX(N'[System] Liên kết sự cố #', [adjustment].[Description]) > 0
                                THEN SUBSTRING(
                                    [adjustment].[Description],
                                    CHARINDEX(N'[System] Liên kết sự cố #', [adjustment].[Description])
                                        + LEN(N'[System] Liên kết sự cố #'),
                                    32
                                )
                                ELSE N''
                            END
                        )
                    ) AS [marker]([IdTail])
                    WHERE [adjustment].[IncidentId] IS NULL
                        AND [adjustment].[IsDeleted] = 0
                        AND [adjustment].[AdjustmentType] = N'Decrease'
                ),
                [RankedLegacyLinks] AS
                (
                    SELECT
                        [adjustment].[AdjustmentId],
                        [legacy].[ParsedIncidentId],
                        ROW_NUMBER() OVER
                        (
                            PARTITION BY [legacy].[ParsedIncidentId]
                            ORDER BY [adjustment].[AdjustmentId]
                        ) AS [CandidateRank]
                    FROM [ParsedLegacyLinks] AS [legacy]
                    INNER JOIN [InventoryAdjustments] AS [adjustment]
                        ON [adjustment].[AdjustmentId] = [legacy].[AdjustmentId]
                    INNER JOIN [Incidents] AS [incident]
                        ON [incident].[IncidentId] = [legacy].[ParsedIncidentId]
                        AND [incident].[ProjectId] = [adjustment].[ProjectId]
                        AND [incident].[PhaseId] = [adjustment].[PhaseId]
                        AND [incident].[IncidentType] IN (N'InventoryLoss', N'InventoryDamage')
                        AND
                        (
                            ([incident].[Status] = N'Approved' AND [adjustment].[Status] = N'Approved')
                            OR ([incident].[Status] = N'Rejected' AND [adjustment].[Status] = N'Rejected')
                            OR ([incident].[Status] = N'WaitingDirector' AND [adjustment].[Status] = N'Pending')
                        )
                    WHERE [legacy].[ParsedIncidentId] IS NOT NULL
                        AND NOT EXISTS
                        (
                            SELECT 1
                            FROM [InventoryAdjustments] AS [explicitLink]
                            WHERE [explicitLink].[IncidentId] = [legacy].[ParsedIncidentId]
                                AND [explicitLink].[IsDeleted] = 0
                        )
                )
                UPDATE [adjustment]
                SET [IncidentId] = [legacy].[ParsedIncidentId]
                FROM [InventoryAdjustments] AS [adjustment]
                INNER JOIN [RankedLegacyLinks] AS [legacy]
                    ON [legacy].[AdjustmentId] = [adjustment].[AdjustmentId]
                WHERE [legacy].[CandidateRank] = 1;
                """);

            // Historical versions allowed more than one adjustment to reference the
            // same incident. Keep the most meaningful record linked and detach only
            // the duplicate links before enforcing the one-incident/one-adjustment rule.
            migrationBuilder.Sql(
                """
                WITH [RankedAdjustments] AS
                (
                    SELECT
                        [adjustment].[AdjustmentId],
                        ROW_NUMBER() OVER
                        (
                            PARTITION BY [adjustment].[IncidentId]
                            ORDER BY
                                CASE
                                    WHEN [incident].[Status] = N'Approved' AND [adjustment].[Status] = N'Approved' THEN 0
                                    WHEN [incident].[Status] = N'Rejected' AND [adjustment].[Status] = N'Rejected' THEN 0
                                    WHEN [incident].[Status] = N'WaitingDirector' AND [adjustment].[Status] = N'Pending' THEN 0
                                    ELSE 1
                                END,
                                CASE [adjustment].[Status]
                                    WHEN N'Approved' THEN 0
                                    WHEN N'Rejected' THEN 1
                                    WHEN N'Pending' THEN 2
                                    ELSE 3
                                END,
                                [adjustment].[AdjustmentId]
                        ) AS [DuplicateRank]
                    FROM [InventoryAdjustments] AS [adjustment]
                    LEFT JOIN [Incidents] AS [incident]
                        ON [incident].[IncidentId] = [adjustment].[IncidentId]
                    WHERE [adjustment].[IncidentId] IS NOT NULL
                        AND [adjustment].[IsDeleted] = 0
                )
                UPDATE [adjustment]
                SET [IncidentId] = NULL
                FROM [InventoryAdjustments] AS [adjustment]
                INNER JOIN [RankedAdjustments] AS [ranked]
                    ON [ranked].[AdjustmentId] = [adjustment].[AdjustmentId]
                WHERE [ranked].[DuplicateRank] > 1;
                """);

            migrationBuilder.CreateIndex(
                name: "IX_InventoryAdjustments_IncidentId",
                table: "InventoryAdjustments",
                column: "IncidentId",
                unique: true,
                filter: "[IncidentId] IS NOT NULL AND [IsDeleted] = 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_InventoryAdjustments_IncidentId",
                table: "InventoryAdjustments");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "InventoryAdjustments");

            migrationBuilder.CreateIndex(
                name: "IX_InventoryAdjustments_IncidentId",
                table: "InventoryAdjustments",
                column: "IncidentId");
        }
    }
}
