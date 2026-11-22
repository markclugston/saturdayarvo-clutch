using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Clutch.API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class MortgageAccountLink : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "AccountId",
                table: "Mortgages",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Mortgages_AccountId",
                table: "Mortgages",
                column: "AccountId");

            migrationBuilder.AddForeignKey(
                name: "FK_Mortgages_Accounts_AccountId",
                table: "Mortgages",
                column: "AccountId",
                principalTable: "Accounts",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Mortgages_Accounts_AccountId",
                table: "Mortgages");

            migrationBuilder.DropIndex(
                name: "IX_Mortgages_AccountId",
                table: "Mortgages");

            migrationBuilder.DropColumn(
                name: "AccountId",
                table: "Mortgages");
        }
    }
}
