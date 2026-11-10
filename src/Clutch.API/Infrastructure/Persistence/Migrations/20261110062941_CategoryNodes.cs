using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Clutch.API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CategoryNodes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CategoryNodes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OwnerUserId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: false),
                    ParentId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Position = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CategoryNodes", x => x.Id);
                    table.CheckConstraint("CK_CategoryNodes_NonBlankName", "LEN(LTRIM(RTRIM([Name]))) > 0");
                    table.ForeignKey(
                        name: "FK_CategoryNodes_AspNetUsers_OwnerUserId",
                        column: x => x.OwnerUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CategoryNodes_CategoryNodes_ParentId",
                        column: x => x.ParentId,
                        principalTable: "CategoryNodes",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_CategoryNodes_OwnerUserId_ParentId",
                table: "CategoryNodes",
                columns: new[] { "OwnerUserId", "ParentId" });

            migrationBuilder.CreateIndex(
                name: "IX_CategoryNodes_OwnerUserId_ParentId_Name",
                table: "CategoryNodes",
                columns: new[] { "OwnerUserId", "ParentId", "Name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CategoryNodes_OwnerUserId_ParentId_Position",
                table: "CategoryNodes",
                columns: new[] { "OwnerUserId", "ParentId", "Position" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CategoryNodes_ParentId",
                table: "CategoryNodes",
                column: "ParentId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CategoryNodes");
        }
    }
}
