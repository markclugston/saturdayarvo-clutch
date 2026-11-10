using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Clutch.API.Application.Imports;
using Clutch.API.Domain.Accounts;
using Clutch.API.Domain.Imports;
using Clutch.API.Domain.Shared;
using Clutch.API.Domain.Transactions;
using Clutch.API.Infrastructure.Persistence;
using Clutch.API.Tests.Integration.Accounts;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Clutch.API.Tests.Integration.Imports;

[Collection(SqlServerCollection.Name)]
public sealed class DuplicateAndConcurrencyTests(SqlServerFixture fixture)
{
    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Existing_and_same_file_duplicates_require_explicit_confirmation_and_can_be_cancelled()
    {
        using var client = CreateClient();
        await RegisterAndSignInAsync(client);
        var accountId = await CreateAccountAsync(client);
        const string duplicateCsv =
            "Date,Description,Amount\n2025-01-15,Market,10.00\n2025-01-15,Market,10.00";

        using var reviewResponse = await CreateReviewAsync(client, accountId, duplicateCsv);
        Assert.Equal(HttpStatusCode.Created, reviewResponse.StatusCode);
        var review = await reviewResponse.Content.ReadFromJsonAsync<ReviewResponse>();
        Assert.NotNull(review);
        Assert.True(review.DuplicateConfirmationRequired);
        Assert.All(review.Rows, row => Assert.True(row.IsPossibleDuplicate));

        using var unconfirmedResponse = await ConfirmAsync(client, review.Id, false);
        Assert.Equal(HttpStatusCode.Conflict, unconfirmedResponse.StatusCode);

        using var confirmationResponse = await ConfirmAsync(client, review.Id, true);
        Assert.Equal(HttpStatusCode.OK, confirmationResponse.StatusCode);
        var confirmation = await confirmationResponse.Content.ReadFromJsonAsync<ConfirmResponse>();
        Assert.NotNull(confirmation);
        Assert.Equal(2, confirmation.ImportedCount);

        using var existingDuplicateResponse = await CreateReviewAsync(client, accountId, duplicateCsv);
        var existingDuplicateReview =
            await existingDuplicateResponse.Content.ReadFromJsonAsync<ReviewResponse>();
        Assert.NotNull(existingDuplicateReview);
        Assert.True(existingDuplicateReview.DuplicateConfirmationRequired);
        Assert.All(existingDuplicateReview.Rows, row => Assert.True(row.IsPossibleDuplicate));

        using var cancelResponse = await SendJsonAsync(
            client,
            HttpMethod.Delete,
            $"/api/import-reviews/{existingDuplicateReview.Id}",
            content: null);
        Assert.Equal(HttpStatusCode.NoContent, cancelResponse.StatusCode);

        var transactionCount = await GetTransactionCountAsync(client, accountId);
        Assert.Equal(2, transactionCount);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Duplicate_matching_is_isolated_to_the_selected_account()
    {
        using var client = CreateClient();
        await RegisterAndSignInAsync(client);
        var firstAccountId = await CreateAccountAsync(client);
        var secondAccountId = await CreateAccountAsync(client);
        const string csv = "Date,Description,Amount\n2025-01-15,Market,10.00";

        using var firstReviewResponse = await CreateReviewAsync(client, firstAccountId, csv);
        var firstReview = await firstReviewResponse.Content.ReadFromJsonAsync<ReviewResponse>();
        Assert.NotNull(firstReview);
        using var firstConfirmation = await ConfirmAsync(client, firstReview.Id, false);
        Assert.Equal(HttpStatusCode.OK, firstConfirmation.StatusCode);

        using var secondReviewResponse = await CreateReviewAsync(client, secondAccountId, csv);
        Assert.Equal(HttpStatusCode.Created, secondReviewResponse.StatusCode);
        var secondReview = await secondReviewResponse.Content.ReadFromJsonAsync<ReviewResponse>();
        Assert.NotNull(secondReview);
        Assert.False(secondReview.DuplicateConfirmationRequired);
        Assert.False(Assert.Single(secondReview.Rows).IsPossibleDuplicate);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Newly_discovered_duplicates_require_a_fresh_explicit_confirmation()
    {
        using var client = CreateClient();
        await RegisterAndSignInAsync(client);
        var accountId = await CreateAccountAsync(client);
        const string csv = "Date,Description,Amount\n2025-01-15,Late charge,10.00";

        using var reviewResponse = await CreateReviewAsync(client, accountId, csv);
        var review = await reviewResponse.Content.ReadFromJsonAsync<ReviewResponse>();
        Assert.NotNull(review);
        Assert.False(review.DuplicateConfirmationRequired);

        await InsertTransactionAsync(accountId, "Late charge", 10m, TransactionDirection.Incoming);

        using var staleConfirmation = await ConfirmAsync(client, review.Id, true);
        Assert.Equal(HttpStatusCode.Conflict, staleConfirmation.StatusCode);
        var refreshedReview = await staleConfirmation.Content.ReadFromJsonAsync<ProblemResponse>();
        Assert.NotNull(refreshedReview);
        Assert.Contains(
            "DuplicateConfirmationRequired",
            refreshedReview.Errors?.GetValueOrDefault("code") ?? []);
        Assert.Contains("2", refreshedReview.Errors?.GetValueOrDefault("rowNumbers") ?? []);

        using var confirmation = await ConfirmAsync(client, review.Id, true);
        Assert.Equal(HttpStatusCode.OK, confirmation.StatusCode);
        Assert.Equal(2, await GetTransactionCountAsync(client, accountId));
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Concurrent_review_requests_acquire_only_one_account_lease()
    {
        using var client = CreateClient();
        await RegisterAndSignInAsync(client);
        var accountId = await CreateAccountAsync(client);
        var csrfToken = await GetCsrfTokenAsync(client);
        const string csv = "Date,Description,Amount\n2025-01-15,Market,10.00";

        var responses = await Task.WhenAll(
            CreateReviewWithTokenAsync(client, accountId, csv, csrfToken),
            CreateReviewWithTokenAsync(client, accountId, csv, csrfToken));

        Assert.Single(responses, response => response.StatusCode == HttpStatusCode.Created);
        Assert.Single(responses, response => response.StatusCode == HttpStatusCode.Conflict);
        foreach (var response in responses)
        {
            response.Dispose();
        }
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Confirmation_and_recovery_race_has_one_consistent_terminal_result()
    {
        using var client = CreateClient();
        await RegisterAndSignInAsync(client);
        var accountId = await CreateAccountAsync(client);
        const string csv = "Date,Description,Amount\n2025-01-15,Market,10.00";
        using var response = await CreateReviewAsync(client, accountId, csv);
        var review = await response.Content.ReadFromJsonAsync<ReviewResponse>();
        Assert.NotNull(review);

        var results = await Task.WhenAll(
            ConfirmAsync(client, review.Id, false),
            SendJsonAsync(client, HttpMethod.Delete, $"/api/accounts/{accountId}/active-import-review", null));
        using var confirmation = results[0];
        using var cancellation = results[1];
        Assert.Contains(confirmation.StatusCode, new[] { HttpStatusCode.OK, HttpStatusCode.Conflict });
        Assert.Contains(cancellation.StatusCode, new[] { HttpStatusCode.NoContent, HttpStatusCode.Conflict });

        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var persistedReview = await db.ImportReviews.SingleAsync(candidate => candidate.Id == review.Id);
        var account = await db.Accounts.SingleAsync(candidate => candidate.Id == accountId);
        Assert.Null(account.ActiveImportId);
        Assert.Equal(0, await db.ImportReviewRows.CountAsync(row => row.ReviewId == review.Id));
        var count = await db.Transactions.CountAsync(transaction => transaction.AccountId == accountId);
        if (confirmation.StatusCode == HttpStatusCode.OK)
        {
            Assert.Equal(ImportReviewState.Confirmed, persistedReview.State);
            Assert.Equal(1, count);
        }
        else
        {
            Assert.Equal(ImportReviewState.Cancelled, persistedReview.State);
            Assert.Equal(0, count);
        }
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Concurrent_replacement_requests_expire_a_stale_review_and_preserve_the_new_lease()
    {
        using var client = CreateClient();
        await RegisterAndSignInAsync(client);
        var accountId = await CreateAccountAsync(client);
        const string csv = "Date,Description,Amount\n2025-01-15,Market,10.00";

        using var staleResponse = await CreateReviewAsync(client, accountId, csv);
        var staleReview = await staleResponse.Content.ReadFromJsonAsync<ReviewResponse>();
        Assert.NotNull(staleReview);
        await using (var scope = fixture.Factory.Services.CreateAsyncScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await dbContext.ImportReviews
                .Where(review => review.Id == staleReview.Id)
                .ExecuteUpdateAsync(setters => setters.SetProperty(
                    review => review.ExpiresAtUtc,
                    DateTimeOffset.UtcNow.AddMinutes(-1)));
        }

        var csrfToken = await GetCsrfTokenAsync(client);
        var responses = await Task.WhenAll(
            CreateReviewWithTokenAsync(client, accountId, csv, csrfToken),
            CreateReviewWithTokenAsync(client, accountId, csv, csrfToken));

        Assert.Single(responses, response => response.StatusCode == HttpStatusCode.Created);
        Assert.Single(responses, response => response.StatusCode == HttpStatusCode.Conflict);
        var replacementResponse = Assert.Single(
            responses,
            response => response.StatusCode == HttpStatusCode.Created);
        var replacement = await replacementResponse.Content.ReadFromJsonAsync<ReviewResponse>();
        Assert.NotNull(replacement);
        foreach (var response in responses)
        {
            response.Dispose();
        }

        await using var verifyScope = fixture.Factory.Services.CreateAsyncScope();
        var verifyDbContext = verifyScope.ServiceProvider.GetRequiredService<AppDbContext>();
        var expiredReview = await verifyDbContext.ImportReviews
            .SingleAsync(review => review.Id == staleReview.Id);
        Assert.Equal(ImportReviewState.Expired, expiredReview.State);
        Assert.Equal(0, await verifyDbContext.ImportReviewRows
            .CountAsync(row => row.ReviewId == staleReview.Id));
        var account = await verifyDbContext.Accounts.SingleAsync(candidate => candidate.Id == accountId);
        Assert.Equal(replacement.Id, account.ActiveImportId);
    }

    private HttpClient CreateClient() =>
        fixture.Factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost"),
            AllowAutoRedirect = false,
        });

    private static async Task RegisterAndSignInAsync(HttpClient client)
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
    }

    private static async Task<Guid> CreateAccountAsync(HttpClient client)
    {
        using var response = await SendJsonAsync(
            client,
            HttpMethod.Post,
            "/api/accounts",
            new { description = "Everyday account", currencyCode = "AUD" });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var account = await response.Content.ReadFromJsonAsync<AccountResponse>();
        Assert.NotNull(account);
        return account.Id;
    }

    private static async Task<HttpResponseMessage> CreateReviewAsync(
        HttpClient client,
        Guid accountId,
        string csv)
    {
        var csrfToken = await GetCsrfTokenAsync(client);
        return await CreateReviewWithTokenAsync(client, accountId, csv, csrfToken);
    }

    private static async Task<HttpResponseMessage> CreateReviewWithTokenAsync(
        HttpClient client,
        Guid accountId,
        string csv,
        string csrfToken)
    {
        using var content = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(Encoding.UTF8.GetBytes(csv));
        fileContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("text/csv");
        content.Add(fileContent, "file", "transactions.csv");
        content.Add(
            new StringContent(JsonSerializer.Serialize(SignedMapping(), new JsonSerializerOptions(
                JsonSerializerDefaults.Web))),
            "mapping");

        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"/api/accounts/{accountId}/import-reviews")
        {
            Content = content,
        };
        request.Headers.Add("X-CSRF-TOKEN", csrfToken);
        return await client.SendAsync(request);
    }

    private static async Task<HttpResponseMessage> ConfirmAsync(
        HttpClient client,
        Guid reviewId,
        bool confirmPossibleDuplicates) =>
        await SendJsonAsync(
            client,
            HttpMethod.Post,
            $"/api/import-reviews/{reviewId}/confirm",
            new { confirmPossibleDuplicates });

    private static async Task<HttpResponseMessage> SendJsonAsync(
        HttpClient client,
        HttpMethod method,
        string path,
        object? content)
    {
        var csrfToken = await GetCsrfTokenAsync(client);
        using var request = new HttpRequestMessage(method, path)
        {
            Content = content is null ? null : JsonContent.Create(content),
        };
        request.Headers.Add("X-CSRF-TOKEN", csrfToken);
        return await client.SendAsync(request);
    }

    private static async Task<string> GetCsrfTokenAsync(HttpClient client)
    {
        using var response = await client.GetAsync("/api/security/csrf-token");
        response.EnsureSuccessStatusCode();
        var token = await response.Content.ReadFromJsonAsync<CsrfTokenResponse>();
        Assert.NotNull(token);
        return token.RequestToken;
    }

    private static async Task<int> GetTransactionCountAsync(HttpClient client, Guid accountId)
    {
        using var response = await client.GetAsync($"/api/accounts/{accountId}/transactions");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var page = await response.Content.ReadFromJsonAsync<TransactionPage>();
        Assert.NotNull(page);
        return page.Items.Length;
    }

    private async Task InsertTransactionAsync(
        Guid accountId,
        string description,
        decimal amount,
        TransactionDirection direction)
    {
        Assert.True(Currency.TryGet("AUD", out var currency));
        Assert.NotNull(currency);
        Assert.True(Transaction.TryCreate(
            accountId,
            new DateOnly(2025, 1, 15),
            description,
            amount,
            direction,
            null,
            currency,
            DateTimeOffset.UtcNow,
            out var transaction));
        Assert.NotNull(transaction);

        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        dbContext.Transactions.Add(transaction);
        await dbContext.SaveChangesAsync();
    }

    private static ImportMapping SignedMapping() =>
        new(
            0,
            1,
            "yyyy-MM-dd",
            ImportAmountMode.Signed,
            SignedAmountColumn: 2,
            IncomingSign: IncomingSign.Positive,
            NumberFormat: "dot-decimal-comma-grouping");

    private sealed record CsrfTokenResponse(string RequestToken);

    private sealed record AccountResponse(Guid Id);

    private sealed record ReviewResponse(
        Guid Id,
        bool DuplicateConfirmationRequired,
        ReviewRowResponse[] Rows);

    private sealed record ReviewRowResponse(
        int SourceRowNumber,
        bool IsPossibleDuplicate);

    private sealed record ConfirmResponse(int ImportedCount);

    private sealed record ProblemResponse(Dictionary<string, string[]>? Errors);

    private sealed record TransactionPage(TransactionResponse[] Items);

    private sealed record TransactionResponse(Guid Id);
}
