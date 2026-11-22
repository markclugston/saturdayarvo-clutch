using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Clutch.API.Infrastructure.Persistence;
using Clutch.API.Tests.Integration.Accounts;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace Clutch.API.Tests.Integration.Mortgages;

internal static class MortgageTestSupport
{
    public sealed record RateChange(decimal NewInterestRate, string EffectiveDate);

    public sealed record MortgageDto(
        Guid Id,
        string Name,
        decimal OpeningBalance,
        int Duration,
        string DisbursalDate,
        string PaymentFrequency,
        List<RateChange> InterestRateChanges,
        int Version,
        Guid? AccountId = null);

    public sealed record ProblemDto(
        string? Type,
        string? Title,
        int? Status,
        Dictionary<string, string[]>? Errors);

    private sealed record CsrfTokenResponse(string RequestToken);

    public static HttpClient CreateClient(WebApplicationFactory<Program> factory) =>
        factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost"),
            AllowAutoRedirect = false,
        });

    public static async Task<HttpClient> SignedInClientAsync(WebApplicationFactory<Program> factory)
    {
        var client = CreateClient(factory);
        var credentials = new
        {
            email = $"{Guid.NewGuid():N}@example.test",
            password = "Test-only!Password-123",
        };
        using var register = await SendAsync(client, HttpMethod.Post, "/api/security/register", credentials);
        Assert.Equal(HttpStatusCode.Created, register.StatusCode);
        using var login = await SendAsync(client, HttpMethod.Post, "/api/security/login", credentials);
        Assert.Equal(HttpStatusCode.NoContent, login.StatusCode);
        return client;
    }

    public static async Task<HttpResponseMessage> SendAsync(
        HttpClient client,
        HttpMethod method,
        string path,
        object? content,
        bool withCsrf = true)
    {
        using var request = new HttpRequestMessage(method, path);
        if (content is not null)
        {
            request.Content = JsonContent.Create(content);
        }

        if (withCsrf)
        {
            using var tokenResponse = await client.GetAsync("/api/security/csrf-token");
            tokenResponse.EnsureSuccessStatusCode();
            var token = await tokenResponse.Content.ReadFromJsonAsync<CsrfTokenResponse>();
            request.Headers.Add("X-CSRF-TOKEN", token!.RequestToken);
        }

        return await client.SendAsync(request);
    }

    public static object Body(
        string name = "Home loan",
        object? openingBalance = null,
        object? duration = null,
        string? disbursalDate = "2000-01-01",
        string? paymentFrequency = "Monthly",
        object? rates = null,
        int? version = null,
        string? accountId = null) =>
        new Dictionary<string, object?>
        {
            ["name"] = name,
            ["openingBalance"] = openingBalance ?? 250000.5m,
            ["duration"] = duration ?? 360,
            ["disbursalDate"] = disbursalDate,
            ["paymentFrequency"] = paymentFrequency,
            ["interestRateChanges"] = rates ?? new[] { new { newInterestRate = 5.25m, effectiveDate = "2000-01-01" } },
            ["version"] = version,
            ["accountId"] = accountId,
        };

    private sealed record AccountDto(Guid Id);

    public static async Task<Guid> CreateAccountAsync(
        HttpClient client,
        string description = "Offset account",
        string currencyCode = "AUD")
    {
        using var response = await SendAsync(
            client,
            HttpMethod.Post,
            "/api/accounts",
            new { description, currencyCode });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<AccountDto>())!.Id;
    }

    // Seeds a transaction straight into the database; a null balance is a balance-less row.
    public static async Task SeedTransactionAsync(
        SqlServerFixture fixture,
        Guid accountId,
        DateOnly date,
        decimal? balance,
        string description = "Seeded")
    {
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.True(Clutch.API.Domain.Shared.Currency.TryGet("AUD", out var currency));
        Assert.True(Clutch.API.Domain.Transactions.Transaction.TryCreate(
            accountId,
            date,
            description,
            1m,
            Clutch.API.Domain.Transactions.TransactionDirection.Incoming,
            balance,
            currency!,
            DateTimeOffset.UtcNow,
            out var transaction));
        db.Transactions.Add(transaction!);
        await db.SaveChangesAsync();
    }

    public static async Task<MortgageDto> CreateAsync(HttpClient client, object body)
    {
        using var response = await SendAsync(client, HttpMethod.Post, "/api/mortgages", body);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.NotNull(response.Headers.Location);
        return (await response.Content.ReadFromJsonAsync<MortgageDto>())!;
    }

    public static async Task<List<MortgageDto>> ListAsync(HttpClient client)
    {
        using var response = await client.GetAsync("/api/mortgages");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<List<MortgageDto>>())!;
    }

    public static async Task<ProblemDto> ProblemAsync(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<ProblemDto>(
            new JsonSerializerOptions(JsonSerializerDefaults.Web)))!;

    public static async Task<List<(string EventCode, string Description)>> AuditsAsync(
        SqlServerFixture fixture,
        string descriptionContains)
    {
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var rows = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.ToListAsync(
            db.Audits.Where(audit => audit.EventCode.StartsWith("Mortgage")
                && audit.Description.Contains(descriptionContains)));
        return rows.Select(row => (row.EventCode, row.Description)).ToList();
    }
}
