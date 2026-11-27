using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Clutch.API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAssets : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // SQL Server refuses ALTER COLUMN while a check constraint references the column, so it is
            // dropped and recreated unchanged around the widening. No audit row is updated.
            migrationBuilder.DropCheckConstraint(
                name: "CK_Audit_NonBlankDescription",
                table: "Audit");

            migrationBuilder.AlterColumn<string>(
                name: "Description",
                table: "Audit",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(500)",
                oldMaxLength: 500);

            migrationBuilder.AddCheckConstraint(
                name: "CK_Audit_NonBlankDescription",
                table: "Audit",
                sql: "LEN(LTRIM(RTRIM([Description]))) > 0");

            migrationBuilder.CreateTable(
                name: "Assets",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OwnerUserId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CurrencyCode = table.Column<string>(type: "nvarchar(3)", maxLength: 3, nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    ActiveEditId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Assets", x => x.Id);
                    table.CheckConstraint("CK_Assets_SupportedCurrency", "[CurrencyCode] IN ('AUD', 'CAD', 'EUR', 'GBP', 'HKD', 'INR', 'JPY', 'NZD', 'SGD', 'USD')");
                    table.ForeignKey(
                        name: "FK_Assets_AspNetUsers_OwnerUserId",
                        column: x => x.OwnerUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "AssetEdits",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AssetId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OwnerUserId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: false),
                    State = table.Column<string>(type: "varchar(16)", unicode: false, maxLength: 16, nullable: false),
                    OpenedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    ExpiresAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    EndedByUserId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: true),
                    EndedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AssetEdits", x => x.Id);
                    table.CheckConstraint("CK_AssetEdits_ValidState", "[State] IN ('Active', 'Saved', 'Released', 'Ended', 'Expired')");
                    table.ForeignKey(
                        name: "FK_AssetEdits_Assets_AssetId",
                        column: x => x.AssetId,
                        principalTable: "Assets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AssetValuations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AssetId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Value = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    ValuationDate = table.Column<DateOnly>(type: "date", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AssetValuations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AssetValuations_Assets_AssetId",
                        column: x => x.AssetId,
                        principalTable: "Assets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AssetEdits_AssetId_State",
                table: "AssetEdits",
                columns: new[] { "AssetId", "State" });

            migrationBuilder.CreateIndex(
                name: "IX_Assets_OwnerUserId_CreatedAtUtc",
                table: "Assets",
                columns: new[] { "OwnerUserId", "CreatedAtUtc", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_AssetValuations_AssetId_ValuationDate",
                table: "AssetValuations",
                columns: new[] { "AssetId", "ValuationDate" },
                unique: true,
                descending: new[] { false, true })
                .Annotation("SqlServer:Include", new[] { "Value" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AssetEdits");

            migrationBuilder.DropTable(
                name: "AssetValuations");

            migrationBuilder.DropTable(
                name: "Assets");

            // Audit.Description stays nvarchar(max): narrowing it would truncate or reject audit rows
            // written since the upgrade, and audit rows are never changed.
        }
    }
}
