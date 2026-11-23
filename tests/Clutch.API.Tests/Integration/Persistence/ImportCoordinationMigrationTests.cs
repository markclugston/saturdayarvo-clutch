using Clutch.API.Domain.Accounts;
using Clutch.API.Domain.Audit;
using Clutch.API.Domain.Imports;
using Clutch.API.Domain.Shared;
using Clutch.API.Domain.Transactions;
using Clutch.API.Infrastructure.Identity;
using Clutch.API.Infrastructure.Persistence;
using Clutch.API.Infrastructure.Persistence.Entities;
using Clutch.API.Tests.Integration.Accounts;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Clutch.API.Tests.Integration.Persistence;

[Collection(SqlServerCollection.Name)]
public sealed class ImportCoordinationMigrationTests(SqlServerFixture fixture)
{
    private const string PrecedingMigration = "20261117062614_InlineImportReviewMapping";

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Migration_preserves_existing_import_data_and_enforces_coordination_shapes()
    {
        await WithDatabaseAsync(async connectionString =>
        {
            await using var dbContext = CreateDbContext(connectionString);
            await dbContext.Database.MigrateAsync(PrecedingMigration);
            var ownerUserId = Guid.NewGuid().ToString("N");
            var email = $"{ownerUserId}@example.test";
            dbContext.Users.Add(new ApplicationUser
            {
                Id = ownerUserId,
                UserName = email,
                NormalizedUserName = email.ToUpperInvariant(),
                Email = email,
                NormalizedEmail = email.ToUpperInvariant(),
                EmailConfirmed = true,
                SecurityStamp = Guid.NewGuid().ToString("N"),
                ConcurrencyStamp = Guid.NewGuid().ToString("N"),
            });
            Assert.True(Account.TryCreate(ownerUserId, "Coordination migration", "AUD", out var account));
            dbContext.Accounts.Add(account!);
            dbContext.AccountImportSettings.Add(AccountImportSettings.Create(
                account!.Id,
                1,
                """{"dateColumn":0}""",
                DateTimeOffset.UtcNow));
            var audit = new Audit(
                ownerUserId,
                DateTimeOffset.UtcNow,
                "MigrationPreserved",
                "Import migration preservation test.");
            dbContext.Audits.Add(audit);

            var reviewId = Guid.NewGuid();
            Assert.True(account.TryAcquireImport(reviewId));
            await dbContext.SaveChangesAsync();
            // Inserted with SQL because the current model has a column the preceding schema lacks.
            var transactionId = Guid.NewGuid();
            await dbContext.Database.ExecuteSqlInterpolatedAsync(
                $"INSERT INTO Transactions (Id, AccountId, TransactionDate, Description, Amount, Direction, Balance, CreatedAtUtc) VALUES ({transactionId}, {account.Id}, {new DateOnly(2025, 1, 15)}, {"Existing transaction"}, {42.50m}, {"Outgoing"}, {100.25m}, {DateTimeOffset.UtcNow})");
            var createdAt = DateTimeOffset.UtcNow.AddMinutes(-1);
            var expiresAt = createdAt.AddMinutes(5);
            const string mappingJson = """{"dateColumn":0}""";
            const string readyState = "Ready";
            const string processingState = "Processing";
            const string cancelledState = "Cancelled";
            const string incomingDirection = "Incoming";
            const string stagedDescription = "Staged transaction";
            await dbContext.Database.ExecuteSqlInterpolatedAsync(
                $"INSERT INTO ImportReviews (Id, AccountId, ActingUserId, State, CreatedAtUtc, ExpiresAtUtc, SchemaVersion, MappingJson, DuplicateConfirmationRequired) VALUES ({reviewId}, {account.Id}, {ownerUserId}, {readyState}, {createdAt}, {expiresAt}, {1}, {mappingJson}, {false})");
            await dbContext.Database.ExecuteSqlInterpolatedAsync(
                $"INSERT INTO ImportReviewRows (ReviewId, SourceRowNumber, TransactionDate, Description, Amount, Direction, Balance, IsPossibleDuplicate) VALUES ({reviewId}, {2}, {new DateOnly(2025, 1, 16)}, {stagedDescription}, {12.34m}, {incomingDirection}, {55.55m}, {false})");

            await dbContext.Database.MigrateAsync();
            dbContext.ChangeTracker.Clear();

            var preservedReview = await dbContext.ImportReviews
                .Include(review => review.Rows)
                .SingleAsync(review => review.Id == reviewId);
            Assert.Equal(ImportReviewState.Ready, preservedReview.State);
            Assert.Equal(1, preservedReview.SchemaVersion);
            Assert.Single(preservedReview.Rows);
            Assert.Equal(reviewId, await dbContext.Accounts
                .Where(candidate => candidate.Id == account.Id)
                .Select(candidate => candidate.ActiveImportId)
                .SingleAsync());
            Assert.Equal(mappingJson, await dbContext.AccountImportSettings
                .Where(settings => settings.AccountId == account.Id)
                .Select(settings => settings.SettingsJson)
                .SingleAsync());
            var preservedTransaction = await dbContext.Transactions.SingleAsync(
                candidate => candidate.Id == transactionId);
            Assert.Equal(100.25m, preservedTransaction.Balance);
            Assert.Equal(audit.Description, await dbContext.Audits
                .Where(candidate => candidate.Id == audit.Id)
                .Select(candidate => candidate.Description)
                .SingleAsync());

            await Assert.ThrowsAsync<SqlException>(() =>
                dbContext.Database.ExecuteSqlInterpolatedAsync(
                    $"UPDATE ImportReviews SET State = {processingState} WHERE Id = {reviewId}"));
            await Assert.ThrowsAsync<SqlException>(() =>
                dbContext.Database.ExecuteSqlInterpolatedAsync(
                    $"UPDATE ImportReviews SET ConfirmationAttemptId = {Guid.NewGuid()} WHERE Id = {reviewId}"));

            var attemptId = Guid.NewGuid();
            var processingAt = DateTimeOffset.UtcNow;
            await dbContext.Database.ExecuteSqlInterpolatedAsync(
                $"UPDATE ImportReviews SET State = {processingState}, ConfirmationAttemptId = {attemptId}, ProcessingStartedAtUtc = {processingAt} WHERE Id = {reviewId}");
            await dbContext.Database.ExecuteSqlInterpolatedAsync(
                $"UPDATE ImportReviews SET State = {readyState}, ConfirmationAttemptId = NULL, ProcessingStartedAtUtc = NULL WHERE Id = {reviewId}");

            await Assert.ThrowsAsync<SqlException>(() =>
                dbContext.Database.ExecuteSqlInterpolatedAsync(
                    $"UPDATE ImportReviews SET State = {readyState}, EndedByUserId = {ownerUserId}, EndedAtUtc = {DateTimeOffset.UtcNow} WHERE Id = {reviewId}"));

            await dbContext.Database.ExecuteSqlInterpolatedAsync(
                $"UPDATE ImportReviewRows SET Description = {stagedDescription} WHERE ReviewId = {reviewId}");
            await dbContext.Database.ExecuteSqlInterpolatedAsync(
                $"UPDATE ImportReviews SET State = {cancelledState}, EndedByUserId = {ownerUserId}, EndedAtUtc = {DateTimeOffset.UtcNow}, SchemaVersion = NULL, MappingJson = NULL WHERE Id = {reviewId}");

            await Assert.ThrowsAsync<SqlException>(() =>
                dbContext.Database.ExecuteSqlInterpolatedAsync(
                    $"UPDATE Audit SET Description = Description WHERE Id = {audit.Id}"));
            await Assert.ThrowsAsync<SqlException>(() =>
                dbContext.Database.ExecuteSqlInterpolatedAsync(
                    $"DELETE FROM Audit WHERE Id = {audit.Id}"));
            Assert.Equal(1, await dbContext.Audits.CountAsync(candidate => candidate.Id == audit.Id));
            Assert.Equal(0, await dbContext.Database.SqlQuery<int>(
                $"SELECT COUNT(*) AS [Value] FROM sys.columns WHERE [object_id] = OBJECT_ID(N'dbo.Audit') AND [name] IN ('AccountId', 'ReviewId')")
                .SingleAsync());
        });
    }

    private static AppDbContext CreateDbContext(string connectionString) =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlServer(connectionString)
            .Options);

    private async Task WithDatabaseAsync(Func<string, Task> action)
    {
        var databaseName = $"ImportCoordination_{Guid.NewGuid():N}";
        var adminConnectionString = new SqlConnectionStringBuilder(fixture.ConnectionString)
        {
            InitialCatalog = "master",
        };
        var targetConnectionString = new SqlConnectionStringBuilder(fixture.ConnectionString)
        {
            InitialCatalog = databaseName,
        };

        await using (var connection = new SqlConnection(adminConnectionString.ConnectionString))
        {
            await connection.OpenAsync();
            await using var command = connection.CreateCommand();
            command.CommandText = $"CREATE DATABASE [{databaseName}]";
            await command.ExecuteNonQueryAsync();
        }

        try
        {
            await action(targetConnectionString.ConnectionString);
        }
        finally
        {
            await using var connection = new SqlConnection(adminConnectionString.ConnectionString);
            await connection.OpenAsync();
            await using var command = connection.CreateCommand();
            command.CommandText =
                $"ALTER DATABASE [{databaseName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{databaseName}]";
            await command.ExecuteNonQueryAsync();
        }
    }
}
