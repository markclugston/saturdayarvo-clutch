using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Clutch.API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class SaveAccountImportSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "LastSuccessfulImportReviewId",
                table: "Accounts",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "AccountImportSettings",
                columns: table => new
                {
                    AccountId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SchemaVersion = table.Column<int>(type: "int", nullable: false),
                    SettingsJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    SourceImportReviewId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SavedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AccountImportSettings", x => x.AccountId);
                    table.CheckConstraint("CK_AccountImportSettings_SchemaVersion", "[SchemaVersion] > 0");
                    table.ForeignKey(
                        name: "FK_AccountImportSettings_Accounts_AccountId",
                        column: x => x.AccountId,
                        principalTable: "Accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ImportReviewMappingSnapshots",
                columns: table => new
                {
                    ReviewId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SchemaVersion = table.Column<int>(type: "int", nullable: false),
                    MappingJson = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ImportReviewMappingSnapshots", x => x.ReviewId);
                    table.CheckConstraint("CK_ImportReviewMappingSnapshots_SchemaVersion", "[SchemaVersion] > 0");
                    table.ForeignKey(
                        name: "FK_ImportReviewMappingSnapshots_ImportReviews_ReviewId",
                        column: x => x.ReviewId,
                        principalTable: "ImportReviews",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AccountImportSettings");

            migrationBuilder.DropTable(
                name: "ImportReviewMappingSnapshots");

            migrationBuilder.DropColumn(
                name: "LastSuccessfulImportReviewId",
                table: "Accounts");
        }
    }
}
