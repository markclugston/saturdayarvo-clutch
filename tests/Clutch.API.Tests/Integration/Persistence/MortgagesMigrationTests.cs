using Clutch.API.Infrastructure.Persistence;
using Clutch.API.Tests.Integration.Accounts;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace Clutch.API.Tests.Integration.Persistence;

[Collection(SqlServerCollection.Name)]
public sealed class MortgagesMigrationTests(SqlServerFixture fixture)
{
    private const string PrecedingMigration = "20261117081713_ActiveImportCoordination";

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Migration_applies_with_case_insensitive_name_and_down_drops_only_mortgage_tables()
    {
        var databaseName = $"MortgagesMigration_{Guid.NewGuid():N}";
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
            var auditBefore = await dbContext.Audits.CountAsync();

            await dbContext.Database.MigrateAsync();

            Assert.Equal(2, await dbContext.Database.SqlQuery<int>(
                $"SELECT COUNT(*) AS [Value] FROM sys.tables WHERE [name] IN ('Mortgages', 'MortgageInterestRateChanges')")
                .SingleAsync());
            Assert.Equal("Latin1_General_100_CI_AS", await dbContext.Database.SqlQuery<string>(
                $"SELECT collation_name AS [Value] FROM sys.columns WHERE [object_id] = OBJECT_ID(N'dbo.Mortgages') AND [name] = 'Name'")
                .SingleAsync());
            Assert.Equal(auditBefore, await dbContext.Audits.CountAsync());

            await dbContext.Database.MigrateAsync(PrecedingMigration);

            Assert.Equal(0, await dbContext.Database.SqlQuery<int>(
                $"SELECT COUNT(*) AS [Value] FROM sys.tables WHERE [name] IN ('Mortgages', 'MortgageInterestRateChanges')")
                .SingleAsync());
            Assert.Equal(auditBefore, await dbContext.Audits.CountAsync());
        }
        finally
        {
            await Execute(
                adminConnectionString.ConnectionString,
                $"ALTER DATABASE [{databaseName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{databaseName}]");
        }
    }

    private static async Task Execute(string connectionString, string commandText)
    {
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = commandText;
        await command.ExecuteNonQueryAsync();
    }
}
