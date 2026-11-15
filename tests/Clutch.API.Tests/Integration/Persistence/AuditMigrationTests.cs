using Clutch.API.Domain.Accounts;
using Clutch.API.Domain.Imports;
using Clutch.API.Infrastructure.Identity;
using Clutch.API.Infrastructure.Persistence;
using Clutch.API.Tests.Integration.Accounts;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Clutch.API.Tests.Integration.Persistence;

[Collection(SqlServerCollection.Name)]
public sealed class AuditMigrationTests(SqlServerFixture fixture)
{
    private const string PrecedingMigration = "20261114205105_AddTransactionDeletionAudit";

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Consolidation_backfills_both_sources_once_and_keeps_audit_immutable_without_account_links()
    {
        await WithLegacyDatabaseAsync(async connectionString =>
        {
            await using var dbContext = CreateDbContext(connectionString);
            await dbContext.Database.MigrateAsync(PrecedingMigration);
            var (ownerUserId, account) = await SeedAccountAsync(dbContext, "Migration savings");
            var importId = Guid.NewGuid();
            var deletionId = Guid.NewGuid();
            var transactionId = Guid.NewGuid();
            var reviewId = Guid.NewGuid();
            var importOccurredAt = new DateTimeOffset(2026, 11, 1, 2, 3, 4, TimeSpan.Zero);
            var deletionOccurredAt = new DateTimeOffset(2026, 11, 2, 3, 4, 5, TimeSpan.Zero);
            dbContext.ImportReviews.Add(new ImportReview(
                reviewId,
                account.Id,
                ownerUserId,
                importOccurredAt.AddMinutes(-1),
                importOccurredAt.AddMinutes(15)));
            await dbContext.SaveChangesAsync();

            await InsertImportEventAsync(
                dbContext,
                importId,
                reviewId,
                account.Id,
                ownerUserId,
                "ReviewCreated",
                importOccurredAt);
            await InsertDeletionEventAsync(
                dbContext,
                deletionId,
                account.Id,
                transactionId,
                ownerUserId,
                deletionOccurredAt);

            await dbContext.Database.MigrateAsync();

            var audits = await dbContext.Audits.AsNoTracking().ToListAsync();
            Assert.Equal(2, audits.Count);
            var importAudit = Assert.Single(audits, audit => audit.EventCode == "ReviewCreated");
            Assert.Equal(ownerUserId, importAudit.ActingUserId);
            Assert.Equal(importOccurredAt, importAudit.OccurredAtUtc);
            Assert.Contains(account.Description, importAudit.Description, StringComparison.Ordinal);
            Assert.DoesNotContain(account.Id.ToString(), importAudit.Description, StringComparison.Ordinal);
            Assert.DoesNotContain(reviewId.ToString(), importAudit.Description, StringComparison.Ordinal);
            Assert.DoesNotContain(importId.ToString(), importAudit.Description, StringComparison.Ordinal);

            var deletionAudit = Assert.Single(audits, audit => audit.EventCode == "TransactionDelete");
            Assert.Equal(ownerUserId, deletionAudit.ActingUserId);
            Assert.Equal(deletionOccurredAt, deletionAudit.OccurredAtUtc);
            Assert.Contains("reviewed and deleted", deletionAudit.Description, StringComparison.OrdinalIgnoreCase);
            Assert.Contains(account.Description, deletionAudit.Description, StringComparison.Ordinal);
            Assert.DoesNotContain(account.Id.ToString(), deletionAudit.Description, StringComparison.Ordinal);
            Assert.DoesNotContain(transactionId.ToString(), deletionAudit.Description, StringComparison.Ordinal);
            Assert.DoesNotContain(deletionId.ToString(), deletionAudit.Description, StringComparison.Ordinal);

            Assert.Equal(0, await dbContext.Database.SqlQuery<int>(
                $"SELECT COUNT(*) AS [Value] FROM sys.tables WHERE [name] IN ('ImportAuditEvents', 'TransactionDeletionAudits')")
                .SingleAsync());
            Assert.Equal(0, await dbContext.Database.SqlQuery<int>(
                $"SELECT COUNT(*) AS [Value] FROM sys.columns WHERE [object_id] = OBJECT_ID(N'dbo.Audit') AND [name] IN ('AccountId', 'TransactionId', 'ReviewId')")
                .SingleAsync());

            var preserved = audits.ToDictionary(audit => audit.Id, audit => audit.Description);
            await Assert.ThrowsAsync<SqlException>(() => dbContext.Database.ExecuteSqlInterpolatedAsync(
                $"UPDATE Audit SET Description = Description WHERE Id = {importAudit.Id}"));
            await Assert.ThrowsAsync<SqlException>(() => dbContext.Database.ExecuteSqlInterpolatedAsync(
                $"DELETE FROM Audit WHERE Id = {deletionAudit.Id}"));
            Assert.Equal(preserved[importAudit.Id],
                await dbContext.Audits.Where(audit => audit.Id == importAudit.Id)
                    .Select(audit => audit.Description)
                    .SingleAsync());
            Assert.Equal(preserved[deletionAudit.Id],
                await dbContext.Audits.Where(audit => audit.Id == deletionAudit.Id)
                    .Select(audit => audit.Description)
                    .SingleAsync());

            await Assert.ThrowsAsync<SqlException>(() => dbContext.Database.ExecuteSqlInterpolatedAsync(
                $"INSERT INTO Audit (Id, ActingUserId, OccurredAtUtc, EventCode, Description) VALUES ({Guid.NewGuid()}, {ownerUserId}, {DateTimeOffset.UtcNow}, {" "}, {"valid description"})"));
            await Assert.ThrowsAsync<SqlException>(() => dbContext.Database.ExecuteSqlInterpolatedAsync(
                $"INSERT INTO Audit (Id, ActingUserId, OccurredAtUtc, EventCode, Description) VALUES ({Guid.NewGuid()}, {ownerUserId}, {DateTimeOffset.UtcNow}, {"ReviewCreated"}, {" "})"));

            dbContext.ImportReviews.Remove(await dbContext.ImportReviews.SingleAsync(
                candidate => candidate.Id == reviewId));
            await dbContext.SaveChangesAsync();
            dbContext.Accounts.Remove(await dbContext.Accounts.SingleAsync(
                candidate => candidate.Id == account.Id));
            await dbContext.SaveChangesAsync();
            Assert.Equal(2, await dbContext.Audits.CountAsync());
            Assert.All(await dbContext.Audits.AsNoTracking().ToListAsync(), audit =>
                Assert.Contains(account.Description, audit.Description, StringComparison.Ordinal));

            await Assert.ThrowsAsync<NotSupportedException>(async () =>
                await dbContext.Database.MigrateAsync(PrecedingMigration));
            Assert.Equal(2, await dbContext.Audits.CountAsync());
        });
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    [Trait("Category", "SqlServer")]
    public async Task Consolidation_failure_is_atomic_and_can_be_retried_after_repair(bool blankImportEventCode)
    {
        await WithLegacyDatabaseAsync(async connectionString =>
        {
            await using var dbContext = CreateDbContext(connectionString);
            await dbContext.Database.MigrateAsync(PrecedingMigration);
            var (ownerUserId, account) = await SeedAccountAsync(dbContext, "Retry savings");
            var importId = Guid.NewGuid();
            var reviewId = Guid.NewGuid();
            var eventCode = blankImportEventCode ? " " : "ReviewCreated";
            dbContext.ImportReviews.Add(new ImportReview(
                reviewId,
                account.Id,
                ownerUserId,
                DateTimeOffset.UtcNow,
                DateTimeOffset.UtcNow.AddMinutes(15)));
            await dbContext.SaveChangesAsync();
            await InsertImportEventAsync(
                dbContext,
                importId,
                reviewId,
                account.Id,
                ownerUserId,
                eventCode,
                DateTimeOffset.UtcNow);

            Guid? missingAccountId = null;
            if (blankImportEventCode)
            {
                await InsertDeletionEventAsync(
                    dbContext,
                    Guid.NewGuid(),
                    account.Id,
                    Guid.NewGuid(),
                    ownerUserId,
                    DateTimeOffset.UtcNow);
            }
            else
            {
                missingAccountId = Guid.NewGuid();
                await InsertDeletionEventAsync(
                    dbContext,
                    Guid.NewGuid(),
                    missingAccountId.Value,
                    Guid.NewGuid(),
                    ownerUserId,
                    DateTimeOffset.UtcNow);
            }

            await Assert.ThrowsAsync<SqlException>(() => dbContext.Database.MigrateAsync());

            Assert.Equal(0, await dbContext.Database.SqlQuery<int>(
                $"SELECT COUNT(*) AS [Value] FROM sys.tables WHERE [name] = 'Audit'")
                .SingleAsync());
            Assert.Equal(1, await dbContext.Database.SqlQuery<int>(
                $"SELECT COUNT(*) AS [Value] FROM ImportAuditEvents")
                .SingleAsync());
            Assert.Equal(1, await dbContext.Database.SqlQuery<int>(
                $"SELECT COUNT(*) AS [Value] FROM TransactionDeletionAudits")
                .SingleAsync());

            if (missingAccountId is Guid unresolvedId)
            {
                await dbContext.Database.ExecuteSqlInterpolatedAsync(
                    $"INSERT INTO Accounts (Id, OwnerUserId, Description, CurrencyCode) VALUES ({unresolvedId}, {ownerUserId}, {"Recovered account"}, {"AUD"})");
            }
            else
            {
                await dbContext.Database.ExecuteSqlInterpolatedAsync(
                    $"UPDATE ImportAuditEvents SET EventCode = {"ReviewCreated"} WHERE Id = {importId}");
            }

            await dbContext.Database.MigrateAsync();
            Assert.Equal(2, await dbContext.Audits.CountAsync());
            Assert.Equal(0, await dbContext.Database.SqlQuery<int>(
                $"SELECT COUNT(*) AS [Value] FROM sys.tables WHERE [name] IN ('ImportAuditEvents', 'TransactionDeletionAudits')")
                .SingleAsync());
        });
    }

    private static AppDbContext CreateDbContext(string connectionString) =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlServer(connectionString)
            .Options);

    private static async Task<(string OwnerUserId, Account Account)> SeedAccountAsync(
        AppDbContext dbContext,
        string description)
    {
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
        Assert.True(Account.TryCreate(ownerUserId, description, "AUD", out var account));
        dbContext.Accounts.Add(account!);
        await dbContext.SaveChangesAsync();
        return (ownerUserId, account!);
    }

    private static Task<int> InsertImportEventAsync(
        AppDbContext dbContext,
        Guid id,
        Guid reviewId,
        Guid accountId,
        string actingUserId,
        string eventCode,
        DateTimeOffset occurredAtUtc) =>
        dbContext.Database.ExecuteSqlInterpolatedAsync(
            $"INSERT INTO ImportAuditEvents (Id, ReviewId, AccountId, ActingUserId, EventCode, OccurredAtUtc) VALUES ({id}, {reviewId}, {accountId}, {actingUserId}, {eventCode}, {occurredAtUtc})");

    private static Task<int> InsertDeletionEventAsync(
        AppDbContext dbContext,
        Guid id,
        Guid accountId,
        Guid transactionId,
        string actingUserId,
        DateTimeOffset deletedAtUtc) =>
        dbContext.Database.ExecuteSqlInterpolatedAsync(
            $"INSERT INTO TransactionDeletionAudits (Id, ActingUserId, AccountId, TransactionId, DeletedAtUtc) VALUES ({id}, {actingUserId}, {accountId}, {transactionId}, {deletedAtUtc})");

    private async Task WithLegacyDatabaseAsync(Func<string, Task> action)
    {
        var databaseName = $"AuditMigration_{Guid.NewGuid():N}";
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
