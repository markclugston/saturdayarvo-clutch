using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Clutch.API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ImportLimitsAndRateWindows : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ImportLimitSettings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false),
                    MaxFileSizeBytes = table.Column<int>(type: "int", nullable: false),
                    MaxRowsPerImport = table.Column<int>(type: "int", nullable: false),
                    MaxImportAttemptsPerUserPerMinute = table.Column<int>(type: "int", nullable: false),
                    UpdatedByUserId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ImportLimitSettings", x => x.Id);
                    table.CheckConstraint("CK_ImportLimitSettings_PositiveValues", "[MaxFileSizeBytes] > 0 AND [MaxRowsPerImport] > 0 AND [MaxImportAttemptsPerUserPerMinute] > 0");
                    table.CheckConstraint("CK_ImportLimitSettings_SingletonId", "[Id] = 1");
                });

            migrationBuilder.CreateTable(
                name: "ImportRateWindows",
                columns: table => new
                {
                    UserId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: false),
                    WindowStartedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    AttemptCount = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ImportRateWindows", x => new { x.UserId, x.WindowStartedAtUtc });
                    table.CheckConstraint("CK_ImportRateWindows_PositiveAttemptCount", "[AttemptCount] > 0");
                    table.ForeignKey(
                        name: "FK_ImportRateWindows_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ImportRateWindows_WindowStartedAtUtc",
                table: "ImportRateWindows",
                column: "WindowStartedAtUtc");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ImportLimitSettings");

            migrationBuilder.DropTable(
                name: "ImportRateWindows");
        }
    }
}
