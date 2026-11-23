using Clutch.API.Infrastructure.Identity;
using Clutch.API.Infrastructure.Persistence;
using Clutch.API.Tests.Integration.Accounts;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Clutch.API.Tests.Integration.Persistence;

[Collection(SqlServerCollection.Name)]
public sealed class TransactionSequenceMigrationTests(SqlServerFixture fixture)
{
    private const string PrecedingMigration = "20261122120000_RenameDrawdownDateToDisbursalDate";
    private const string SequenceMigration = "TransactionSequence";
    private const string OldIndex = "IX_Transactions_AccountId_TransactionDate";
    private const string NewIndex = "IX_Transactions_AccountId_TransactionDate_Sequence";

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Up_backfills_unique_sequences_and_enforces_the_check_and_unique_index()
    {
        await WithDatabaseAsync(async connectionString =>
        {
            await using var dbContext = CreateDbContext(connectionString);
            await dbContext.Database.MigrateAsync(PrecedingMigration);
            var accountId = await SeedAccountAsync(dbContext);
            var date = new DateOnly(2025, 3, 10);
            var otherDate = new DateOnly(2025, 3, 11);
            var first = await InsertOldTransactionAsync(dbContext, accountId, date, DateTimeOffset.UtcNow.AddMinutes(-2));
            var second = await InsertOldTransactionAsync(dbContext, accountId, date, DateTimeOffset.UtcNow.AddMinutes(-1));
            var third = await InsertOldTransactionAsync(dbContext, accountId, date, DateTimeOffset.UtcNow);
            var alone = await InsertOldTransactionAsync(dbContext, accountId, otherDate, DateTimeOffset.UtcNow);

            await dbContext.GetService<IMigrator>().MigrateAsync(SequenceMigration);

            var sequences = await ReadSequencesAsync(dbContext, accountId);
            Assert.Equal(3, sequences[date].Count);
            Assert.Equal(sequences[date].Distinct().Count(), sequences[date].Count);
            Assert.All(sequences.Values.SelectMany(values => values), value => Assert.True(value >= 1));
            Assert.Equal(1, Assert.Single(sequences[otherDate]));
            Assert.Equal(
                [first, second, third],
                await IdsInSequenceOrderAsync(dbContext, accountId, date));
            Assert.NotEqual(Guid.Empty, alone);

            Assert.Equal(1, await IndexCountAsync(dbContext, NewIndex));
            Assert.Equal(0, await IndexCountAsync(dbContext, OldIndex));

            await Assert.ThrowsAsync<SqlException>(() =>
                dbContext.Database.ExecuteSqlInterpolatedAsync(
                    $"UPDATE Transactions SET [Sequence] = 0 WHERE Id = {first}"));
            await Assert.ThrowsAsync<SqlException>(() =>
                dbContext.Database.ExecuteSqlInterpolatedAsync(
                    $"UPDATE Transactions SET [Sequence] = (SELECT [Sequence] FROM Transactions WHERE Id = {second}) WHERE Id = {first}"));
        });
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Down_restores_the_old_index_and_removes_the_sequence_objects()
    {
        await WithDatabaseAsync(async connectionString =>
        {
            await using var dbContext = CreateDbContext(connectionString);
            await dbContext.Database.MigrateAsync(PrecedingMigration);
            var accountId = await SeedAccountAsync(dbContext);
            await InsertOldTransactionAsync(dbContext, accountId, new DateOnly(2025, 3, 10), DateTimeOffset.UtcNow);
            var migrator = dbContext.GetService<IMigrator>();
            await migrator.MigrateAsync(SequenceMigration);

            await migrator.MigrateAsync(PrecedingMigration);

            Assert.Equal(1, await IndexCountAsync(dbContext, OldIndex));
            Assert.Equal(0, await IndexCountAsync(dbContext, NewIndex));
            Assert.Equal(0, await dbContext.Database.SqlQuery<int>(
                $"SELECT COUNT(*) AS [Value] FROM sys.columns WHERE [object_id] = OBJECT_ID(N'dbo.Transactions') AND [name] = 'Sequence'")
                .SingleAsync());
            Assert.Equal(0, await dbContext.Database.SqlQuery<int>(
                $"SELECT COUNT(*) AS [Value] FROM sys.check_constraints WHERE [name] = 'CK_Transactions_PositiveSequence'")
                .SingleAsync());
            Assert.Equal(1, await dbContext.Database.SqlQuery<int>(
                $"SELECT COUNT(*) AS [Value] FROM Transactions").SingleAsync());
        });
    }

    private static async Task<Guid> SeedAccountAsync(AppDbContext dbContext)
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
        Assert.True(Clutch.API.Domain.Accounts.Account.TryCreate(
            ownerUserId,
            "Sequence migration",
            "AUD",
            out var account));
        dbContext.Accounts.Add(account!);
        await dbContext.SaveChangesAsync();
        return account!.Id;
    }

    // Inserted with SQL because the current model has a column the preceding schema lacks.
    private static async Task<Guid> InsertOldTransactionAsync(
        AppDbContext dbContext,
        Guid accountId,
        DateOnly date,
        DateTimeOffset createdAtUtc)
    {
        var id = Guid.NewGuid();
        await dbContext.Database.ExecuteSqlInterpolatedAsync(
            $"INSERT INTO Transactions (Id, AccountId, TransactionDate, Description, Amount, Direction, Balance, CreatedAtUtc) VALUES ({id}, {accountId}, {date}, {"Seeded"}, {10m}, {"Outgoing"}, {null as decimal?}, {createdAtUtc})");
        return id;
    }

    private static async Task<Dictionary<DateOnly, List<int>>> ReadSequencesAsync(
        AppDbContext dbContext,
        Guid accountId)
    {
        var rows = await dbContext.Transactions
            .AsNoTracking()
            .Where(transaction => transaction.AccountId == accountId)
            .Select(transaction => new { transaction.TransactionDate, transaction.Sequence })
            .ToListAsync();
        return rows
            .GroupBy(row => row.TransactionDate)
            .ToDictionary(group => group.Key, group => group.Select(row => row.Sequence).ToList());
    }

    private static Task<List<Guid>> IdsInSequenceOrderAsync(
        AppDbContext dbContext,
        Guid accountId,
        DateOnly date) =>
        dbContext.Transactions
            .AsNoTracking()
            .Where(transaction => transaction.AccountId == accountId && transaction.TransactionDate == date)
            .OrderBy(transaction => transaction.Sequence)
            .Select(transaction => transaction.Id)
            .ToListAsync();

    private static Task<int> IndexCountAsync(AppDbContext dbContext, string indexName) =>
        dbContext.Database.SqlQuery<int>(
            $"SELECT COUNT(*) AS [Value] FROM sys.indexes WHERE [object_id] = OBJECT_ID(N'dbo.Transactions') AND [name] = {indexName}")
            .SingleAsync();

    private static AppDbContext CreateDbContext(string connectionString) =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlServer(connectionString)
            .Options);

    private async Task WithDatabaseAsync(Func<string, Task> action)
    {
        var databaseName = $"TransactionSequence_{Guid.NewGuid():N}";
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
