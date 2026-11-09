using Clutch.API.Api.ProblemDetails;
using Clutch.API.Application.Accounts;
using Clutch.API.Application.Imports;
using Clutch.API.Application.Transactions;
using Clutch.API.Domain.Accounts;
using Clutch.API.Domain.Imports;
using Clutch.API.Domain.Transactions;
using Clutch.API.Infrastructure.Identity;
using Clutch.API.Infrastructure.Imports;
using Clutch.API.Infrastructure.Persistence;
using Clutch.API.Infrastructure.Persistence.Entities;
using Clutch.API.Tests.Integration.Accounts;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;

namespace Clutch.API.Tests.Integration.Persistence;

[Collection(SqlServerCollection.Name)]
public sealed class SinglePersonAccountOwnershipMigrationTests(SqlServerFixture fixture)
{
    private const string PrecedingMigration = "20261109070421_ThemePreferences";

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Upgrade_maps_each_family_owner_and_preserves_linked_data()
    {
        await WithLegacyDatabaseAsync(async connectionString =>
        {
            await using var dbContext = CreateDbContext(connectionString);
            await dbContext.Database.MigrateAsync(PrecedingMigration);

            var firstUserId = Guid.NewGuid().ToString("N");
            var secondUserId = Guid.NewGuid().ToString("N");
            await AddUserAsync(dbContext, firstUserId);
            await AddUserAsync(dbContext, secondUserId);

            var firstFamilyId = Guid.NewGuid();
            var secondFamilyId = Guid.NewGuid();
            var firstAccountId = Guid.NewGuid();
            var secondAccountId = Guid.NewGuid();
            var firstTransactionId = Guid.NewGuid();
            var secondTransactionId = Guid.NewGuid();
            var firstReviewId = await InsertLegacyAccountAsync(
                dbContext,
                firstFamilyId,
                firstUserId,
                firstAccountId,
                firstTransactionId);
            var secondReviewId = await InsertLegacyAccountAsync(
                dbContext,
                secondFamilyId,
                secondUserId,
                secondAccountId,
                secondTransactionId);

            await dbContext.Database.MigrateAsync();

            var accounts = await dbContext.Accounts
                .AsNoTracking()
                .ToListAsync();
            var ownersByAccountId = accounts.ToDictionary(account => account.Id, account => account.OwnerUserId);
            Assert.Equal(firstUserId, ownersByAccountId[firstAccountId]);
            Assert.Equal(secondUserId, ownersByAccountId[secondAccountId]);
            Assert.Equal(2, await dbContext.Transactions.CountAsync());
            Assert.Equal(2, await dbContext.AccountImportSettings.CountAsync());
            Assert.Equal(2, await dbContext.ImportReviews.CountAsync());
            Assert.Equal(2, await dbContext.ImportReviewRows.CountAsync());
            Assert.Equal(2, await dbContext.ImportReviewMappingSnapshots.CountAsync());
            Assert.Equal(2, await dbContext.ImportAuditEvents.CountAsync());
            await AssertImportRecordsPreservedAsync(
                dbContext,
                firstAccountId,
                firstReviewId,
                firstUserId);
            await AssertImportRecordsPreservedAsync(
                dbContext,
                secondAccountId,
                secondReviewId,
                secondUserId);
        });
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Unresolved_owners_remain_inaccessible_until_repaired()
    {
        await WithLegacyDatabaseAsync(async connectionString =>
        {
            Guid accountId;
            Guid transactionId;
            var ownerUserId = Guid.NewGuid().ToString("N");
            var legacyOwnerUserId = Guid.NewGuid().ToString("N");
            Guid reviewId;
            await using (var dbContext = CreateDbContext(connectionString))
            {
                await dbContext.Database.MigrateAsync(PrecedingMigration);
                await AddUserAsync(dbContext, ownerUserId);
                accountId = Guid.NewGuid();
                transactionId = Guid.NewGuid();
                reviewId = await InsertLegacyAccountAsync(
                    dbContext,
                    Guid.NewGuid(),
                    legacyOwnerUserId,
                    accountId,
                    transactionId,
                    disableFamilyOwnerConstraint: true);
                await dbContext.Database.MigrateAsync();

                var accountService = new AccountService(dbContext);
                Assert.Empty(await accountService.GetOwnedAccountsAsync(ownerUserId, CancellationToken.None));
                Assert.Null(await accountService.GetOwnedAsync(
                    ownerUserId,
                    accountId,
                    CancellationToken.None));
                var transactionService = new TransactionService(dbContext);
                var exception = await Assert.ThrowsAsync<ApiProblemException>(
                    () => transactionService.GetPageAsync(
                        ownerUserId,
                        accountId,
                        null,
                        null,
                        CancellationToken.None));
                Assert.Equal(StatusCodes.Status404NotFound, exception.StatusCode);
                Assert.Contains(await dbContext.Transactions.AsNoTracking().ToListAsync(),
                    transaction => transaction.Id == transactionId);
                await AssertImportRecordsPreservedAsync(
                    dbContext,
                    accountId,
                    reviewId,
                    legacyOwnerUserId);

                var importSettings = CreateAccountImportSettingsService(dbContext);
                await Assert.ThrowsAsync<ApiProblemException>(
                    () => importSettings.GetAsync(
                        ownerUserId,
                        accountId,
                        CancellationToken.None));
                var importReviewService = CreateImportReviewService(dbContext);
                await Assert.ThrowsAsync<ApiProblemException>(
                    () => importReviewService.CancelAsync(
                        ownerUserId,
                        reviewId,
                        CancellationToken.None));
            }

            await using (var dbContext = CreateDbContext(connectionString))
            {
                await Assert.ThrowsAsync<SqlException>(
                    () => dbContext.Database.MigrateAsync(PrecedingMigration));
                Assert.Null(await dbContext.Accounts
                    .AsNoTracking()
                    .Where(account => account.Id == accountId)
                    .Select(account => account.OwnerUserId)
                    .SingleAsync());
                Assert.Contains(await dbContext.Transactions.AsNoTracking().ToListAsync(),
                    transaction => transaction.Id == transactionId);
                await AssertImportRecordsPreservedAsync(
                    dbContext,
                    accountId,
                    reviewId,
                    legacyOwnerUserId);
            }

            await using (var dbContext = CreateDbContext(connectionString))
            {
                await dbContext.Database.ExecuteSqlInterpolatedAsync(
                    $"UPDATE Accounts SET OwnerUserId = {ownerUserId} WHERE Id = {accountId}");
                var accountService = new AccountService(dbContext);
                Assert.NotNull(await accountService.GetOwnedAsync(
                    ownerUserId,
                    accountId,
                    CancellationToken.None));
                var settingsService = CreateAccountImportSettingsService(dbContext);
                Assert.NotNull((await settingsService.GetAsync(
                    ownerUserId,
                    accountId,
                    CancellationToken.None)).Mapping);
                var otherUserId = Guid.NewGuid().ToString("N");
                await Assert.ThrowsAsync<ApiProblemException>(
                    () => settingsService.GetAsync(
                        otherUserId,
                        accountId,
                        CancellationToken.None));
                var importReviewService = CreateImportReviewService(dbContext);
                await Assert.ThrowsAsync<ApiProblemException>(
                    () => importReviewService.CancelAsync(
                        otherUserId,
                        reviewId,
                        CancellationToken.None));
                Assert.Single(await dbContext.ImportReviewRows
                    .Where(row => row.ReviewId == reviewId)
                    .ToListAsync());
                Assert.True(await dbContext.ImportReviewMappingSnapshots
                    .AnyAsync(snapshot => snapshot.ReviewId == reviewId));
                await importReviewService.CancelAsync(
                    ownerUserId,
                    reviewId,
                    CancellationToken.None);
                Assert.Equal(
                    ImportReviewState.Cancelled,
                    await dbContext.ImportReviews
                        .Where(review => review.Id == reviewId)
                        .Select(review => review.State)
                        .SingleAsync());
                Assert.Empty(await dbContext.ImportReviewRows
                    .Where(row => row.ReviewId == reviewId)
                    .ToListAsync());
                Assert.Empty(await dbContext.ImportReviewMappingSnapshots
                    .Where(snapshot => snapshot.ReviewId == reviewId)
                    .ToListAsync());
                Assert.Contains(await dbContext.ImportAuditEvents
                    .Where(auditEvent => auditEvent.AccountId == accountId)
                    .ToListAsync(),
                    auditEvent => auditEvent.EventCode == "ReviewCancelled");
                var transactionService = new TransactionService(dbContext);
                var page = await transactionService.GetPageAsync(
                    ownerUserId,
                    accountId,
                    null,
                    null,
                    CancellationToken.None);
                Assert.Contains(page.Items, item => item.Id == transactionId);
                await Assert.ThrowsAsync<ApiProblemException>(
                    () => transactionService.GetPageAsync(
                        Guid.NewGuid().ToString("N"),
                        accountId,
                        null,
                        null,
                        CancellationToken.None));
            }
        });
    }

    private static AppDbContext CreateDbContext(string connectionString) =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlServer(connectionString)
            .Options);

    private static AccountImportSettingsService CreateAccountImportSettingsService(
        AppDbContext dbContext) =>
        new(dbContext, TimeProvider.System, NullLogger<AccountImportSettingsService>.Instance);

    private static ImportReviewService CreateImportReviewService(AppDbContext dbContext)
    {
        var clock = TimeProvider.System;
        var auditWriter = new ImportAuditWriter(dbContext, clock);
        return new ImportReviewService(
            dbContext,
            new CsvImportParser(),
            new AccountImportLease(dbContext),
            auditWriter,
            Substitute.For<IImportAttemptLimiter>(),
            clock);
    }

    private static async Task AssertImportRecordsPreservedAsync(
        AppDbContext dbContext,
        Guid accountId,
        Guid reviewId,
        string actingUserId)
    {
        var review = await dbContext.ImportReviews
            .AsNoTracking()
            .Include(candidate => candidate.Rows)
            .SingleAsync(candidate => candidate.Id == reviewId);
        Assert.Equal(accountId, review.AccountId);
        Assert.Equal(actingUserId, review.ActingUserId);
        Assert.Single(review.Rows);
        Assert.Equal("Legacy imported row", review.Rows.Single().Description);
        Assert.True(await dbContext.AccountImportSettings
            .AsNoTracking()
            .AnyAsync(settings => settings.AccountId == accountId
                && settings.SourceImportReviewId == reviewId));
        Assert.True(await dbContext.ImportReviewMappingSnapshots
            .AsNoTracking()
            .AnyAsync(snapshot => snapshot.ReviewId == reviewId));
        Assert.True(await dbContext.ImportAuditEvents
            .AsNoTracking()
            .AnyAsync(auditEvent => auditEvent.AccountId == accountId
                && auditEvent.ReviewId == reviewId
                && auditEvent.ActingUserId == actingUserId
                && auditEvent.EventCode == "ReviewCreated"));
    }

    private static async Task AddUserAsync(AppDbContext dbContext, string userId)
    {
        var email = $"{userId}@example.test";
        dbContext.Users.Add(new ApplicationUser
        {
            Id = userId,
            UserName = email,
            NormalizedUserName = email.ToUpperInvariant(),
            Email = email,
            NormalizedEmail = email.ToUpperInvariant(),
            EmailConfirmed = true,
            SecurityStamp = Guid.NewGuid().ToString("N"),
            ConcurrencyStamp = Guid.NewGuid().ToString("N"),
        });
        await dbContext.SaveChangesAsync();
    }

    private static async Task<Guid> InsertLegacyAccountAsync(
        AppDbContext dbContext,
        Guid familyId,
        string familyOwnerUserId,
        Guid accountId,
        Guid transactionId,
        bool disableFamilyOwnerConstraint = false)
    {
        if (disableFamilyOwnerConstraint)
        {
            await dbContext.Database.ExecuteSqlRawAsync(
                "ALTER TABLE Families NOCHECK CONSTRAINT FK_Families_AspNetUsers_OwnerUserId");
        }

        await dbContext.Database.ExecuteSqlInterpolatedAsync(
            $"INSERT INTO Families (Id, OwnerUserId) VALUES ({familyId}, {familyOwnerUserId})");
        await dbContext.Database.ExecuteSqlInterpolatedAsync(
            $"INSERT INTO Accounts (Id, FamilyId, Description, CurrencyCode, LastSuccessfulImportAtUtc, ActiveImportId, LastSuccessfulImportReviewId) VALUES ({accountId}, {familyId}, {"Legacy account"}, {"AUD"}, {null}, {null}, {null})");
        await dbContext.Database.ExecuteSqlInterpolatedAsync(
            $"INSERT INTO Transactions (Id, AccountId, TransactionDate, Description, Amount, Direction, CreatedAtUtc) VALUES ({transactionId}, {accountId}, {new DateOnly(2026, 1, 2)}, {"Legacy transaction"}, {12.34m}, {"Outgoing"}, {DateTimeOffset.UtcNow})");
        var reviewId = Guid.NewGuid();
        var now = DateTimeOffset.UtcNow;
        var review = new ImportReview(
            reviewId,
            accountId,
            familyOwnerUserId,
            now,
            now.AddMinutes(15));
        review.AddRows(
        [
            new ImportReviewRow(
                reviewId,
                2,
                new DateOnly(2026, 1, 2),
                "Legacy imported row",
                12.34m,
                TransactionDirection.Outgoing,
                false),
        ]);
        var mapping = new ImportMapping(
            0,
            1,
            "yyyy-MM-dd",
            ImportAmountMode.Signed,
            SignedAmountColumn: 2,
            IncomingSign: IncomingSign.Positive,
            NumberFormat: "dot-decimal-comma-grouping");
        dbContext.ImportReviews.Add(review);
        dbContext.ImportReviewMappingSnapshots.Add(ImportReviewMappingSnapshot.Create(
            reviewId,
            ImportMappingSettingsSerializer.CurrentSchemaVersion,
            ImportMappingSettingsSerializer.Serialize(mapping)));
        dbContext.ImportAuditEvents.Add(new ImportAuditEvent(
            reviewId,
            accountId,
            familyOwnerUserId,
            "ReviewCreated",
            now));
        await dbContext.SaveChangesAsync();
        await dbContext.Database.ExecuteSqlInterpolatedAsync(
            $"INSERT INTO AccountImportSettings (AccountId, SchemaVersion, SettingsJson, SourceImportReviewId, SavedAtUtc) VALUES ({accountId}, {ImportMappingSettingsSerializer.CurrentSchemaVersion}, {ImportMappingSettingsSerializer.Serialize(mapping)}, {reviewId}, {DateTimeOffset.UtcNow})");
        return reviewId;
    }

    private async Task WithLegacyDatabaseAsync(Func<string, Task> action)
    {
        var databaseName = $"SinglePersonOwnership_{Guid.NewGuid():N}";
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
