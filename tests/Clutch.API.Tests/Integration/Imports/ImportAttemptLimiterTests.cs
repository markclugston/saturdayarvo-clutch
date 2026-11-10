using System.Net;
using System.Net.Http.Json;
using Clutch.API.Application.Imports;
using Clutch.API.Domain.Imports;
using Clutch.API.Infrastructure.Imports;
using Clutch.API.Infrastructure.Persistence;
using Clutch.API.Tests.Integration.Accounts;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Clutch.API.Tests.Integration.Imports;

[Collection(SqlServerCollection.Name)]
public sealed class ImportAttemptLimiterTests(SqlServerFixture fixture)
{
    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Configured_attempt_limit_is_enforced_and_a_new_window_resets_the_count()
    {
        var (userId, configuredLimit) = await CreateUserAndConfigureLimitAsync(2);
        var clock = new MutableTimeProvider(new DateTimeOffset(2026, 11, 8, 12, 34, 10, TimeSpan.Zero));

        try
        {
            Assert.True(await ConsumeAsync(userId, configuredLimit, clock));
            Assert.True(await ConsumeAsync(userId, configuredLimit, clock));
            Assert.False(await ConsumeAsync(userId, configuredLimit, clock));

            await using (var scope = fixture.Factory.Services.CreateAsyncScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var currentWindow = await db.ImportRateWindows
                    .SingleAsync(window => window.UserId == userId);
                Assert.Equal(3, currentWindow.AttemptCount);
            }

            clock.Advance(TimeSpan.FromMinutes(1));
            Assert.True(await ConsumeAsync(userId, configuredLimit, clock));

            await using (var scope = fixture.Factory.Services.CreateAsyncScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var currentWindow = await db.ImportRateWindows
                    .SingleAsync(window => window.UserId == userId
                        && window.WindowStartedAtUtc == clock.GetUtcNow()
                            .AddSeconds(-clock.GetUtcNow().Second));
                Assert.Equal(1, currentWindow.AttemptCount);
            }

            clock.Advance(TimeSpan.FromMinutes(2));
            Assert.True(await ConsumeAsync(userId, configuredLimit, clock));
            await using var verifyScope = fixture.Factory.Services.CreateAsyncScope();
            var verifyDb = verifyScope.ServiceProvider.GetRequiredService<AppDbContext>();
            Assert.Equal(1, await verifyDb.ImportRateWindows.CountAsync(window => window.UserId == userId));
        }
        finally
        {
            await RestoreDefaultLimitsAsync(userId);
        }
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Concurrent_attempts_in_one_window_are_counted_atomically()
    {
        const int configuredLimit = 4;
        const int concurrentAttempts = 16;
        var (userId, loadedLimit) = await CreateUserAndConfigureLimitAsync(configuredLimit);
        var clock = new MutableTimeProvider(new DateTimeOffset(2026, 11, 8, 12, 34, 10, TimeSpan.Zero));

        try
        {
            var results = await Task.WhenAll(Enumerable.Range(0, concurrentAttempts)
                .Select(_ => ConsumeAsync(userId, loadedLimit, clock)));

            Assert.Equal(configuredLimit, results.Count(result => result));
            await using var scope = fixture.Factory.Services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var window = await db.ImportRateWindows.SingleAsync(candidate => candidate.UserId == userId);
            Assert.Equal(concurrentAttempts, window.AttemptCount);
        }
        finally
        {
            await RestoreDefaultLimitsAsync(userId);
        }
    }

    private async Task<(string UserId, int MaxAttempts)> CreateUserAndConfigureLimitAsync(
        int maxAttempts)
    {
        using var client = fixture.Factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost"),
            AllowAutoRedirect = false,
        });
        var email = $"{Guid.NewGuid():N}@example.test";
        using var register = await SendJsonAsync(
            client,
            HttpMethod.Post,
            "/api/security/register",
            new { email, password = "Test-only!Password-123" });
        Assert.Equal(HttpStatusCode.Created, register.StatusCode);

        using var login = await SendJsonAsync(
            client,
            HttpMethod.Post,
            "/api/security/login",
            new { email, password = "Test-only!Password-123" });
        Assert.Equal(HttpStatusCode.NoContent, login.StatusCode);

        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var userId = await db.Users
            .Where(user => user.NormalizedEmail == email.ToUpperInvariant())
            .Select(user => user.Id)
            .SingleAsync();
        var limits = new ImportLimits(
            ImportLimits.Default.MaxFileSizeBytes,
            ImportLimits.Default.MaxRowsPerImport,
            maxAttempts);
        var settings = new ImportLimitSettingsService(db, TimeProvider.System);
        await settings.UpdateAsync(limits, userId, CancellationToken.None);
        var configured = await settings.GetAsync(CancellationToken.None);
        return (userId, configured.MaxImportAttemptsPerUserPerMinute);
    }

    private async Task RestoreDefaultLimitsAsync(string userId)
    {
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var settings = new ImportLimitSettingsService(db, TimeProvider.System);
        await settings.UpdateAsync(ImportLimits.Default, userId, CancellationToken.None);
    }

    private async Task<bool> ConsumeAsync(
        string userId,
        int maxAttempts,
        MutableTimeProvider clock)
    {
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var limiter = new ImportAttemptLimiter(db, clock);
        return await limiter.TryConsumeAsync(userId, maxAttempts, CancellationToken.None);
    }

    private static async Task<HttpResponseMessage> SendJsonAsync(
        HttpClient client,
        HttpMethod method,
        string path,
        object? content)
    {
        using var tokenResponse = await client.GetAsync("/api/security/csrf-token");
        tokenResponse.EnsureSuccessStatusCode();
        var token = await tokenResponse.Content.ReadFromJsonAsync<CsrfTokenResponse>();
        Assert.NotNull(token);

        using var request = new HttpRequestMessage(method, path)
        {
            Content = content is null ? null : JsonContent.Create(content),
        };
        request.Headers.Add("X-CSRF-TOKEN", token.RequestToken);
        return await client.SendAsync(request);
    }

    private sealed class MutableTimeProvider(DateTimeOffset now) : TimeProvider
    {
        private DateTimeOffset _now = now;

        public override DateTimeOffset GetUtcNow() => _now;

        public void Advance(TimeSpan amount) => _now = _now.Add(amount);
    }

    private sealed record CsrfTokenResponse(string RequestToken);
}
