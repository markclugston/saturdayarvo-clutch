using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Clutch.API.Application.Imports;
using Clutch.API.Domain.Imports;
using Clutch.API.Domain.Transactions;
using Clutch.API.Infrastructure.Persistence;
using Clutch.API.Tests.Integration.Accounts;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Clutch.API.Tests.Integration.Imports;

[Collection(SqlServerCollection.Name)]
public sealed class ImportStatusTests(SqlServerFixture fixture)
{
    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Owner_gets_an_available_or_preview_projection_without_import_contents()
    {
        using var owner = CreateClient();
        await RegisterAndSignInAsync(owner);
        var account = await CreateAccountAsync(owner, "Status savings");

        using var availableResponse = await owner.GetAsync(
            $"/api/accounts/{account.Id}/import-status");
        Assert.Equal(HttpStatusCode.OK, availableResponse.StatusCode);
        Assert.True(availableResponse.Headers.CacheControl?.NoStore);
        using var availableJson = JsonDocument.Parse(await availableResponse.Content.ReadAsStringAsync());
        Assert.Equal("Available", availableJson.RootElement.GetProperty("availability").GetString());
        Assert.Equal(JsonValueKind.Null, availableJson.RootElement.GetProperty("activeImport").ValueKind);

        using var reviewResponse = await CreateReviewAsync(
            owner,
            account.Id,
            "Date,Description,Amount\n2025-01-15,Private staged status row,12.34");
        Assert.Equal(HttpStatusCode.Created, reviewResponse.StatusCode);
        var review = await reviewResponse.Content.ReadFromJsonAsync<ReviewResponse>();
        Assert.NotNull(review);

        using var blockedResponse = await owner.GetAsync(
            $"/api/accounts/{account.Id}/import-status");
        Assert.Equal(HttpStatusCode.OK, blockedResponse.StatusCode);
        Assert.True(blockedResponse.Headers.CacheControl?.NoStore);
        var blockedBody = await blockedResponse.Content.ReadAsStringAsync();
        Assert.DoesNotContain("Private staged status row", blockedBody, StringComparison.Ordinal);
        Assert.DoesNotContain("mapping", blockedBody, StringComparison.OrdinalIgnoreCase);
        using var blockedJson = JsonDocument.Parse(blockedBody);
        var active = blockedJson.RootElement.GetProperty("activeImport");
        Assert.Equal("Blocked", blockedJson.RootElement.GetProperty("availability").GetString());
        Assert.Equal(review.Id, active.GetProperty("id").GetGuid());
        Assert.Equal("Preview", active.GetProperty("stage").GetString());
        Assert.True(active.GetProperty("canEnd").GetBoolean());
        Assert.Equal(JsonValueKind.Null, blockedJson.RootElement.GetProperty("watchedImport").ValueKind);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Status_distinguishes_processing_expiry_and_retained_ended_identity_without_writes()
    {
        using var owner = CreateClient();
        var username = await RegisterAndSignInAsync(owner);
        var account = await CreateAccountAsync(owner, "Watched status");
        using var reviewResponse = await CreateReviewAsync(
            owner,
            account.Id,
            "Date,Description,Amount\n2025-01-15,Private staged row,12.34");
        var review = await reviewResponse.Content.ReadFromJsonAsync<ReviewResponse>();
        Assert.NotNull(review);

        var attemptId = Guid.NewGuid();
        await using (var scope = fixture.Factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.ImportReviews.Where(candidate => candidate.Id == review.Id)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(candidate => candidate.State, ImportReviewState.Processing)
                    .SetProperty(candidate => candidate.ConfirmationAttemptId, attemptId)
                    .SetProperty(candidate => candidate.ProcessingStartedAtUtc, DateTimeOffset.UtcNow));
        }

        using var processingResponse = await owner.GetAsync(
            $"/api/accounts/{account.Id}/import-status?reviewId={review.Id}");
        Assert.Equal(HttpStatusCode.OK, processingResponse.StatusCode);
        using (var processingJson = JsonDocument.Parse(await processingResponse.Content.ReadAsStringAsync()))
        {
            Assert.Equal(
                "Processing",
                processingJson.RootElement.GetProperty("activeImport").GetProperty("stage").GetString());
            Assert.False(processingJson.RootElement.GetProperty("activeImport").GetProperty("canEnd").GetBoolean());
            Assert.Equal(
                "Processing",
                processingJson.RootElement.GetProperty("watchedImport").GetProperty("state").GetString());
        }

        await using (var scope = fixture.Factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.ImportReviews.Where(candidate => candidate.Id == review.Id)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(candidate => candidate.State, ImportReviewState.Ready)
                    .SetProperty(candidate => candidate.ConfirmationAttemptId, (Guid?)null)
                    .SetProperty(candidate => candidate.ProcessingStartedAtUtc, (DateTimeOffset?)null)
                    .SetProperty(candidate => candidate.ExpiresAtUtc, DateTimeOffset.UtcNow.AddMinutes(-1)));
        }

        using var expiredResponse = await owner.GetAsync(
            $"/api/accounts/{account.Id}/import-status?reviewId={review.Id}");
        Assert.Equal(HttpStatusCode.OK, expiredResponse.StatusCode);
        using (var expiredJson = JsonDocument.Parse(await expiredResponse.Content.ReadAsStringAsync()))
        {
            Assert.Equal("Available", expiredJson.RootElement.GetProperty("availability").GetString());
            Assert.Equal(JsonValueKind.Null, expiredJson.RootElement.GetProperty("activeImport").ValueKind);
            Assert.Equal("Expired", expiredJson.RootElement.GetProperty("watchedImport").GetProperty("state").GetString());
        }

        string ownerUserId;
        await using (var scope = fixture.Factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            Assert.True(await db.ImportReviews.AnyAsync(candidate => candidate.Id == review.Id));
            Assert.True(await db.ImportReviewRows.AnyAsync(row => row.ReviewId == review.Id));
            Assert.Equal(review.Id, await db.Accounts.Where(candidate => candidate.Id == account.Id)
                .Select(candidate => candidate.ActiveImportId).SingleAsync());
            ownerUserId = await db.Accounts.Where(candidate => candidate.Id == account.Id)
                .Select(candidate => candidate.OwnerUserId)
                .SingleAsync() ?? throw new InvalidOperationException("The account must have an owner.");
            await db.ImportReviewRows.Where(row => row.ReviewId == review.Id).ExecuteDeleteAsync();
            await db.ImportReviews.Where(candidate => candidate.Id == review.Id)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(candidate => candidate.State, ImportReviewState.Cancelled)
                    .SetProperty(candidate => candidate.ExpiresAtUtc, review.ExpiresAtUtc)
                    .SetProperty(candidate => candidate.SchemaVersion, (int?)null)
                    .SetProperty(candidate => candidate.MappingJson, (string?)null)
                    .SetProperty(candidate => candidate.EndedByUserId, ownerUserId)
                    .SetProperty(candidate => candidate.EndedAtUtc, DateTimeOffset.UtcNow));
        }

        using var endedResponse = await owner.GetAsync(
            $"/api/accounts/{account.Id}/import-status?reviewId={review.Id}");
        Assert.Equal(HttpStatusCode.OK, endedResponse.StatusCode);
        using var endedJson = JsonDocument.Parse(await endedResponse.Content.ReadAsStringAsync());
        var ended = endedJson.RootElement.GetProperty("watchedImport");
        Assert.Equal("Ended", ended.GetProperty("state").GetString());
        Assert.Equal(username, ended.GetProperty("endedBy").GetProperty("userName").GetString());
        Assert.Equal(ownerUserId, ended.GetProperty("endedBy").GetProperty("userId").GetString());

        await using (var identityFailureScope = fixture.Factory.Services.CreateAsyncScope())
        {
            var db = identityFailureScope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.ImportReviews.Where(candidate => candidate.Id == review.Id)
                .ExecuteUpdateAsync(setters => setters.SetProperty(
                    candidate => candidate.EndedByUserId,
                    Guid.NewGuid().ToString("N")));
        }

        using var unresolvedIdentity = await owner.GetAsync(
            $"/api/accounts/{account.Id}/import-status?reviewId={review.Id}");
        Assert.Equal(HttpStatusCode.InternalServerError, unresolvedIdentity.StatusCode);

        await using var verifyScope = fixture.Factory.Services.CreateAsyncScope();
        var verifyDb = verifyScope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.True(await verifyDb.ImportReviews.AnyAsync(candidate => candidate.Id == review.Id));
        Assert.Equal(review.Id, await verifyDb.Accounts.Where(candidate => candidate.Id == account.Id)
            .Select(candidate => candidate.ActiveImportId).SingleAsync());
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Status_isolates_accounts_and_returns_404_for_inaccessible_watched_reviews()
    {
        using var owner = CreateClient();
        await RegisterAndSignInAsync(owner);
        var account = await CreateAccountAsync(owner, "Status isolation");
        var otherAccount = await CreateAccountAsync(owner, "Other import");
        using var otherReviewResponse = await CreateReviewAsync(
            owner,
            otherAccount.Id,
            "Date,Description,Amount\n2025-01-15,Other account row,12.34");
        var otherReview = await otherReviewResponse.Content.ReadFromJsonAsync<ReviewResponse>();
        Assert.NotNull(otherReview);

        using var available = await owner.GetAsync(
            $"/api/accounts/{account.Id}/import-status");
        Assert.Equal(HttpStatusCode.OK, available.StatusCode);
        using (var availableJson = JsonDocument.Parse(await available.Content.ReadAsStringAsync()))
        {
            Assert.Equal("Available", availableJson.RootElement.GetProperty("availability").GetString());
        }

        using var inaccessibleWatched = await owner.GetAsync(
            $"/api/accounts/{account.Id}/import-status?reviewId={otherReview.Id}");
        Assert.Equal(HttpStatusCode.NotFound, inaccessibleWatched.StatusCode);

        using var missingWatched = await owner.GetAsync(
            $"/api/accounts/{account.Id}/import-status?reviewId={Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.OK, missingWatched.StatusCode);
        using (var missingJson = JsonDocument.Parse(await missingWatched.Content.ReadAsStringAsync()))
        {
            Assert.Equal(
                "Unavailable",
                missingJson.RootElement.GetProperty("watchedImport").GetProperty("state").GetString());
        }

        using var malformed = await owner.GetAsync(
            $"/api/accounts/{account.Id}/import-status?reviewId=not-a-guid");
        Assert.Equal(HttpStatusCode.BadRequest, malformed.StatusCode);

        using var stranger = CreateClient();
        await RegisterAndSignInAsync(stranger);
        using var denied = await stranger.GetAsync(
            $"/api/accounts/{account.Id}/import-status?reviewId={otherReview.Id}");
        Assert.Equal(HttpStatusCode.NotFound, denied.StatusCode);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Status_keeps_dangling_leases_blocked_as_unknown()
    {
        using var owner = CreateClient();
        await RegisterAndSignInAsync(owner);
        var account = await CreateAccountAsync(owner, "Dangling status");
        var danglingId = Guid.NewGuid();
        await using (var scope = fixture.Factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.Accounts.Where(candidate => candidate.Id == account.Id)
                .ExecuteUpdateAsync(setters => setters.SetProperty(
                    candidate => candidate.ActiveImportId,
                    (Guid?)danglingId));
        }

        using var response = await owner.GetAsync(
            $"/api/accounts/{account.Id}/import-status");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var active = json.RootElement.GetProperty("activeImport");
        Assert.Equal("Blocked", json.RootElement.GetProperty("availability").GetString());
        Assert.Equal(danglingId, active.GetProperty("id").GetGuid());
        Assert.Equal("Unknown", active.GetProperty("stage").GetString());
        Assert.False(active.GetProperty("canEnd").GetBoolean());
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
