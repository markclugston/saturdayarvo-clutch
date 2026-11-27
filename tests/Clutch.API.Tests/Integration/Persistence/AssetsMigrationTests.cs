using Clutch.API.Infrastructure.Persistence;
using Clutch.API.Tests.Integration.Accounts;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace Clutch.API.Tests.Integration.Persistence;

[Collection(SqlServerCollection.Name)]
public sealed class AssetsMigrationTests(SqlServerFixture fixture)
{
    private const string PrecedingMigration = "20261123070004_TransactionSequence";

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Migration_adds_the_asset_tables_and_widens_audit_descriptions_without_changing_rows()
    {
        var databaseName = $"AssetsMigration_{Guid.NewGuid():N}";
        var adminConnectionString = new SqlConnectionStringBuilder(fixture.ConnectionString)
        {
            InitialCatalog = "master",
        };
        var targetConnectionString = new SqlConnectionStringBuilder(fixture.ConnectionString)
        {
            InitialCatalog = databaseName,
        };

        await Execute(adminConnectionString.ConnectionString, $"CREATE DATABASE [{databaseName}]");
        try
        {
            await using var dbContext = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
                .UseSqlServer(targetConnectionString.ConnectionString)
                .Options);
            await dbContext.Database.MigrateAsync(PrecedingMigration);

            var ownerUserId = Guid.NewGuid().ToString("N");
            var existingId = Guid.NewGuid();
            var existingText = "  Existing audit text, kept exactly.  ";
            await InsertAuditAsync(dbContext, existingId, ownerUserId, existingText);

            await dbContext.Database.MigrateAsync();

            Assert.Equal(3, await TableCountAsync(dbContext));
            Assert.Equal("AssetId ASC, ValuationDate DESC", await ScalarAsync<string>(
                dbContext,
                $"""
                SELECT STRING_AGG(CONCAT(c.[name], CASE WHEN ic.is_descending_key = 1 THEN ' DESC' ELSE ' ASC' END), ', ')
                    WITHIN GROUP (ORDER BY ic.key_ordinal) AS [Value]
                FROM sys.indexes i
                JOIN sys.index_columns ic ON ic.[object_id] = i.[object_id] AND ic.index_id = i.index_id
                JOIN sys.columns c ON c.[object_id] = ic.[object_id] AND c.column_id = ic.column_id
                WHERE i.[name] = 'IX_AssetValuations_AssetId_ValuationDate' AND i.is_unique = 1 AND ic.is_included_column = 0
                """));
            Assert.Equal("Value", await ScalarAsync<string>(
                dbContext,
                $"""
                SELECT c.[name] AS [Value]
                FROM sys.indexes i
                JOIN sys.index_columns ic ON ic.[object_id] = i.[object_id] AND ic.index_id = i.index_id
                JOIN sys.columns c ON c.[object_id] = ic.[object_id] AND c.column_id = ic.column_id
                WHERE i.[name] = 'IX_AssetValuations_AssetId_ValuationDate' AND ic.is_included_column = 1
                """));
            Assert.Equal(2, await ScalarAsync<int>(
                dbContext,
                $"SELECT COUNT(*) AS [Value] FROM sys.indexes WHERE [name] IN ('IX_Assets_OwnerUserId_CreatedAtUtc', 'IX_AssetEdits_AssetId_State')"));

            // Unlimited length, still non-blank, existing row untouched.
            Assert.Equal(-1, await ScalarAsync<int>(
                dbContext,
                $"SELECT CAST(max_length AS int) AS [Value] FROM sys.columns WHERE [object_id] = OBJECT_ID(N'dbo.Audit') AND [name] = 'Description'"));
            Assert.Equal(existingText, await DescriptionAsync(dbContext, existingId));
            var longId = Guid.NewGuid();
            await InsertAuditAsync(dbContext, longId, ownerUserId, new string('x', 4000) + "end");
            Assert.EndsWith("end", await DescriptionAsync(dbContext, longId), StringComparison.Ordinal);
            await Assert.ThrowsAsync<SqlException>(() =>
                InsertAuditAsync(dbContext, Guid.NewGuid(), ownerUserId, "   "));
            await Assert.ThrowsAsync<SqlException>(() => dbContext.Database.ExecuteSqlInterpolatedAsync(
                $"UPDATE Audit SET Description = Description WHERE Id = {existingId}"));

            await dbContext.Database.ExecuteSqlInterpolatedAsync(
                $"INSERT INTO AspNetUsers (Id, EmailConfirmed, PhoneNumberConfirmed, TwoFactorEnabled, LockoutEnabled, AccessFailedCount) VALUES ({ownerUserId}, 0, 0, 0, 0, 0)");
            var unsupported = await Assert.ThrowsAsync<SqlException>(() => InsertAssetAsync(dbContext, ownerUserId, "XXX"));
            Assert.Contains("CK_Assets_SupportedCurrency", unsupported.Message, StringComparison.Ordinal);
            foreach (var currency in Clutch.API.Domain.Shared.Currency.All)
            {
                Assert.Equal(1, await InsertAssetAsync(dbContext, ownerUserId, currency.Code));
            }

            await dbContext.Database.MigrateAsync(PrecedingMigration);

            Assert.Equal(0, await TableCountAsync(dbContext));
            // Down never narrows the column: rows written after deploy must stay unchanged.
            Assert.Equal(-1, await ScalarAsync<int>(
                dbContext,
                $"SELECT CAST(max_length AS int) AS [Value] FROM sys.columns WHERE [object_id] = OBJECT_ID(N'dbo.Audit') AND [name] = 'Description'"));
            Assert.Equal(1, await ScalarAsync<int>(
                dbContext,
                $"SELECT COUNT(*) AS [Value] FROM sys.check_constraints WHERE [name] = 'CK_Audit_NonBlankDescription'"));
            Assert.Equal(existingText, await DescriptionAsync(dbContext, existingId));

            await dbContext.Database.MigrateAsync();
            Assert.Equal(3, await TableCountAsync(dbContext));
        }
        finally
        {
            await Execute(
                adminConnectionString.ConnectionString,
                $"ALTER DATABASE [{databaseName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{databaseName}]");
        }
    }

    private static Task<int> TableCountAsync(AppDbContext dbContext) =>
        ScalarAsync<int>(
            dbContext,
            $"SELECT COUNT(*) AS [Value] FROM sys.tables WHERE [name] IN ('Assets', 'AssetValuations', 'AssetEdits')");

    private static Task<T> ScalarAsync<T>(AppDbContext dbContext, FormattableString sql) =>
        dbContext.Database.SqlQuery<T>(sql).SingleAsync();

    private static Task<string> DescriptionAsync(AppDbContext dbContext, Guid id) =>
        ScalarAsync<string>(dbContext, $"SELECT [Description] AS [Value] FROM Audit WHERE Id = {id}");

    private static Task<int> InsertAuditAsync(AppDbContext dbContext, Guid id, string userId, string description) =>
        dbContext.Database.ExecuteSqlInterpolatedAsync(
            $"INSERT INTO Audit (Id, ActingUserId, OccurredAtUtc, EventCode, Description) VALUES ({id}, {userId}, {DateTimeOffset.UtcNow}, {"AssetCreate"}, {description})");

    private static Task<int> InsertAssetAsync(AppDbContext dbContext, string ownerUserId, string currencyCode) =>
        dbContext.Database.ExecuteSqlInterpolatedAsync(
            $"INSERT INTO Assets (Id, OwnerUserId, Name, CurrencyCode, CreatedAtUtc) VALUES ({Guid.NewGuid()}, {ownerUserId}, {"Asset"}, {currencyCode}, {DateTimeOffset.UtcNow})");

    private static async Task Execute(string connectionString, string commandText)
    {
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = commandText;
        await command.ExecuteNonQueryAsync();
    }
}
