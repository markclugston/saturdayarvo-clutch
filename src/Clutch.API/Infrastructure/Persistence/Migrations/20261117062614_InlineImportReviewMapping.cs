using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Clutch.API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InlineImportReviewMapping : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "MappingJson",
                table: "ImportReviews",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SchemaVersion",
                table: "ImportReviews",
                type: "int",
                nullable: true);

            migrationBuilder.Sql(
                """
                UPDATE review
                SET review.[SchemaVersion] = snapshot.[SchemaVersion],
                    review.[MappingJson] = snapshot.[MappingJson]
                FROM [ImportReviews] AS review
                INNER JOIN [ImportReviewMappingSnapshots] AS snapshot
                    ON snapshot.[ReviewId] = review.[Id];
                """);

            migrationBuilder.DropTable(
                name: "ImportReviewMappingSnapshots");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ImportReviews_Mapping",
                table: "ImportReviews",
                sql: "([SchemaVersion] IS NULL AND [MappingJson] IS NULL) OR ([SchemaVersion] IS NOT NULL AND [SchemaVersion] > 0 AND [MappingJson] IS NOT NULL)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_ImportReviews_Mapping",
                table: "ImportReviews");

            migrationBuilder.CreateTable(
                name: "ImportReviewMappingSnapshots",
                columns: table => new
                {
                    ReviewId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MappingJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    SchemaVersion = table.Column<int>(type: "int", nullable: false)
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

            migrationBuilder.Sql(
                """
                INSERT INTO [ImportReviewMappingSnapshots] ([ReviewId], [SchemaVersion], [MappingJson])
                SELECT [Id], [SchemaVersion], [MappingJson]
                FROM [ImportReviews]
                WHERE [SchemaVersion] IS NOT NULL AND [MappingJson] IS NOT NULL;
                """);

            migrationBuilder.DropColumn(
                name: "MappingJson",
                table: "ImportReviews");

            migrationBuilder.DropColumn(
                name: "SchemaVersion",
                table: "ImportReviews");
        }
    }
}
