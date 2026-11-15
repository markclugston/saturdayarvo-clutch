using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Clutch.API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTransactionDeletionAudit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TransactionDeletionAudits",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ActingUserId = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    AccountId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TransactionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DeletedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TransactionDeletionAudits", x => x.Id);
                });

            migrationBuilder.Sql(@"
CREATE TRIGGER [TR_TransactionDeletionAudits_Immutable]
ON [TransactionDeletionAudits]
AFTER UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    THROW 51000, 'TransactionDeletionAudits rows are immutable.', 1;
END");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Destroys the audit trail. Never run against an environment that holds audit rows.
            migrationBuilder.Sql(
                "DROP TRIGGER IF EXISTS [TR_TransactionDeletionAudits_Immutable];");
            migrationBuilder.DropTable(
                name: "TransactionDeletionAudits");
        }
    }
}
