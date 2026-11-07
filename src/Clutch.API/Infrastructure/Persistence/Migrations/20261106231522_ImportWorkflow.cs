using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Clutch.API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ImportWorkflow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ImportReviews",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AccountId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ActingUserId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: false),
                    State = table.Column<string>(type: "varchar(16)", unicode: false, maxLength: 16, nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    ExpiresAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    DuplicateConfirmationRequired = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ImportReviews", x => x.Id);
                    table.CheckConstraint("CK_ImportReviews_ValidState", "[State] IN ('Ready', 'Confirmed', 'Cancelled', 'Expired')");
                    table.ForeignKey(
                        name: "FK_ImportReviews_Accounts_AccountId",
                        column: x => x.AccountId,
                        principalTable: "Accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Transactions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AccountId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TransactionDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(19,4)", precision: 19, scale: 4, nullable: false),
                    Direction = table.Column<string>(type: "varchar(16)", unicode: false, maxLength: 16, nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Transactions", x => x.Id);
                    table.CheckConstraint("CK_Transactions_NonBlankDescription", "LEN(LTRIM(RTRIM([Description]))) > 0");
                    table.CheckConstraint("CK_Transactions_NonNegativeAmount", "[Amount] >= 0");
                    table.CheckConstraint("CK_Transactions_ValidDirection", "[Direction] IN ('Incoming', 'Outgoing')");
                    table.ForeignKey(
                        name: "FK_Transactions_Accounts_AccountId",
                        column: x => x.AccountId,
                        principalTable: "Accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ImportAuditEvents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ReviewId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    AccountId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ActingUserId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: false),
                    EventCode = table.Column<string>(type: "varchar(50)", unicode: false, maxLength: 50, nullable: false),
                    OccurredAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ImportAuditEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ImportAuditEvents_Accounts_AccountId",
                        column: x => x.AccountId,
                        principalTable: "Accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ImportAuditEvents_ImportReviews_ReviewId",
                        column: x => x.ReviewId,
                        principalTable: "ImportReviews",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "ImportReviewRows",
                columns: table => new
                {
                    ReviewId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SourceRowNumber = table.Column<int>(type: "int", nullable: false),
                    TransactionDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(19,4)", precision: 19, scale: 4, nullable: false),
                    Direction = table.Column<string>(type: "varchar(16)", unicode: false, maxLength: 16, nullable: false),
                    IsPossibleDuplicate = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ImportReviewRows", x => new { x.ReviewId, x.SourceRowNumber });
                    table.CheckConstraint("CK_ImportReviewRows_NonBlankDescription", "LEN(LTRIM(RTRIM([Description]))) > 0");
                    table.CheckConstraint("CK_ImportReviewRows_NonNegativeAmount", "[Amount] >= 0");
                    table.CheckConstraint("CK_ImportReviewRows_ValidDirection", "[Direction] IN ('Incoming', 'Outgoing')");
                    table.ForeignKey(
                        name: "FK_ImportReviewRows_ImportReviews_ReviewId",
                        column: x => x.ReviewId,
                        principalTable: "ImportReviews",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Accounts_ActiveImportId",
                table: "Accounts",
                column: "ActiveImportId",
                unique: true,
                filter: "[ActiveImportId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_ImportAuditEvents_AccountId_OccurredAtUtc",
                table: "ImportAuditEvents",
                columns: new[] { "AccountId", "OccurredAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_ImportAuditEvents_ReviewId",
                table: "ImportAuditEvents",
                column: "ReviewId");

            migrationBuilder.CreateIndex(
                name: "IX_ImportReviews_AccountId_State",
                table: "ImportReviews",
                columns: new[] { "AccountId", "State" });

            migrationBuilder.CreateIndex(
                name: "IX_ImportReviews_ExpiresAtUtc",
                table: "ImportReviews",
                column: "ExpiresAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_AccountId_TransactionDate",
                table: "Transactions",
                columns: new[] { "AccountId", "TransactionDate" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ImportAuditEvents");

            migrationBuilder.DropTable(
                name: "ImportReviewRows");

            migrationBuilder.DropTable(
                name: "Transactions");

            migrationBuilder.DropTable(
                name: "ImportReviews");

            migrationBuilder.DropIndex(
                name: "IX_Accounts_ActiveImportId",
                table: "Accounts");
        }
    }
}
