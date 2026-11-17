using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Clutch.API.Application.Imports;
using Clutch.API.Domain.Imports;
using Clutch.API.Infrastructure.Imports;
using Clutch.API.Infrastructure.Persistence;
using Clutch.API.Tests.Integration.Accounts;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Clutch.API.Tests.Integration.Imports;

[Collection(SqlServerCollection.Name)]
public sealed class ImportNotificationTests(SqlServerFixture fixture)
{
    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Ended_notice_survives_staging_removal_replacement_and_original_expiry()
    {
        using var owner = CreateClient();
        var username = await RegisterAndSignInAsync(owner);
        var account = await CreateAccountAsync(owner, "Ended notification");
        using var originalResponse = await CreateReviewAsync(
            owner,
            account.Id,
            "Date,Description,Amount\n2025-01-15,Private ended row,12.34");
        var original = await originalResponse.Content.ReadFromJsonAsync<ReviewResponse>();
        Assert.NotNull(original);
        var ownerUserId = await GetOwnerIdAsync(account.Id);

        using var endResponse = await DeleteExactAsync(owner, account.Id, original.Id);
        Assert.Equal(HttpStatusCode.NoContent, endResponse.StatusCode);

        await using (var scope = fixture.Factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var header = await db.ImportReviews.AsNoTracking()
                .SingleAsync(review => review.Id == original.Id);
            Assert.Equal(ImportReviewState.Cancelled, header.State);
            Assert.Equal(ownerUserId, header.EndedByUserId);
            Assert.NotNull(header.EndedAtUtc);
            Assert.Null(header.MappingJson);
            Assert.Null(header.SchemaVersion);
            Assert.False(await db.ImportReviewRows.AnyAsync(row => row.ReviewId == original.Id));
            Assert.Null(await db.Accounts.Where(candidate => candidate.Id == account.Id)
                .Select(candidate => candidate.ActiveImportId).SingleAsync());
        }

        using var replacementResponse = await CreateReviewAsync(
            owner,
            account.Id,
            "Date,Description,Amount\n2025-01-16,Replacement row,45.67");
        Assert.Equal(HttpStatusCode.Created, replacementResponse.StatusCode);
        var replacement = await replacementResponse.Content.ReadFromJsonAsync<ReviewResponse>();
        Assert.NotNull(replacement);

        using var replacedStatus = await GetStatusAsync(owner, account.Id, original.Id);
        Assert.Equal(HttpStatusCode.OK, replacedStatus.StatusCode);
        using (var json = JsonDocument.Parse(await replacedStatus.Content.ReadAsStringAsync()))
        {
            var root = json.RootElement;
            Assert.Equal("Blocked", root.GetProperty("availability").GetString());
            Assert.Equal(replacement.Id, root.GetProperty("activeImport").GetProperty("id").GetGuid());
            var watched = root.GetProperty("watchedImport");
            Assert.Equal("Ended", watched.GetProperty("state").GetString());
            Assert.Equal(ownerUserId, watched.GetProperty("endedBy").GetProperty("userId").GetString());
            Assert.Equal(username, watched.GetProperty("endedBy").GetProperty("userName").GetString());
            Assert.NotEqual(default, watched.GetProperty("endedAtUtc").GetDateTimeOffset());
        }

        await using (var scope = fixture.Factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.ImportReviews.Where(review => review.Id == original.Id)
                .ExecuteUpdateAsync(setters => setters.SetProperty(
                    review => review.ExpiresAtUtc,
                    DateTimeOffset.UtcNow.AddMinutes(-1)));
        }

        await using (var scope = fixture.Factory.Services.CreateAsyncScope())
        {
            var cleanup = new ImportReviewCleanupService(
                scope.ServiceProvider.GetRequiredService<IServiceScopeFactory>(),
                TimeProvider.System,
                scope.ServiceProvider.GetRequiredService<ILogger<ImportReviewCleanupService>>());
            await cleanup.RunCleanupOnceAsync(CancellationToken.None);
        }

        using var afterExpiry = await GetStatusAsync(owner, account.Id, original.Id);
        Assert.Equal(HttpStatusCode.OK, afterExpiry.StatusCode);
        using (var json = JsonDocument.Parse(await afterExpiry.Content.ReadAsStringAsync()))
        {
            var watched = json.RootElement.GetProperty("watchedImport");
            Assert.Equal("Ended", watched.GetProperty("state").GetString());
            Assert.Equal(username, watched.GetProperty("endedBy").GetProperty("userName").GetString());
        }

        await using (var scope = fixture.Factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            Assert.Equal(replacement.Id, await db.Accounts.Where(candidate => candidate.Id == account.Id)
                .Select(candidate => candidate.ActiveImportId).SingleAsync());
            Assert.True(await db.ImportReviewRows.AnyAsync(row => row.ReviewId == replacement.Id));
            Assert.Equal(0, await db.Transactions.CountAsync(candidate => candidate.AccountId == account.Id));
        }

        await using (var scope = fixture.Factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.ImportReviews.Where(review => review.Id == original.Id)
                .ExecuteUpdateAsync(setters => setters.SetProperty(
                    review => review.EndedByUserId,
                    Guid.NewGuid().ToString("N")));
        }

        using var unresolvedIdentity = await GetStatusAsync(owner, account.Id, original.Id);
        Assert.Equal(HttpStatusCode.InternalServerError, unresolvedIdentity.StatusCode);
        var problem = await unresolvedIdentity.Content.ReadAsStringAsync();
        Assert.Contains("ImportStatusUnavailable", problem, StringComparison.Ordinal);
        Assert.DoesNotContain("Private ended row", problem, StringComparison.Ordinal);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Ordinary_cancellation_expiry_and_missing_reviews_are_not_attributed_as_ended()
    {
        using var owner = CreateClient();
        await RegisterAndSignInAsync(owner);
        var account = await CreateAccountAsync(owner, "Non-ended notifications");

        using var cancelledResponse = await CreateReviewAsync(
            owner,
            account.Id,
            "Date,Description,Amount\n2025-01-15,Cancelled row,12.34");
        var cancelled = await cancelledResponse.Content.ReadFromJsonAsync<ReviewResponse>();
        Assert.NotNull(cancelled);
        using var cancelResponse = await SendJsonAsync(
            owner,
            HttpMethod.Delete,
            $"/api/import-reviews/{cancelled.Id}",
            null);
        Assert.Equal(HttpStatusCode.NoContent, cancelResponse.StatusCode);
        using (var cancelledStatus = await GetStatusAsync(owner, account.Id, cancelled.Id))
        {
            Assert.Equal(HttpStatusCode.OK, cancelledStatus.StatusCode);
            using var json = JsonDocument.Parse(await cancelledStatus.Content.ReadAsStringAsync());
            Assert.Equal(
                "Unavailable",
                json.RootElement.GetProperty("watchedImport").GetProperty("state").GetString());
        }

        using var expiredResponse = await CreateReviewAsync(
            owner,
            account.Id,
            "Date,Description,Amount\n2025-01-16,Expired row,45.67");
        var expired = await expiredResponse.Content.ReadFromJsonAsync<ReviewResponse>();
        Assert.NotNull(expired);
        await using (var scope = fixture.Factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.ImportReviews.Where(review => review.Id == expired.Id)
                .ExecuteUpdateAsync(setters => setters.SetProperty(
                    review => review.ExpiresAtUtc,
                    DateTimeOffset.UtcNow.AddMinutes(-1)));
        }

        using (var expiryStatus = await GetStatusAsync(owner, account.Id, expired.Id))
        {
            Assert.Equal(HttpStatusCode.OK, expiryStatus.StatusCode);
            using var json = JsonDocument.Parse(await expiryStatus.Content.ReadAsStringAsync());
            Assert.Equal(
                "Expired",
                json.RootElement.GetProperty("watchedImport").GetProperty("state").GetString());
        }

        await using (var scope = fixture.Factory.Services.CreateAsyncScope())
        {
            var cleanup = new ImportReviewCleanupService(
                scope.ServiceProvider.GetRequiredService<IServiceScopeFactory>(),
                TimeProvider.System,
                scope.ServiceProvider.GetRequiredService<ILogger<ImportReviewCleanupService>>());
            await cleanup.RunCleanupOnceAsync(CancellationToken.None);
        }

        using (var cleanedStatus = await GetStatusAsync(owner, account.Id, expired.Id))
        {
            Assert.Equal(HttpStatusCode.OK, cleanedStatus.StatusCode);
            using var json = JsonDocument.Parse(await cleanedStatus.Content.ReadAsStringAsync());
            Assert.Equal(
                "Unavailable",
                json.RootElement.GetProperty("watchedImport").GetProperty("state").GetString());
        }

        using var missingStatus = await GetStatusAsync(owner, account.Id, Guid.NewGuid());
        Assert.Equal(HttpStatusCode.OK, missingStatus.StatusCode);
        using var missingJson = JsonDocument.Parse(await missingStatus.Content.ReadAsStringAsync());
        Assert.Equal(
            "Unavailable",
            missingJson.RootElement.GetProperty("watchedImport").GetProperty("state").GetString());
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Watched_ended_review_is_not_visible_through_another_account()
    {
        using var owner = CreateClient();
        await RegisterAndSignInAsync(owner);
        var account = await CreateAccountAsync(owner, "Watched account");
        var otherAccount = await CreateAccountAsync(owner, "Other watched account");
        using var otherReviewResponse = await CreateReviewAsync(
            owner,
            otherAccount.Id,
            "Date,Description,Amount\n2025-01-15,Private other-account row,12.34");
        var otherReview = await otherReviewResponse.Content.ReadFromJsonAsync<ReviewResponse>();
        Assert.NotNull(otherReview);

        using var response = await GetStatusAsync(owner, account.Id, otherReview.Id);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        var problem = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("Private other-account row", problem, StringComparison.Ordinal);
    }

    private HttpClient CreateClient() =>
        fixture.Factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost"),
            AllowAutoRedirect = false,
        });

    private static async Task<string> RegisterAndSignInAsync(HttpClient client)
    {
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
        return email;
    }

    private static async Task<AccountResponse> CreateAccountAsync(HttpClient client, string description)
    {
        using var response = await SendJsonAsync(
            client,
            HttpMethod.Post,
            "/api/accounts",
            new { description, currencyCode = "AUD" });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var account = await response.Content.ReadFromJsonAsync<AccountResponse>();
        Assert.NotNull(account);
        return account;
    }

    private static async Task<HttpResponseMessage> CreateReviewAsync(
        HttpClient client,
        Guid accountId,
        string csv)
    {
        var mapping = new ImportMapping(
            DateColumn: 0,
            DescriptionColumn: 1,
            DateFormat: "yyyy-MM-dd",
            AmountMode: ImportAmountMode.Signed,
            SignedAmountColumn: 2,
            IncomingSign: IncomingSign.Positive,
            NumberFormat: "dot-decimal-comma-grouping");
        using var tokenResponse = await client.GetAsync("/api/security/csrf-token");
        tokenResponse.EnsureSuccessStatusCode();
        var csrf = await tokenResponse.Content.ReadFromJsonAsync<CsrfTokenResponse>();
        Assert.NotNull(csrf);
        using var content = new MultipartFormDataContent();
        content.Add(
            new ByteArrayContent(Encoding.UTF8.GetBytes(csv)),
            "file",
            "transactions.csv");
        content.Add(new StringContent(JsonSerializer.Serialize(
            mapping,
            new JsonSerializerOptions(JsonSerializerDefaults.Web))), "mapping");
        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"/api/accounts/{accountId}/import-reviews")
        {
            Content = content,
        };
        request.Headers.Add("X-CSRF-TOKEN", csrf.RequestToken);
        return await client.SendAsync(request);
    }

    private static async Task<HttpResponseMessage> DeleteExactAsync(
        HttpClient client,
        Guid accountId,
        Guid reviewId) =>
        await SendJsonAsync(
            client,
            HttpMethod.Delete,
            $"/api/accounts/{accountId}/active-import-review?reviewId={reviewId}",
            null);

    private static Task<HttpResponseMessage> GetStatusAsync(
        HttpClient client,
        Guid accountId,
        Guid reviewId) =>
        client.GetAsync($"/api/accounts/{accountId}/import-status?reviewId={reviewId}");

    private async Task<string> GetOwnerIdAsync(Guid accountId)
    {
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await db.Accounts.Where(candidate => candidate.Id == accountId)
            .Select(candidate => candidate.OwnerUserId)
            .SingleAsync() ?? throw new InvalidOperationException("The account must have an owner.");
    }

    private static async Task<HttpResponseMessage> SendJsonAsync(
        HttpClient client,
        HttpMethod method,
        string path,
        object? content)
    {
        using var tokenResponse = await client.GetAsync("/api/security/csrf-token");
        tokenResponse.EnsureSuccessStatusCode();
        var csrf = await tokenResponse.Content.ReadFromJsonAsync<CsrfTokenResponse>();
        Assert.NotNull(csrf);
        using var request = new HttpRequestMessage(method, path)
        {
            Content = content is null ? null : JsonContent.Create(content),
        };
        request.Headers.Add("X-CSRF-TOKEN", csrf.RequestToken);
        return await client.SendAsync(request);
    }

    private sealed record CsrfTokenResponse(string RequestToken);

    private sealed record AccountResponse(Guid Id);

    private sealed record ReviewResponse(Guid Id, DateTimeOffset ExpiresAtUtc);
}
