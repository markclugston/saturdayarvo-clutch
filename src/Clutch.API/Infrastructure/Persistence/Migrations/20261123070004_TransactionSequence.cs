using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Clutch.API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class TransactionSequence : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Transactions_AccountId_TransactionDate",
                table: "Transactions");

            // Added nullable, backfilled, then made required so no default constraint is left behind.
            migrationBuilder.AddColumn<int>(
                name: "Sequence",
                table: "Transactions",
                type: "int",
                nullable: true);

            // Guard so the unique index can be created on a non-empty database; it does not claim a
            // correct legacy order (the data is cleared for this feature, FR-008).
            migrationBuilder.Sql(
                """
                WITH Numbered AS (
                    SELECT [Sequence],
                           ROW_NUMBER() OVER (
                               PARTITION BY [AccountId], [TransactionDate]
                               ORDER BY [CreatedAtUtc], [Id]) AS [Position]
                    FROM [Transactions])
                UPDATE Numbered SET [Sequence] = [Position];
                """);

            migrationBuilder.AlterColumn<int>(
                name: "Sequence",
                table: "Transactions",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_AccountId_TransactionDate_Sequence",
                table: "Transactions",
                columns: new[] { "AccountId", "TransactionDate", "Sequence" },
                unique: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_Transactions_PositiveSequence",
                table: "Transactions",
                sql: "[Sequence] >= 1");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Transactions_AccountId_TransactionDate_Sequence",
                table: "Transactions");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Transactions_PositiveSequence",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "Sequence",
                table: "Transactions");

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_AccountId_TransactionDate",
                table: "Transactions",
                columns: new[] { "AccountId", "TransactionDate" });
        }
    }
}
