using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Clutch.API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class SinglePersonAccountOwnership : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "OwnerUserId",
                table: "Accounts",
                type: "nvarchar(450)",
                maxLength: 450,
                nullable: true);

            migrationBuilder.Sql(
                """
                UPDATE account
                SET OwnerUserId = family.OwnerUserId
                FROM Accounts AS account
                INNER JOIN Families AS family ON family.Id = account.FamilyId
                INNER JOIN AspNetUsers AS owner ON owner.Id = family.OwnerUserId;
                """);

            migrationBuilder.DropForeignKey(
                name: "FK_Accounts_Families_FamilyId",
                table: "Accounts");

            migrationBuilder.DropIndex(
                name: "IX_Accounts_FamilyId",
                table: "Accounts");

            migrationBuilder.DropColumn(
                name: "FamilyId",
                table: "Accounts");

            migrationBuilder.DropTable(name: "Families");

            migrationBuilder.CreateIndex(
                name: "IX_Accounts_OwnerUserId",
                table: "Accounts",
                column: "OwnerUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_Accounts_AspNetUsers_OwnerUserId",
                table: "Accounts",
                column: "OwnerUserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                IF EXISTS (SELECT 1 FROM Accounts WHERE OwnerUserId IS NULL)
                BEGIN
                    THROW 51000, 'Cannot downgrade while accounts have unresolved owners.', 1;
                END;
                """);

            migrationBuilder.DropForeignKey(
                name: "FK_Accounts_AspNetUsers_OwnerUserId",
                table: "Accounts");

            migrationBuilder.DropIndex(
                name: "IX_Accounts_OwnerUserId",
                table: "Accounts");

            migrationBuilder.CreateTable(
                name: "Families",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OwnerUserId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Families", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Families_AspNetUsers_OwnerUserId",
                        column: x => x.OwnerUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.AddColumn<Guid>(
                name: "FamilyId",
                table: "Accounts",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.Sql(
                """
                INSERT INTO Families (Id, OwnerUserId)
                SELECT NEWID(), OwnerUserId
                FROM Accounts
                WHERE OwnerUserId IS NOT NULL
                GROUP BY OwnerUserId;

                UPDATE account
                SET FamilyId = family.Id
                FROM Accounts AS account
                INNER JOIN Families AS family ON family.OwnerUserId = account.OwnerUserId;
                """);

            migrationBuilder.AlterColumn<Guid>(
                name: "FamilyId",
                table: "Accounts",
                type: "uniqueidentifier",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Accounts_FamilyId",
                table: "Accounts",
                column: "FamilyId");

            migrationBuilder.CreateIndex(
                name: "IX_Families_OwnerUserId",
                table: "Families",
                column: "OwnerUserId",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Accounts_Families_FamilyId",
                table: "Accounts",
                column: "FamilyId",
                principalTable: "Families",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.DropColumn(
                name: "OwnerUserId",
                table: "Accounts");
        }
    }
}
