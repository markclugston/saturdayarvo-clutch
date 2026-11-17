using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Clutch.API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ActiveImportCoordination : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_ImportReviews_ValidState",
                table: "ImportReviews");

            migrationBuilder.AddColumn<Guid>(
                name: "ConfirmationAttemptId",
                table: "ImportReviews",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "EndedAtUtc",
                table: "ImportReviews",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EndedByUserId",
                table: "ImportReviews",
                type: "nvarchar(450)",
                maxLength: 450,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ProcessingStartedAtUtc",
                table: "ImportReviews",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ImportReviews_ProcessingStartedAtUtc_Id",
                table: "ImportReviews",
                columns: new[] { "ProcessingStartedAtUtc", "Id" },
                filter: "[State] = 'Processing'");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ImportReviews_EndedMetadata",
                table: "ImportReviews",
                sql: "(([EndedByUserId] IS NULL AND [EndedAtUtc] IS NULL) OR ([State] = 'Cancelled' AND [EndedByUserId] IS NOT NULL AND LEN(LTRIM(RTRIM([EndedByUserId]))) > 0 AND [EndedAtUtc] IS NOT NULL AND [ConfirmationAttemptId] IS NULL AND [ProcessingStartedAtUtc] IS NULL))");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ImportReviews_ProcessingMetadata",
                table: "ImportReviews",
                sql: "(([State] = 'Processing' AND [ConfirmationAttemptId] IS NOT NULL AND [ProcessingStartedAtUtc] IS NOT NULL AND [EndedByUserId] IS NULL AND [EndedAtUtc] IS NULL) OR ([State] <> 'Processing' AND [ConfirmationAttemptId] IS NULL AND [ProcessingStartedAtUtc] IS NULL))");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ImportReviews_ValidState",
                table: "ImportReviews",
                sql: "[State] IN ('Ready', 'Processing', 'Confirmed', 'Cancelled', 'Expired')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ImportReviews_ProcessingStartedAtUtc_Id",
                table: "ImportReviews");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ImportReviews_EndedMetadata",
                table: "ImportReviews");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ImportReviews_ProcessingMetadata",
                table: "ImportReviews");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ImportReviews_ValidState",
                table: "ImportReviews");

            migrationBuilder.DropColumn(
                name: "ConfirmationAttemptId",
                table: "ImportReviews");

            migrationBuilder.DropColumn(
                name: "EndedAtUtc",
                table: "ImportReviews");

            migrationBuilder.DropColumn(
                name: "EndedByUserId",
                table: "ImportReviews");

            migrationBuilder.DropColumn(
                name: "ProcessingStartedAtUtc",
                table: "ImportReviews");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ImportReviews_ValidState",
                table: "ImportReviews",
                sql: "[State] IN ('Ready', 'Confirmed', 'Cancelled', 'Expired')");
        }
    }
}
