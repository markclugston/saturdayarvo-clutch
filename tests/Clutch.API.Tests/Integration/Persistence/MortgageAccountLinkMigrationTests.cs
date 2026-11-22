using Clutch.API.Infrastructure.Persistence;
using Clutch.API.Tests.Integration.Accounts;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace Clutch.API.Tests.Integration.Persistence;

[Collection(SqlServerCollection.Name)]
public sealed class MortgageAccountLinkMigrationTests(SqlServerFixture fixture)
{
    private const string PrecedingMigration = "20261121222202_AddLoanPayoffTimelinePreferences";

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Migration_adds_a_nullable_account_link_and_down_drops_only_that_column()
    {
        var databaseName = $"MortgageAccountLink_{Guid.NewGuid():N}";
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
            var accountColumnsBefore = await ColumnNamesAsync(dbContext, "Accounts");
            var transactionColumnsBefore = await ColumnNamesAsync(dbContext, "Transactions");

            await dbContext.Database.MigrateAsync();

            Assert.Equal(1, await dbContext.Database.SqlQuery<int>(
                $"SELECT COUNT(*) AS [Value] FROM sys.columns WHERE [object_id] = OBJECT_ID(N'dbo.Mortgages') AND [name] = 'AccountId' AND is_nullable = 1")
                .SingleAsync());
            Assert.Equal(1, await dbContext.Database.SqlQuery<int>(
                $"SELECT COUNT(*) AS [Value] FROM sys.indexes WHERE [object_id] = OBJECT_ID(N'dbo.Mortgages') AND [name] = 'IX_Mortgages_AccountId'")
                .SingleAsync());
            Assert.Equal(1, await dbContext.Database.SqlQuery<int>(
                $"SELECT COUNT(*) AS [Value] FROM sys.foreign_keys WHERE [name] = 'FK_Mortgages_Accounts_AccountId' AND delete_referential_action_desc = 'SET_NULL'")
                .SingleAsync());
            Assert.Equal(accountColumnsBefore, await ColumnNamesAsync(dbContext, "Accounts"));
            Assert.Equal(transactionColumnsBefore, await ColumnNamesAsync(dbContext, "Transactions"));

            await dbContext.Database.MigrateAsync(PrecedingMigration);

            Assert.Equal(0, await dbContext.Database.SqlQuery<int>(
                $"SELECT COUNT(*) AS [Value] FROM sys.columns WHERE [object_id] = OBJECT_ID(N'dbo.Mortgages') AND [name] = 'AccountId'")
                .SingleAsync());
            Assert.Equal(0, await dbContext.Database.SqlQuery<int>(
                $"SELECT COUNT(*) AS [Value] FROM sys.foreign_keys WHERE [name] = 'FK_Mortgages_Accounts_AccountId'")
                .SingleAsync());
            Assert.Equal(accountColumnsBefore, await ColumnNamesAsync(dbContext, "Accounts"));
            Assert.Equal(transactionColumnsBefore, await ColumnNamesAsync(dbContext, "Transactions"));
        }
        finally
        {
            await Execute(
                adminConnectionString.ConnectionString,
                $"ALTER DATABASE [{databaseName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{databaseName}]");
        }
    }

    private static async Task<List<string>> ColumnNamesAsync(AppDbContext dbContext, string table) =>
        await dbContext.Database.SqlQuery<string>(
            $"SELECT [name] AS [Value] FROM sys.columns WHERE [object_id] = OBJECT_ID({"dbo." + table}) ORDER BY [name]")
            .ToListAsync();

    private static async Task Execute(string connectionString, string commandText)
    {
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = commandText;
        await command.ExecuteNonQueryAsync();
    }
}
