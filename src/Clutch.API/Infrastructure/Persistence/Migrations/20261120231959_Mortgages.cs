using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Clutch.API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Mortgages : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Mortgages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OwnerUserId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false, collation: "Latin1_General_100_CI_AS"),
                    StartingBalance = table.Column<decimal>(type: "decimal(19,2)", nullable: false),
                    NumberOfPeriods = table.Column<int>(type: "int", nullable: false),
                    FirstRepaymentDate = table.Column<DateOnly>(type: "date", nullable: false),
                    RepaymentFrequency = table.Column<string>(type: "varchar(20)", unicode: false, maxLength: 20, nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Mortgages", x => x.Id);
                    table.CheckConstraint("CK_Mortgages_NonBlankName", "LEN(LTRIM(RTRIM([Name]))) > 0");
                    table.ForeignKey(
                        name: "FK_Mortgages_AspNetUsers_OwnerUserId",
                        column: x => x.OwnerUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "MortgageInterestRateChanges",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MortgageId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    NewInterestRate = table.Column<decimal>(type: "decimal(5,2)", nullable: false),
                    EffectiveDate = table.Column<DateOnly>(type: "date", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MortgageInterestRateChanges", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MortgageInterestRateChanges_Mortgages_MortgageId",
                        column: x => x.MortgageId,
                        principalTable: "Mortgages",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_MortgageInterestRateChanges_MortgageId_EffectiveDate",
                table: "MortgageInterestRateChanges",
                columns: new[] { "MortgageId", "EffectiveDate" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Mortgages_OwnerUserId_CreatedAtUtc",
                table: "Mortgages",
                columns: new[] { "OwnerUserId", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_Mortgages_OwnerUserId_Name",
                table: "Mortgages",
                columns: new[] { "OwnerUserId", "Name" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MortgageInterestRateChanges");

            migrationBuilder.DropTable(
                name: "Mortgages");
        }
    }
}
