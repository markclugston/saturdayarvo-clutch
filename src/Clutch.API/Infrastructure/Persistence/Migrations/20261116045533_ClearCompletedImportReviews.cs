using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Clutch.API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ClearCompletedImportReviews : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                UPDATE [Accounts]
                SET [ActiveImportId] = NULL
                WHERE [ActiveImportId] IN
                    (SELECT [Id] FROM [ImportReviews] WHERE [State] <> 'Ready');

                DELETE FROM [ImportReviews] WHERE [State] <> 'Ready';
                """);

            migrationBuilder.DropColumn(
                name: "LastSuccessfulImportReviewId",
                table: "Accounts");

            migrationBuilder.DropColumn(
                name: "SourceImportReviewId",
                table: "AccountImportSettings");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "LastSuccessfulImportReviewId",
                table: "Accounts",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "SourceImportReviewId",
                table: "AccountImportSettings",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));
        }
    }
}
