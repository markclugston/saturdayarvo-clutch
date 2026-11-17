using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Clutch.API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ShortenImportReviewLifetime : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                UPDATE [ImportReviews]
                SET [ExpiresAtUtc] = DATEADD(minute, 5, [CreatedAtUtc])
                WHERE [State] = 'Ready'
                    AND [ExpiresAtUtc] > DATEADD(minute, 5, [CreatedAtUtc]);
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {

        }
    }
}
