using BPG.Infrastructure.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BPG.Infrastructure.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260824193000_EnforceSingleActiveInventoryIncidentPerPhase")]
    public partial class EnforceSingleActiveInventoryIncidentPerPhase : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                CREATE TRIGGER [TR_Incidents_SingleActiveInventoryIncidentPerPhase]
                ON [Incidents]
                AFTER INSERT, UPDATE
                AS
                BEGIN
                    SET NOCOUNT ON;

                    IF EXISTS
                    (
                        SELECT 1
                        FROM [inserted] AS [candidate]
                        WHERE [candidate].[IsDeleted] = CAST(0 AS bit)
                          AND [candidate].[PhaseId] IS NOT NULL
                          AND [candidate].[IncidentType] IN (N'InventoryLoss', N'InventoryDamage')
                          AND [candidate].[Status] NOT IN (N'Resolved', N'Closed', N'Rejected', N'Approved')
                          AND NOT EXISTS
                          (
                              SELECT 1
                              FROM [deleted] AS [previous]
                              WHERE [previous].[IncidentId] = [candidate].[IncidentId]
                                AND [previous].[IsDeleted] = CAST(0 AS bit)
                                AND [previous].[IncidentType] IN (N'InventoryLoss', N'InventoryDamage')
                                AND [previous].[Status] NOT IN (N'Resolved', N'Closed', N'Rejected', N'Approved')
                          )
                          AND EXISTS
                          (
                              SELECT 1
                              FROM [Incidents] AS [existing] WITH (UPDLOCK, HOLDLOCK, INDEX([IX_Incidents_PhaseId]))
                              WHERE [existing].[PhaseId] = [candidate].[PhaseId]
                                AND [existing].[IncidentId] <> [candidate].[IncidentId]
                                AND [existing].[IsDeleted] = CAST(0 AS bit)
                                AND [existing].[IncidentType] IN (N'InventoryLoss', N'InventoryDamage')
                                AND [existing].[Status] NOT IN (N'Resolved', N'Closed', N'Rejected', N'Approved')
                          )
                    )
                    BEGIN
                        THROW 51000, 'ERR_ACTIVE_INVENTORY_INCIDENT_EXISTS', 1;
                    END;
                END;
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                "DROP TRIGGER IF EXISTS [TR_Incidents_SingleActiveInventoryIncidentPerPhase];");
        }
    }
}
