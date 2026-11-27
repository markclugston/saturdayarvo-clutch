using System.Diagnostics;
using System.Net;
using Clutch.API.Infrastructure.Persistence;
using Clutch.API.Tests.Integration.Accounts;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using static Clutch.API.Tests.Integration.Assets.AssetTestSupport;

namespace Clutch.API.Tests.Integration.Assets;

[Collection(SqlServerCollection.Name)]
public sealed class AssetListTests(SqlServerFixture fixture)
{
    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Anonymous_request_is_unauthorized()
    {
        using var client = CreateClient(fixture.Factory);
        using var response = await client.GetAsync("/api/assets");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Currencies_report_the_minor_units_the_asset_page_enters_values_with()
    {
        using var client = await SignedInClientAsync(fixture.Factory);

        using var response = await client.GetAsync("/api/currencies");

        var minorUnits = (await JsonAsync(response)).EnumerateArray().ToDictionary(
            currency => currency.GetProperty("code").GetString()!,
            currency => currency.GetProperty("minorUnits").GetInt32());
        Assert.Equal(2, minorUnits["AUD"]);
        Assert.Equal(0, minorUnits["JPY"]);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task An_empty_register_has_no_assets_and_no_totals()
    {
        using var client = await SignedInClientAsync(fixture.Factory);

        var list = await ListAsync(client);

        Assert.Empty(list.Assets);
        Assert.Empty(list.Totals);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Assets_are_listed_in_created_order_with_the_latest_valuation_only()
    {
        using var owner = await SignedInClientAsync(fixture.Factory);
        using var other = await SignedInClientAsync(fixture.Factory);
        await CreateAsync(owner, Body("A", "First", valuations:
        [
            Valuation(12000m, "2026-01-01"),
            Valuation(10000m, "2025-01-01"),
            Valuation(999m, "2024-01-01"),
        ]));
        await CreateAsync(owner, Body("B", valuations: [Valuation(3500m)]));
        await CreateAsync(other, Body("Not yours", valuations: [Valuation(1m)]));
        await CreateAsync(owner, Body("C", valuations: [Valuation(0m)]));

        var list = await ListAsync(owner);

        Assert.Equal(["A", "B", "C"], list.Assets.Select(asset => asset.Name));
        Assert.Equal(new LatestDto(12000m, "2026-01-01"), list.Assets[0].LatestValuation);
        Assert.Equal("First", list.Assets[0].Description);
        Assert.Null(list.Assets[1].Description);
        Assert.Equal([new TotalDto("AUD", "15500.00")], list.Totals);
        Assert.Equal(["Not yours"], (await ListAsync(other)).Assets.Select(asset => asset.Name));
        Assert.Equal([new TotalDto("AUD", "1.00")], (await ListAsync(other)).Totals);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Totals_are_exact_per_currency_ordered_by_code_and_never_mixed()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        // Eleven of the largest values: far beyond what a JavaScript number holds exactly.
        for (var index = 0; index < 11; index++)
        {
            await CreateAsync(client, Body($"US {index}", currencyCode: "USD", valuations: [Valuation(999_999_999_999.99m)]));
        }

        await CreateAsync(client, Body("Yen", currencyCode: "JPY", valuations: [Valuation(3000m)]));
        await CreateAsync(client, Body("Yen 2", currencyCode: "JPY", valuations: [Valuation(2000m)]));
        await CreateAsync(client, Body("Aussie", valuations: [Valuation(0.01m)]));

        var list = await ListAsync(client);

        Assert.Equal(
            [
                new TotalDto("AUD", "0.01"),
                new TotalDto("JPY", "5000"),
                new TotalDto("USD", "10999999999999.89"),
            ],
            list.Totals);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task A_hundred_assets_come_from_one_query_within_two_seconds()
    {
        var provider = new CapturingLoggerProvider();
        using var factory = fixture.Factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services => services.AddSingleton<ILoggerProvider>(provider));
            builder.ConfigureLogging(logging => logging.AddFilter<CapturingLoggerProvider>(
                "Microsoft.EntityFrameworkCore.Database.Command",
                LogLevel.Information));
        });
        using var client = await SignedInClientAsync(factory);
        for (var index = 0; index < 100; index++)
        {
            await CreateAsync(client, Body($"Asset {index:D3}", valuations:
            [
                Valuation(1m, "2024-01-01"),
                Valuation(2m, "2025-01-01"),
                Valuation(index, "2026-01-01"),
            ]));
        }

        provider.Entries.Clear();
        var timer = Stopwatch.StartNew();
        var list = await ListAsync(client);
        timer.Stop();

        Assert.Equal(100, list.Assets.Count);
        Assert.Equal([new TotalDto("AUD", "4950.00")], list.Totals);
        Assert.True(timer.Elapsed < TimeSpan.FromSeconds(2), $"List took {timer.Elapsed}.");
        var assetCommands = provider.Entries
            .Where(entry => entry.Category == "Microsoft.EntityFrameworkCore.Database.Command"
                && entry.Text.Contains("Executed DbCommand", StringComparison.Ordinal)
                && entry.Text.Contains("[Assets]", StringComparison.Ordinal))
            .ToList();
        Assert.Single(assetCommands);
    }
}
