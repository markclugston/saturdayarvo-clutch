using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Clutch.API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLoanPayoffTimelinePreferences : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UserLoanPayoffTimelinePreferences",
                columns: table => new
                {
                    UserId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: false),
                    View = table.Column<string>(type: "varchar(16)", unicode: false, maxLength: 16, nullable: false),
                    ClientId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ClientSequence = table.Column<long>(type: "bigint", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserLoanPayoffTimelinePreferences", x => x.UserId);
                    table.CheckConstraint("CK_UserLoanPayoffTimelinePreferences_ClientSequence", "[ClientSequence] >= 1");
                    table.CheckConstraint("CK_UserLoanPayoffTimelinePreferences_View", "[View] IN ('Burndown', 'Schedule')");
                    table.ForeignKey(
                        name: "FK_UserLoanPayoffTimelinePreferences_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UserLoanPayoffTimelinePreferences");
        }
    }
}
