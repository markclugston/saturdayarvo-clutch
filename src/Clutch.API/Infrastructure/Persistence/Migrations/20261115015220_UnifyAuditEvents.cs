using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Clutch.API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class UnifyAuditEvents : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Audit",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ActingUserId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: false),
                    OccurredAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    EventCode = table.Column<string>(type: "varchar(50)", unicode: false, maxLength: 50, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Audit", x => x.Id);
                    table.CheckConstraint("CK_Audit_NonBlankDescription", "LEN(LTRIM(RTRIM([Description]))) > 0");
                    table.CheckConstraint("CK_Audit_NonBlankEventCode", "LEN(LTRIM(RTRIM([EventCode]))) > 0");
                });

            migrationBuilder.CreateIndex(
                name: "IX_Audit_OccurredAtUtc",
                table: "Audit",
                column: "OccurredAtUtc");

            migrationBuilder.Sql(
                """
                DECLARE @ExpectedImportCount bigint;
                DECLARE @ExpectedDeletionCount bigint;
                SELECT @ExpectedImportCount = COUNT_BIG(*)
                    FROM [ImportAuditEvents] WITH (TABLOCKX, HOLDLOCK);
                SELECT @ExpectedDeletionCount = COUNT_BIG(*)
                    FROM [TransactionDeletionAudits] WITH (TABLOCKX, HOLDLOCK);

                IF EXISTS
                (
                    SELECT 1
                    FROM [ImportAuditEvents] AS source
                    LEFT JOIN [Accounts] AS account ON account.[Id] = source.[AccountId]
                    WHERE account.[Id] IS NULL
                        OR NULLIF(LTRIM(RTRIM(account.[Description])), N'') IS NULL
                        OR NULLIF(LTRIM(RTRIM(source.[EventCode])), '') IS NULL
                )
                BEGIN
                    THROW 51002, 'Import audit consolidation found an unresolved account or blank event code.', 1;
                END;

                IF EXISTS
                (
                    SELECT 1
                    FROM [TransactionDeletionAudits] AS source
                    LEFT JOIN [Accounts] AS account ON account.[Id] = source.[AccountId]
                    WHERE account.[Id] IS NULL
                        OR NULLIF(LTRIM(RTRIM(account.[Description])), N'') IS NULL
                )
                BEGIN
                    THROW 51003, 'Deletion audit consolidation found an unresolved account.', 1;
                END;

                INSERT INTO [Audit]
                    ([Id], [ActingUserId], [OccurredAtUtc], [EventCode], [Description])
                SELECT
                    NEWID(),
                    source.[ActingUserId],
                    source.[OccurredAtUtc],
                    source.[EventCode],
                    CONCAT(N'Import ', source.[EventCode], N' for account ', account.[Description], N'.')
                FROM [ImportAuditEvents] AS source
                INNER JOIN [Accounts] AS account ON account.[Id] = source.[AccountId];

                DECLARE @CopiedImportCount bigint = @@ROWCOUNT;

                INSERT INTO [Audit]
                    ([Id], [ActingUserId], [OccurredAtUtc], [EventCode], [Description])
                SELECT
                    NEWID(),
                    source.[ActingUserId],
                    source.[DeletedAtUtc],
                    'TransactionDelete',
                    CONCAT(N'Transaction was reviewed and deleted in account ', account.[Description], N'.')
                FROM [TransactionDeletionAudits] AS source
                INNER JOIN [Accounts] AS account ON account.[Id] = source.[AccountId];

                DECLARE @CopiedDeletionCount bigint = @@ROWCOUNT;

                IF @CopiedImportCount <> @ExpectedImportCount
                    OR @CopiedDeletionCount <> @ExpectedDeletionCount
                    OR (SELECT COUNT_BIG(*) FROM [Audit]) <>
                        @ExpectedImportCount + @ExpectedDeletionCount
                BEGIN
                    THROW 51004, 'Audit consolidation row counts did not match their source tables.', 1;
                END;

                """);

            migrationBuilder.Sql(
                """
                EXEC(N'
                CREATE TRIGGER [TR_Audit_Immutable]
                ON [Audit]
                AFTER UPDATE, DELETE
                AS
                BEGIN
                    SET NOCOUNT ON;
                    THROW 51000, ''Audit rows are immutable.'', 1;
                END;');
                """);

            migrationBuilder.DropTable(
                name: "ImportAuditEvents");

            migrationBuilder.DropTable(
                name: "TransactionDeletionAudits");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            throw new NotSupportedException(
                "The unified Audit migration is forward-only. Recover with a forward migration that preserves Audit rows.");
        }
    }
}
