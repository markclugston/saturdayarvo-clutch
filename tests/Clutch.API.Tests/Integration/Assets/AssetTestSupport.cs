using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Clutch.API.Domain.Assets;
using Clutch.API.Infrastructure.Persistence;
using Clutch.API.Tests.Integration.Accounts;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Shared = Clutch.API.Tests.Integration.Mortgages.MortgageTestSupport;

namespace Clutch.API.Tests.Integration.Assets;

internal static class AssetTestSupport
{
    public sealed record ValuationDto(Guid Id, decimal Value, string ValuationDate);

    public sealed record LatestDto(decimal Value, string ValuationDate);

    public sealed record ListItemDto(
        Guid Id,
        string Name,
        string? Description,
        string CurrencyCode,
        LatestDto LatestValuation);

    public sealed record TotalDto(string CurrencyCode, string TotalValue);

    public sealed record ListDto(List<ListItemDto> Assets, List<TotalDto> Totals);

    public sealed record DetailDto(
        Guid Id,
        string Name,
        string? Description,
        string CurrencyCode,
        List<ValuationDto> Valuations);

    public sealed record LeaseDto(
        Guid EditId,
        DateTimeOffset ExpiresAtUtc,
        DateTimeOffset ServerTimeUtc,
        DetailDto Asset);

    public sealed record ActiveEditDto(Guid Id, DateTimeOffset ExpiresAtUtc);

    public sealed record EndedByDto(string UserId, string UserName);

    public sealed record WatchedEditDto(
        Guid Id,
        string State,
        DateTimeOffset? ExpiresAtUtc,
        DateTimeOffset? EndedAtUtc,
        EndedByDto? EndedBy);

    public sealed record StatusDto(
        Guid AssetId,
        string Availability,
        ActiveEditDto? ActiveEdit,
        WatchedEditDto? WatchedEdit);

    public sealed record BlockedDto(
        int Status,
        Dictionary<string, string[]> Errors,
        StatusDto EditStatus);

    // Sign-in, CSRF and ProblemDetails handling are shared with the mortgage tests.
    public static HttpClient CreateClient(WebApplicationFactory<Program> factory) =>
        Shared.CreateClient(factory);

    public static Task<HttpClient> SignedInClientAsync(WebApplicationFactory<Program> factory) =>
        Shared.SignedInClientAsync(factory);

    public static Task<HttpResponseMessage> SendAsync(
        HttpClient client,
        HttpMethod method,
        string path,
        object? content,
        bool withCsrf = true) =>
        Shared.SendAsync(client, method, path, content, withCsrf);

    public static Task<Shared.ProblemDto> ProblemAsync(HttpResponseMessage response) =>
        Shared.ProblemAsync(response);

    public static object Valuation(decimal value, string date = "2026-01-01", Guid? id = null) =>
        id is null
            ? new { value, valuationDate = date }
            : new { id, value, valuationDate = date };

    public static object Valuation(ValuationDto stored) =>
        Valuation(stored.Value, stored.ValuationDate, stored.Id);

    public static object Body(
        string? name = "House",
        string? description = null,
        string? currencyCode = "AUD",
        object[]? valuations = null,
        Guid? editId = null) =>
        new Dictionary<string, object?>
        {
            ["name"] = name,
            ["description"] = description,
            ["currencyCode"] = currencyCode,
            ["valuations"] = valuations ?? [Valuation(100m)],
            ["editId"] = editId,
        };

    public static async Task<DetailDto> CreateAsync(HttpClient client, object body)
    {
        using var response = await SendAsync(client, HttpMethod.Post, "/api/assets", body);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.NotNull(response.Headers.Location);
        return (await response.Content.ReadFromJsonAsync<DetailDto>())!;
    }

    public static async Task<ListDto> ListAsync(HttpClient client)
    {
        using var response = await client.GetAsync("/api/assets");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<ListDto>())!;
    }

    public static Task<HttpResponseMessage> AcquireAsync(HttpClient client, Guid assetId) =>
        SendAsync(client, HttpMethod.Post, $"/api/assets/{assetId}/edits", null);

    public static async Task<LeaseDto> LeaseAsync(HttpClient client, Guid assetId)
    {
        using var response = await AcquireAsync(client, assetId);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<LeaseDto>())!;
    }

    public static Task<HttpResponseMessage> SaveAsync(HttpClient client, Guid assetId, object body) =>
        SendAsync(client, HttpMethod.Put, $"/api/assets/{assetId}", body);

    public static Task<HttpResponseMessage> ReleaseAsync(HttpClient client, Guid assetId, Guid editId) =>
        SendAsync(client, HttpMethod.Delete, $"/api/assets/{assetId}/edits/{editId}", null);

    public static Task<HttpResponseMessage> EndAsync(HttpClient client, Guid assetId, Guid editId) =>
        SendAsync(client, HttpMethod.Delete, $"/api/assets/{assetId}/active-edit?editId={editId}", null);

    public static Task<HttpResponseMessage> DeleteAsync(HttpClient client, Guid assetId) =>
        SendAsync(client, HttpMethod.Delete, $"/api/assets/{assetId}", null);

    public static async Task<StatusDto> StatusAsync(HttpClient client, Guid assetId, Guid? editId = null)
    {
        var query = editId is null ? string.Empty : $"?editId={editId}";
        using var response = await client.GetAsync($"/api/assets/{assetId}/edit-status{query}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<StatusDto>())!;
    }

    // A second signed-in session of the same user.
    public static async Task<(HttpClient First, HttpClient Second, string UserName)> TwoSessionsAsync(
        WebApplicationFactory<Program> factory)
    {
        var credentials = new
        {
            email = $"{Guid.NewGuid():N}@example.test",
            password = "Test-only!Password-123",
        };
        var first = CreateClient(factory);
        using (var register = await SendAsync(first, HttpMethod.Post, "/api/security/register", credentials))
        {
            Assert.Equal(HttpStatusCode.Created, register.StatusCode);
        }

        var second = CreateClient(factory);
        foreach (var client in new[] { first, second })
        {
            using var login = await SendAsync(client, HttpMethod.Post, "/api/security/login", credentials);
            Assert.Equal(HttpStatusCode.NoContent, login.StatusCode);
        }

        return (first, second, credentials.email);
    }

    public static WebApplicationFactory<Program> WithClock(
        SqlServerFixture fixture,
        TimeProvider clock) =>
        fixture.Factory.WithWebHostBuilder(builder => builder.ConfigureServices(services =>
        {
            services.RemoveAll<TimeProvider>();
            services.AddSingleton(clock);
        }));

    public static async Task<T> QueryAsync<T>(SqlServerFixture fixture, Func<AppDbContext, Task<T>> query)
    {
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        return await query(scope.ServiceProvider.GetRequiredService<AppDbContext>());
    }

    public static Task<List<AssetEdit>> EditsAsync(SqlServerFixture fixture, Guid assetId) =>
        QueryAsync(fixture, db => db.AssetEdits
            .AsNoTracking()
            .Where(edit => edit.AssetId == assetId)
            .OrderBy(edit => edit.OpenedAtUtc)
            .ToListAsync());

    public static async Task<AssetEdit> EditAsync(SqlServerFixture fixture, Guid editId) =>
        await QueryAsync(fixture, db => db.AssetEdits.AsNoTracking().SingleAsync(edit => edit.Id == editId));

    public static Task<Guid?> ActiveEditIdAsync(SqlServerFixture fixture, Guid assetId) =>
        QueryAsync(fixture, db => db.Assets
            .Where(asset => asset.Id == assetId)
            .Select(asset => asset.ActiveEditId)
            .SingleAsync());

    public static Task<List<(string EventCode, string Description, string ActingUserId)>> AuditsAsync(
        SqlServerFixture fixture,
        Guid assetId) =>
        QueryAsync(fixture, async db =>
        {
            var id = assetId.ToString();
            var rows = await db.Audits
                .AsNoTracking()
                .Where(audit => audit.EventCode.StartsWith("Asset") && audit.Description.Contains(id))
                .OrderBy(audit => audit.OccurredAtUtc)
                .ToListAsync();
            return rows.Select(row => (row.EventCode, row.Description, row.ActingUserId)).ToList();
        });

    public static async Task<JsonElement> JsonAsync(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>();

    public static async Task AssertCodeAsync(
        HttpResponseMessage response,
        HttpStatusCode status,
        string code)
    {
        Assert.Equal(status, response.StatusCode);
        var problem = await ProblemAsync(response);
        Assert.Equal([code], problem.Errors!["code"]);
    }

    public sealed class MutableTimeProvider(DateTimeOffset now) : TimeProvider
    {
        private DateTimeOffset current = now;

        public override DateTimeOffset GetUtcNow() => current;

        public void Advance(TimeSpan by) => current += by;
    }

    public sealed record Entry(string Category, string Text);

    public sealed class CapturingLoggerProvider : ILoggerProvider
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
