using System.Collections.Concurrent;
using System.Net;
using Clutch.API.Tests.Integration.Accounts;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using static Clutch.API.Tests.Integration.Mortgages.MortgageTestSupport;

namespace Clutch.API.Tests.Integration.Mortgages;

[Collection(SqlServerCollection.Name)]
public sealed class MortgageLoggingTests(SqlServerFixture fixture)
{
    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Logs_carry_mortgage_ids_and_never_the_balance_or_rates()
    {
        var provider = new CapturingLoggerProvider();
        using var factory = fixture.Factory.WithWebHostBuilder(builder =>
            builder.ConfigureServices(services => services.AddSingleton<ILoggerProvider>(provider)));
        using var client = await SignedInClientAsync(factory);

        // Distinctive numbers so any leak is unmistakable.
        const decimal balance = 7654321.09m;
        const decimal rate = 3.14m;
        var created = await CreateAsync(client, Body("Logged", openingBalance: balance, rates: new[] { new { newInterestRate = rate, effectiveDate = "2000-01-01" } }));
        using var invalid = await SendAsync(client, HttpMethod.Post, "/api/mortgages", Body("Logged", openingBalance: balance));
        using var update = await SendAsync(client, HttpMethod.Put, $"/api/mortgages/{created.Id}", Body("Logged", openingBalance: balance, version: 1, rates: new[] { new { newInterestRate = rate, effectiveDate = "2000-01-01" } }));
        using var stale = await SendAsync(client, HttpMethod.Put, $"/api/mortgages/{created.Id}", Body("Logged", openingBalance: balance, version: 1));
        using var delete = await SendAsync(client, HttpMethod.Delete, $"/api/mortgages/{created.Id}?version=2", null);

        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
        Assert.Equal(HttpStatusCode.OK, update.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);

        var mortgageLogs = provider.Entries
            .Where(entry => entry.Category.Contains("MortgageService"))
            .ToList();
        Assert.Contains(mortgageLogs, entry => entry.Text.Contains(created.Id.ToString()));
        Assert.True(mortgageLogs.Count >= 5);
        Assert.All(provider.Entries, entry =>
        {
            Assert.DoesNotContain("7654321", entry.Text);
            Assert.DoesNotContain("3.14", entry.Text);
        });
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Period_balance_reads_log_ids_only_and_never_a_balance_or_description()
    {
        var provider = new CapturingLoggerProvider();
        using var factory = fixture.Factory.WithWebHostBuilder(builder =>
            builder.ConfigureServices(services => services.AddSingleton<ILoggerProvider>(provider)));
        using var client = await SignedInClientAsync(factory);
        var accountId = await CreateAccountAsync(client, "Distinctive Offset Name");
        await SeedTransactionAsync(fixture, accountId, new DateOnly(2026, 1, 10), 7654321.09m);

        using var response = await client.GetAsync(
            $"/api/mortgages/period-balances?accountId={accountId}&disbursalDate=2026-01-01&frequency=Monthly&duration=3");
        using var missing = await client.GetAsync($"/api/mortgages/period-balances?accountId={Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
        var balanceLogs = provider.Entries.Where(entry => entry.Category.Contains("PeriodBalanceService")).ToList();
        Assert.Contains(balanceLogs, entry => entry.Text.Contains(accountId.ToString()));
        Assert.All(provider.Entries, entry =>
        {
            Assert.DoesNotContain("7654321", entry.Text);
            Assert.DoesNotContain("Distinctive Offset Name", entry.Text);
        });
    }

    private sealed record Entry(string Category, string Text);

    private sealed class CapturingLoggerProvider : ILoggerProvider
    {
        public ConcurrentQueue<Entry> Entries { get; } = new();

        public ILogger CreateLogger(string categoryName) => new Capture(categoryName, Entries);

        public void Dispose()
        {
        }

        private sealed class Capture(string category, ConcurrentQueue<Entry> sink) : ILogger
        {
            public IDisposable? BeginScope<TState>(TState state) where TState : notnull
            {
                sink.Enqueue(new Entry(category, state.ToString() ?? string.Empty));
                return null;
            }

            public bool IsEnabled(LogLevel logLevel) => true;

            public void Log<TState>(
                LogLevel logLevel,
                EventId eventId,
                TState state,
                Exception? exception,
                Func<TState, Exception?, string> formatter)
            {
                var values = state is IEnumerable<KeyValuePair<string, object?>> pairs
                    ? string.Join(' ', pairs.Select(pair => $"{pair.Key}={pair.Value}"))
                    : string.Empty;
                sink.Enqueue(new Entry(category, $"{formatter(state, exception)} {values}"));
            }
        }
    }
}
