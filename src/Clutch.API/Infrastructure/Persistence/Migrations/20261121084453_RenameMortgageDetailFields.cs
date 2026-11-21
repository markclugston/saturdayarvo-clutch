using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Clutch.API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RenameMortgageDetailFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "StartingBalance",
                table: "Mortgages",
                newName: "OpeningBalance");

            migrationBuilder.RenameColumn(
                name: "RepaymentFrequency",
                table: "Mortgages",
                newName: "PaymentFrequency");

            migrationBuilder.RenameColumn(
                name: "NumberOfPeriods",
                table: "Mortgages",
                newName: "Duration");

            migrationBuilder.RenameColumn(
                name: "FirstRepaymentDate",
                table: "Mortgages",
                newName: "DrawdownDate");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "PaymentFrequency",
                table: "Mortgages",
                newName: "RepaymentFrequency");

            migrationBuilder.RenameColumn(
                name: "OpeningBalance",
                table: "Mortgages",
                newName: "StartingBalance");

            migrationBuilder.RenameColumn(
                name: "Duration",
                table: "Mortgages",
                newName: "NumberOfPeriods");

            migrationBuilder.RenameColumn(
                name: "DrawdownDate",
                table: "Mortgages",
                newName: "FirstRepaymentDate");
        }
    }
}
