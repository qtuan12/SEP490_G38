using BPG.Infrastructure.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BPG.Infrastructure.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260824200000_EnforceSingleActiveConstructionIncidentPerPhase")]
    public partial class EnforceSingleActiveConstructionIncidentPerPhase : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                "DROP TRIGGER IF EXISTS [TR_Incidents_SingleActiveInventoryIncidentPerPhase];");

            migrationBuilder.Sql(
                """
                CREATE TRIGGER [TR_Incidents_SingleActiveIncidentPerPhase]
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
                          AND [candidate].[Status] NOT IN (N'Resolved', N'Closed', N'Rejected', N'Approved')
                          AND
                          (
                              [candidate].[IncidentType] IN (N'InventoryLoss', N'InventoryDamage')
                              OR ([candidate].[IncidentType] = N'Construction' AND [candidate].[IsEmergency] = CAST(0 AS bit))
                          )
                          AND NOT EXISTS
                          (
                              SELECT 1
                              FROM [deleted] AS [previous]
                              WHERE [previous].[IncidentId] = [candidate].[IncidentId]
                                AND [previous].[IsDeleted] = CAST(0 AS bit)
                                AND [previous].[Status] NOT IN (N'Resolved', N'Closed', N'Rejected', N'Approved')
                                AND
                                (
                                    [previous].[IncidentType] IN (N'InventoryLoss', N'InventoryDamage')
                                    OR ([previous].[IncidentType] = N'Construction' AND [previous].[IsEmergency] = CAST(0 AS bit))
                                )
                          )
                          AND EXISTS
                          (
                              SELECT 1
                              FROM [Incidents] AS [existing] WITH (UPDLOCK, HOLDLOCK, INDEX([IX_Incidents_PhaseId]))
                              WHERE [existing].[PhaseId] = [candidate].[PhaseId]
                                AND [existing].[IncidentId] <> [candidate].[IncidentId]
                                AND [existing].[IsDeleted] = CAST(0 AS bit)
                                AND [existing].[Status] NOT IN (N'Resolved', N'Closed', N'Rejected', N'Approved')
                                AND
                                (
                                    (
                                        [candidate].[IncidentType] IN (N'InventoryLoss', N'InventoryDamage')
                                        AND [existing].[IncidentType] IN (N'InventoryLoss', N'InventoryDamage')
                                    )
                                    OR
                                    (
                                        [candidate].[IncidentType] = N'Construction'
                                        AND [candidate].[IsEmergency] = CAST(0 AS bit)
                                        AND [existing].[IncidentType] = N'Construction'
                                        AND [existing].[IsEmergency] = CAST(0 AS bit)
                                    )
                                )
                          )
                    )
                    BEGIN
                        IF EXISTS
                        (
                            SELECT 1
                            FROM [inserted]
                            WHERE [IncidentType] = N'Construction'
                              AND [IsEmergency] = CAST(0 AS bit)
                        )
                            THROW 51000, 'ERR_ACTIVE_CONSTRUCTION_INCIDENT_EXISTS', 1;

                        THROW 51000, 'ERR_ACTIVE_INVENTORY_INCIDENT_EXISTS', 1;
                    END;
                END;
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                "DROP TRIGGER IF EXISTS [TR_Incidents_SingleActiveIncidentPerPhase];");

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
    }
}
