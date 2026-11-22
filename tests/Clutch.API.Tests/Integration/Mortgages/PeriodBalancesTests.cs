using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;
using Clutch.API.Infrastructure.Persistence;
using Clutch.API.Tests.Integration.Accounts;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using static Clutch.API.Tests.Integration.Mortgages.MortgageTestSupport;

namespace Clutch.API.Tests.Integration.Mortgages;

[Collection(SqlServerCollection.Name)]
public sealed class PeriodBalancesTests(SqlServerFixture fixture)
{
    private sealed record BalancesDto(string CurrencyCode, int PeriodCount, List<string?> Balances);

    private static async Task<HttpResponseMessage> GetAsync(HttpClient client, string query) =>
        await client.GetAsync($"/api/mortgages/period-balances?{query}");

    private static string Schedule(string drawdown = "2026-01-01", string frequency = "Monthly", int duration = 6) =>
        $"drawdownDate={drawdown}&frequency={frequency}&duration={duration}";

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Balances_are_end_of_period_values_in_minor_units()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var accountId = await CreateAccountAsync(client);
        await SeedTransactionAsync(fixture, accountId, new DateOnly(2026, 1, 10), 1000m);
        await SeedTransactionAsync(fixture, accountId, new DateOnly(2026, 2, 5), 900.5m);
        await SeedTransactionAsync(fixture, accountId, new DateOnly(2026, 2, 6), 800m);

        using var response = await GetAsync(client, $"accountId={accountId}&{Schedule()}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = (await response.Content.ReadFromJsonAsync<BalancesDto>())!;
        Assert.Equal("AUD", body.CurrencyCode);
        Assert.Equal(7, body.PeriodCount);
        // Period 1 = January; period 2 = February; later periods omitted.
        Assert.Equal<string?>(["1000.00", "800.00"], body.Balances);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task A_debt_stored_as_negative_shows_positive_and_goes_negative_only_after_crossing_zero()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var accountId = await CreateAccountAsync(client);
        await SeedTransactionAsync(fixture, accountId, new DateOnly(2026, 1, 10), -1000m);
        await SeedTransactionAsync(fixture, accountId, new DateOnly(2026, 2, 5), -200m);
        await SeedTransactionAsync(fixture, accountId, new DateOnly(2026, 3, 5), 50m);

        using var response = await GetAsync(client, $"accountId={accountId}&{Schedule()}");

        var body = (await response.Content.ReadFromJsonAsync<BalancesDto>())!;
        Assert.Equal<string?>(["1000.00", "200.00", "-50.00"], body.Balances);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task A_foreign_or_unknown_account_is_404()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        using var other = await SignedInClientAsync(fixture.Factory);
        var foreign = await CreateAccountAsync(other);

        foreach (var id in new[] { foreign, Guid.NewGuid() })
        {
            using var response = await GetAsync(client, $"accountId={id}&{Schedule()}");

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
            Assert.Equal("Account not found.", (await ProblemAsync(response)).Title);
        }
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task An_account_without_balance_bearing_transactions_returns_blank_cells()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var accountId = await CreateAccountAsync(client);
        await SeedTransactionAsync(fixture, accountId, new DateOnly(2026, 1, 10), null);

        using var response = await GetAsync(client, $"accountId={accountId}&{Schedule()}");

        var body = (await response.Content.ReadFromJsonAsync<BalancesDto>())!;
        Assert.Empty(body.Balances);
        Assert.Equal(7, body.PeriodCount);
    }

    [Theory]
    [InlineData("drawdownDate=2026-01-01", "frequency", "duration")]
    [InlineData("frequency=Monthly&duration=5", "drawdownDate")]
    [InlineData("drawdownDate=2026-13-01&frequency=Daily&duration=0", "drawdownDate", "frequency", "duration")]
    [InlineData("drawdownDate=2026-01-01&frequency=Monthly&duration=1.5", "duration")]
    [Trait("Category", "SqlServer")]
    public async Task Partial_or_invalid_schedule_values_are_400_with_field_keys(string query, params string[] keys)
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var accountId = await CreateAccountAsync(client);

        using var response = await GetAsync(client, $"accountId={accountId}&{query}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(keys.Order(), (await ProblemAsync(response)).Errors!.Keys.Order());
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task A_missing_or_malformed_account_id_is_a_400_account_id_error()
    {
        using var client = await SignedInClientAsync(fixture.Factory);

        using var response = await GetAsync(client, "accountId=nope");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("accountId", (await ProblemAsync(response)).Errors!.Keys);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task The_response_is_bounded_by_the_history_not_by_a_huge_duration()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var accountId = await CreateAccountAsync(client);
        await SeedTransactionAsync(fixture, accountId, new DateOnly(2026, 1, 10), 10m);

        using var response = await GetAsync(client, $"accountId={accountId}&{Schedule(frequency: "Weekly", duration: 100000)}");

        var body = (await response.Content.ReadFromJsonAsync<BalancesDto>())!;
        Assert.Equal(100001, body.PeriodCount);
        Assert.True(body.Balances.Count <= 3);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Signed_out_requests_are_unauthorized()
    {
        using var anonymous = CreateClient(fixture.Factory);

        using var response = await GetAsync(anonymous, $"accountId={Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Fallback_starts_at_the_first_balance_bearing_transaction_anchors_the_day_and_ends_at_the_latest()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var accountId = await CreateAccountAsync(client);
        await SeedTransactionAsync(fixture, accountId, new DateOnly(2025, 12, 1), null);
        await SeedTransactionAsync(fixture, accountId, new DateOnly(2026, 1, 31), 500m);
        await SeedTransactionAsync(fixture, accountId, new DateOnly(2026, 3, 15), 400m);
        await SeedTransactionAsync(fixture, accountId, new DateOnly(2026, 6, 1), null);

        using var response = await GetAsync(client, $"accountId={accountId}");

        var body = (await response.Content.ReadFromJsonAsync<BalancesDto>())!;
        // Periods: [31 Jan, 27 Feb], [28 Feb, 30 Mar], and none after 15 Mar (the latest balance-bearing date).
        Assert.Equal(2, body.PeriodCount);
        Assert.Equal<string?>(["500.00", "400.00"], body.Balances);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Fallback_has_zero_periods_when_there_are_no_balance_bearing_transactions()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var accountId = await CreateAccountAsync(client);

        using var response = await GetAsync(client, $"accountId={accountId}");

        var body = (await response.Content.ReadFromJsonAsync<BalancesDto>())!;
        Assert.Equal(0, body.PeriodCount);
        Assert.Empty(body.Balances);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Same_day_transactions_use_the_last_by_id_like_the_transactions_list()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var accountId = await CreateAccountAsync(client);
        var day = new DateOnly(2026, 1, 10);
        await SeedTransactionAsync(fixture, accountId, day, 1m);
        await SeedTransactionAsync(fixture, accountId, day, 2m);
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var expected = await db.Transactions
            .Where(transaction => transaction.AccountId == accountId)
            .OrderByDescending(transaction => transaction.TransactionDate)
            .ThenByDescending(transaction => transaction.Id)
            .Select(transaction => transaction.Balance)
            .FirstAsync();

        using var response = await GetAsync(client, $"accountId={accountId}&{Schedule()}");

        var body = (await response.Content.ReadFromJsonAsync<BalancesDto>())!;
        Assert.Equal($"{expected:F2}", body.Balances[0]);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task A_360_period_mortgage_with_10000_transactions_responds_in_under_2_seconds()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var accountId = await CreateAccountAsync(client);
        await using (var scope = fixture.Factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            Assert.True(Clutch.API.Domain.Shared.Currency.TryGet("AUD", out var currency));
            var start = new DateOnly(2000, 1, 1);
            for (var index = 0; index < 10_000; index++)
            {
                Assert.True(Clutch.API.Domain.Transactions.Transaction.TryCreate(
                    accountId,
                    start.AddDays(index),
                    "Bulk",
                    1m,
                    Clutch.API.Domain.Transactions.TransactionDirection.Incoming,
                    100000m - index,
                    currency!,
                    DateTimeOffset.UtcNow,
                    out var transaction));
                db.Transactions.Add(transaction!);
            }

            await db.SaveChangesAsync();
        }

        var stopwatch = Stopwatch.StartNew();
        using var response = await GetAsync(client, $"accountId={accountId}&{Schedule("2000-01-01", duration: 360)}");
        stopwatch.Stop();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(stopwatch.Elapsed < TimeSpan.FromSeconds(2), $"Took {stopwatch.Elapsed.TotalMilliseconds:F0} ms.");
        var body = (await response.Content.ReadFromJsonAsync<BalancesDto>())!;
        Assert.Equal(361, body.PeriodCount);
    }
}
