using System.Data.Common;
using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Clutch.API.Api.ProblemDetails;
using Clutch.API.Application.Imports;
using Clutch.API.Domain.Imports;
using Clutch.API.Infrastructure.Imports;
using Clutch.API.Infrastructure.Persistence;
using Clutch.API.Infrastructure.Persistence.Entities;
using Clutch.API.Tests.Integration.Accounts;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Clutch.API.Tests.Integration.Imports;

[Collection(SqlServerCollection.Name)]
public sealed class ImportWorkflowTests(SqlServerFixture fixture)
{
    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Import_confirmation_requests_complete_under_500_milliseconds()
    {
        for (var attempt = 0; attempt < 6; attempt++)
        {
            using var client = CreateClient();
            await RegisterAndSignInAsync(client);
            var account = await CreateAccountAsync(client, "Import timing account", "AUD");
            using var reviewResponse = await CreateReviewAsync(
                client,
                account.Id,
                $"Date,Description,Amount\n2025-01-15,Response time {attempt},12.34",
                SignedMapping());
            Assert.Equal(HttpStatusCode.Created, reviewResponse.StatusCode);
            var review = await reviewResponse.Content.ReadFromJsonAsync<ReviewResponse>();
            Assert.NotNull(review);

            using var tokenResponse = await client.GetAsync("/api/security/csrf-token");
            tokenResponse.EnsureSuccessStatusCode();
            var csrfToken = await tokenResponse.Content.ReadFromJsonAsync<CsrfTokenResponse>();
            Assert.NotNull(csrfToken);
            using var request = new HttpRequestMessage(
                HttpMethod.Post,
                $"/api/import-reviews/{review.Id}/confirm")
            {
                Content = JsonContent.Create(new { confirmPossibleDuplicates = false }),
            };
            request.Headers.Add("X-CSRF-TOKEN", csrfToken.RequestToken);

            var stopwatch = Stopwatch.StartNew();
            using var confirmation = await client.SendAsync(request);
            stopwatch.Stop();
            Assert.Equal(HttpStatusCode.OK, confirmation.StatusCode);

            if (attempt > 0)
            {
                Assert.True(
                    stopwatch.Elapsed < TimeSpan.FromMilliseconds(500),
                    $"Import confirmation {attempt} took {stopwatch.Elapsed.TotalMilliseconds:F1} ms.");
            }
        }
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Owner_can_review_and_confirm_all_valid_transactions()
    {
        using var client = CreateClient();
        await RegisterAndSignInAsync(client);
        var account = await CreateAccountAsync(client, "Daily spending", "AUD");

        using var reviewResponse = await CreateReviewAsync(
            client,
            account.Id,
            "Date,Description,Amount\n2025-01-15,Market,12.34\n2025-01-16,Refund,-5.00",
            SignedMapping());

        Assert.Equal(HttpStatusCode.Created, reviewResponse.StatusCode);
        using var reviewJson = JsonDocument.Parse(await reviewResponse.Content.ReadAsStringAsync());
        Assert.EndsWith("+00:00", reviewJson.RootElement.GetProperty("expiresAtUtc").GetString());
        var review = await reviewResponse.Content.ReadFromJsonAsync<ReviewResponse>();
        Assert.NotNull(review);
        Assert.Equal(2, review.RowCount);
        Assert.Equal("AUD", review.CurrencyCode);
        Assert.Equal("12.34", review.Rows[0].Amount);
        Assert.Equal("Incoming", review.Rows[0].Direction);
        Assert.Equal("Outgoing", review.Rows[1].Direction);

        using var settingsBeforeConfirmation = await client.GetAsync(
            $"/api/accounts/{account.Id}/import-settings");
        Assert.Equal(HttpStatusCode.OK, settingsBeforeConfirmation.StatusCode);
        var emptySettings = await settingsBeforeConfirmation.Content
            .ReadFromJsonAsync<ImportSettingsResponse>();
        Assert.NotNull(emptySettings);
        Assert.Null(emptySettings.Mapping);

        using var confirmResponse = await SendJsonAsync(
            client,
            HttpMethod.Post,
            $"/api/import-reviews/{review.Id}/confirm",
            new { confirmPossibleDuplicates = false });

        Assert.Equal(HttpStatusCode.OK, confirmResponse.StatusCode);
        using var confirmJson = JsonDocument.Parse(await confirmResponse.Content.ReadAsStringAsync());
        Assert.EndsWith("+00:00", confirmJson.RootElement.GetProperty("completedAtUtc").GetString());
        var confirmation = await confirmResponse.Content.ReadFromJsonAsync<ConfirmResponse>();
        Assert.NotNull(confirmation);
        Assert.Equal(2, confirmation.ImportedCount);
        Assert.True(confirmation.SettingsSaved);
        await using (var auditScope = fixture.Factory.Services.CreateAsyncScope())
        {
            var auditDb = auditScope.ServiceProvider.GetRequiredService<AppDbContext>();
            var ownerUserId = await auditDb.Accounts
                .Where(candidate => candidate.Id == account.Id)
                .Select(candidate => candidate.OwnerUserId)
                .SingleAsync();
            var audit = await auditDb.Audits.SingleAsync(candidate =>
                candidate.EventCode == "ImportConfirmed"
                && candidate.OccurredAtUtc == confirmation.CompletedAtUtc);
            Assert.Equal(ownerUserId, audit.ActingUserId);
            Assert.False(string.IsNullOrWhiteSpace(audit.Description));
            Assert.Contains(account.Description, audit.Description, StringComparison.Ordinal);
            Assert.DoesNotContain(account.Id.ToString(), audit.Description, StringComparison.Ordinal);
            Assert.DoesNotContain(review.Id.ToString(), audit.Description, StringComparison.Ordinal);
        }
        await using (var snapshotScope = fixture.Factory.Services.CreateAsyncScope())
        {
            var snapshotDb = snapshotScope.ServiceProvider.GetRequiredService<AppDbContext>();
            Assert.Equal(0, await snapshotDb.ImportReviews.CountAsync(
                candidate => candidate.Id == review.Id));
            Assert.Equal(0, await snapshotDb.ImportReviewRows.CountAsync(
                row => row.ReviewId == review.Id));
            Assert.Null(await snapshotDb.Accounts
                .Where(candidate => candidate.Id == account.Id)
                .Select(candidate => candidate.ActiveImportId)
                .SingleAsync());
        }

        using var savedSettingsResponse = await client.GetAsync(
            $"/api/accounts/{account.Id}/import-settings");
        Assert.Equal(HttpStatusCode.OK, savedSettingsResponse.StatusCode);
        var savedSettings = await savedSettingsResponse.Content
            .ReadFromJsonAsync<ImportSettingsResponse>();
        Assert.NotNull(savedSettings);
        Assert.Equal(SignedMapping(), savedSettings.Mapping);

        using var transactionsResponse = await client.GetAsync(
            $"/api/accounts/{account.Id}/transactions");
        Assert.Equal(HttpStatusCode.OK, transactionsResponse.StatusCode);
        var transactions = await transactionsResponse.Content.ReadFromJsonAsync<TransactionPage>();
        Assert.NotNull(transactions);
        Assert.Equal(2, transactions.Items.Length);

        using var accountResponse = await client.GetAsync($"/api/accounts/{account.Id}");
        using var accountJson = JsonDocument.Parse(await accountResponse.Content.ReadAsStringAsync());
        Assert.EndsWith("+00:00", accountJson.RootElement.GetProperty("lastSuccessfulImportAtUtc").GetString());
        var updatedAccount = await accountResponse.Content.ReadFromJsonAsync<AccountResponse>();
        Assert.NotNull(updatedAccount);
        Assert.NotNull(updatedAccount.LastSuccessfulImportAtUtc);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Balance_column_is_imported_listed_and_saved_with_the_import_settings()
    {
        using var client = CreateClient();
        await RegisterAndSignInAsync(client);
        var account = await CreateAccountAsync(client, "Balance account", "AUD");
        var mapping = SignedMapping() with { BalanceColumn = 3 };

        using var reviewResponse = await CreateReviewAsync(
            client,
            account.Id,
            "Date,Description,Amount,Balance\n2025-01-15,Market,12.34,100.50\n2025-01-16,Refund,5.00,\n2025-01-17,Overdrawn,-3.00,-20.25",
            mapping);
        Assert.Equal(HttpStatusCode.Created, reviewResponse.StatusCode);
        var review = await reviewResponse.Content.ReadFromJsonAsync<ReviewResponse>();
        Assert.NotNull(review);
        Assert.Equal(
            ["100.5", null, "-20.25"],
            review.Rows.OrderBy(row => row.SourceRowNumber).Select(row => row.Balance));

        using var confirmResponse = await SendJsonAsync(
            client,
            HttpMethod.Post,
            $"/api/import-reviews/{review.Id}/confirm",
            new { confirmPossibleDuplicates = false });
        Assert.Equal(HttpStatusCode.OK, confirmResponse.StatusCode);

        using var transactionsResponse = await client.GetAsync(
            $"/api/accounts/{account.Id}/transactions");
        var page = await transactionsResponse.Content.ReadFromJsonAsync<TransactionPage>();
        Assert.NotNull(page);
        var balances = page.Items.ToDictionary(item => item.Description, item => item.Balance);
        Assert.Equal("100.5", balances["Market"]);
        Assert.Null(balances["Refund"]);
        Assert.Equal("-20.25", balances["Overdrawn"]);

        using var settingsResponse = await client.GetAsync(
            $"/api/accounts/{account.Id}/import-settings");
        var settings = await settingsResponse.Content.ReadFromJsonAsync<ImportSettingsResponse>();
        Assert.NotNull(settings);
        Assert.Equal(3, settings.Mapping?.BalanceColumn);

        var noBalanceAccount = await CreateAccountAsync(client, "No balance account", "AUD");
        using var plainReview = await CreateReviewAsync(
            client,
            noBalanceAccount.Id,
            "Date,Description,Amount\n2025-01-15,Market,12.34",
            SignedMapping());
        var plain = await plainReview.Content.ReadFromJsonAsync<ReviewResponse>();
        Assert.NotNull(plain);
        using var plainConfirm = await SendJsonAsync(
            client,
            HttpMethod.Post,
            $"/api/import-reviews/{plain.Id}/confirm",
            new { confirmPossibleDuplicates = false });
        Assert.Equal(HttpStatusCode.OK, plainConfirm.StatusCode);
        using var plainList = await client.GetAsync($"/api/accounts/{noBalanceAccount.Id}/transactions");
        var plainPage = await plainList.Content.ReadFromJsonAsync<TransactionPage>();
        Assert.NotNull(plainPage);
        Assert.Null(Assert.Single(plainPage.Items).Balance);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Transaction_pages_cover_tied_dates_without_gaps_or_duplicates()
    {
        using var client = CreateClient();
        await RegisterAndSignInAsync(client);
        var account = await CreateAccountAsync(client, "Paging account", "AUD");
        const string csv = "Date,Description,Amount\n"
            + "2025-01-15,Market 1,1.00\n"
            + "2025-01-15,Market 2,2.00\n"
            + "2025-01-15,Market 3,3.00\n"
            + "2025-01-15,Market 4,4.00\n"
            + "2025-01-15,Market 5,5.00\n"
            + "2025-01-16,Market 6,6.00";

        using var reviewResponse = await CreateReviewAsync(client, account.Id, csv, SignedMapping());
        Assert.Equal(HttpStatusCode.Created, reviewResponse.StatusCode);
        var review = await reviewResponse.Content.ReadFromJsonAsync<ReviewResponse>();
        Assert.NotNull(review);
        using var confirmationResponse = await SendJsonAsync(
            client,
            HttpMethod.Post,
            $"/api/import-reviews/{review.Id}/confirm",
            new { confirmPossibleDuplicates = false });
        Assert.Equal(HttpStatusCode.OK, confirmationResponse.StatusCode);

        var items = new List<TransactionResponse>();
        string? cursor = null;
        do
        {
            var path = $"/api/accounts/{account.Id}/transactions?pageSize=2";
            if (cursor is not null)
            {
                path += $"&cursor={Uri.EscapeDataString(cursor)}";
            }

            using var pageResponse = await client.GetAsync(path);
            Assert.Equal(HttpStatusCode.OK, pageResponse.StatusCode);
            var page = await pageResponse.Content.ReadFromJsonAsync<TransactionPage>();
            Assert.NotNull(page);
            Assert.InRange(page.Items.Length, 1, 2);
            items.AddRange(page.Items);
            cursor = page.NextCursor;
        }
        while (cursor is not null);

        Assert.Equal(6, items.Count);
        Assert.Equal(6, items.Select(item => item.Id).Distinct().Count());
        Assert.Equal(
            ["Market 1", "Market 2", "Market 3", "Market 4", "Market 5", "Market 6"],
            items.Select(item => item.Description).OrderBy(description => description));
        Assert.Equal(
            new[] { new DateOnly(2025, 1, 16) }
                .Concat(Enumerable.Repeat(new DateOnly(2025, 1, 15), 5)),
            items.Select(item => item.TransactionDate));
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Merchant_reference_is_preserved_in_review_and_saved_transaction()
    {
        using var client = CreateClient();
        await RegisterAndSignInAsync(client);
        var account = await CreateAccountAsync(client, "Savings", "AUD");
        const string description = "Merchant 4029357700 AUS";
        using var response = await CreateReviewAsync(
            client,
            account.Id,
            $"Date,Description,Amount\n2025-01-15,{description},10.60",
            SignedMapping());
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var review = await response.Content.ReadFromJsonAsync<ReviewResponse>();
        Assert.NotNull(review);
        Assert.Equal(description, Assert.Single(review.Rows).Description);

        using var confirmation = await SendJsonAsync(
            client,
            HttpMethod.Post,
            $"/api/import-reviews/{review.Id}/confirm",
            new { confirmPossibleDuplicates = false });
        Assert.Equal(HttpStatusCode.OK, confirmation.StatusCode);

        using var transactionsResponse = await client.GetAsync($"/api/accounts/{account.Id}/transactions");
        Assert.Equal(HttpStatusCode.OK, transactionsResponse.StatusCode);
        var transactions = await transactionsResponse.Content.ReadFromJsonAsync<TransactionPage>();
        Assert.NotNull(transactions);
        Assert.Equal(description, Assert.Single(transactions.Items).Description);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Separate_amount_columns_import_negative_values_using_the_column_direction()
    {
        using var client = CreateClient();
        await RegisterAndSignInAsync(client);
        var account = await CreateAccountAsync(client, "Daily spending", "AUD");
        var mapping = new ImportMapping(
            0,
            1,
            "yyyy-MM-dd",
            ImportAmountMode.SeparateIncomingOutgoing,
            IncomingAmountColumn: 2,
            OutgoingAmountColumn: 3,
            NumberFormat: "dot-decimal-comma-grouping");
        const string csv = "Date,Description,Credit,Debit\n"
            + "2025-01-15,Refund,-150.00,\n"
            + "2025-01-16,Payment,,-10.60\n"
            + "2025-01-17,Salary,200.00,\n"
            + "2025-01-18,Purchase,,100.00";

        using var response = await CreateReviewAsync(client, account.Id, csv, mapping);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var review = await response.Content.ReadFromJsonAsync<ReviewResponse>();
        Assert.NotNull(review);
        Assert.Equal(
            [("150", "Incoming"), ("10.6", "Outgoing"), ("200", "Incoming"), ("100", "Outgoing")],
            review.Rows.Select(row => (row.Amount, row.Direction)));

        using var confirmation = await SendJsonAsync(
            client,
            HttpMethod.Post,
            $"/api/import-reviews/{review.Id}/confirm",
            new { confirmPossibleDuplicates = false });
        Assert.Equal(HttpStatusCode.OK, confirmation.StatusCode);
        using var transactionsResponse = await client.GetAsync($"/api/accounts/{account.Id}/transactions");
        var transactions = await transactionsResponse.Content.ReadFromJsonAsync<TransactionPage>();
        Assert.NotNull(transactions);
        Assert.Equal(
            [("100", "Outgoing"), ("200", "Incoming"), ("10.6", "Outgoing"), ("150", "Incoming")],
            transactions.Items.Select(row => (row.Amount, row.Direction)));
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Zero_amount_transactions_can_be_reviewed_and_imported()
    {
        using var client = CreateClient();
        await RegisterAndSignInAsync(client);
        var account = await CreateAccountAsync(client, "Savings", "AUD");
        var mapping = new ImportMapping(
            0, 1, "yyyy-MM-dd", ImportAmountMode.SeparateIncomingOutgoing,
            IncomingAmountColumn: 2, OutgoingAmountColumn: 3,
            NumberFormat: "dot-decimal-comma-grouping");
        const string csv = "Date,Description,Credit,Debit\n"
            + "2025-01-15,Zero incoming,0.00,\n"
            + "2025-01-16,Zero outgoing,,0.00\n"
            + "2025-01-17,Ambiguous zero,0.00,0.00";
        using var response = await CreateReviewAsync(client, account.Id, csv, mapping);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var review = await response.Content.ReadFromJsonAsync<ReviewResponse>();
        Assert.NotNull(review);
        Assert.Equal(
            [("0", "Incoming"), ("0", "Outgoing"), ("0", "Outgoing")],
            review.Rows.Select(row => (row.Amount, row.Direction)));
        using var confirmation = await SendJsonAsync(
            client, HttpMethod.Post, $"/api/import-reviews/{review.Id}/confirm",
            new { confirmPossibleDuplicates = false });
        Assert.Equal(HttpStatusCode.OK, confirmation.StatusCode);
        using var transactionResponse = await client.GetAsync($"/api/accounts/{account.Id}/transactions");
        var transactions = await transactionResponse.Content.ReadFromJsonAsync<TransactionPage>();
        Assert.NotNull(transactions);
        Assert.Equal(3, transactions.Items.Length);
        Assert.All(transactions.Items, row => Assert.Equal("0", row.Amount));
        Assert.Equal("Incoming", transactions.Items.Single(row => row.Description == "Zero incoming").Direction);
        Assert.Equal("Outgoing", transactions.Items.Single(row => row.Description == "Zero outgoing").Direction);
        Assert.Equal("Outgoing", transactions.Items.Single(row => row.Description == "Ambiguous zero").Direction);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Cancellation_and_validation_failure_leave_transactions_unchanged_and_release_lease()
    {
        using var client = CreateClient();
        await RegisterAndSignInAsync(client);
        var account = await CreateAccountAsync(client, "Savings", "AUD");

        using var invalidResponse = await CreateReviewAsync(
            client,
            account.Id,
            "Date,Description,Amount\n2025-01-15,Market,12.34\n2025-01-16,Account 1234567890,5.00",
            SignedMapping());
        Assert.Equal(HttpStatusCode.BadRequest, invalidResponse.StatusCode);
        var invalidBody = await invalidResponse.Content.ReadAsStringAsync();
        Assert.DoesNotContain("1234567890", invalidBody, StringComparison.Ordinal);

        const string cardPattern = "4000 0000 0000 0000";
        using var cardResponse = await CreateReviewAsync(
            client,
            account.Id,
            $"Date,Description,Amount\n2025-01-15,Payment {cardPattern},12.34",
            SignedMapping());
        Assert.Equal(HttpStatusCode.BadRequest, cardResponse.StatusCode);
        Assert.DoesNotContain(
            cardPattern,
            await cardResponse.Content.ReadAsStringAsync(),
            StringComparison.Ordinal);

        using var reviewResponse = await CreateReviewAsync(
            client,
            account.Id,
            "Date,Description,Amount\n2025-01-15,Market,12.34",
            SignedMapping());
        Assert.Equal(HttpStatusCode.Created, reviewResponse.StatusCode);
        var review = await reviewResponse.Content.ReadFromJsonAsync<ReviewResponse>();
        Assert.NotNull(review);

        using var cancelResponse = await SendJsonAsync(
            client,
            HttpMethod.Delete,
            $"/api/import-reviews/{review.Id}",
            content: null);
        Assert.Equal(HttpStatusCode.NoContent, cancelResponse.StatusCode);

        using var confirmResponse = await SendJsonAsync(
            client,
            HttpMethod.Post,
            $"/api/import-reviews/{review.Id}/confirm",
            new { confirmPossibleDuplicates = false });
        Assert.Equal(HttpStatusCode.NotFound, confirmResponse.StatusCode);

        using var transactionsResponse = await client.GetAsync(
            $"/api/accounts/{account.Id}/transactions");
        var transactions = await transactionsResponse.Content.ReadFromJsonAsync<TransactionPage>();
        Assert.NotNull(transactions);
        Assert.Empty(transactions.Items);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Owner_can_discard_an_interrupted_review_without_affecting_transactions_or_other_accounts()
    {
        using var owner = CreateClient();
        await RegisterAndSignInAsync(owner);
        var account = await CreateAccountAsync(owner, "Savings", "AUD");
        var otherAccount = await CreateAccountAsync(owner, "Other", "AUD");
        const string csv = "Date,Description,Amount\n2025-01-15,Market,12.34";
        using var response = await CreateReviewAsync(owner, account.Id, csv, SignedMapping());
        var review = await response.Content.ReadFromJsonAsync<ReviewResponse>();
        Assert.NotNull(review);
        using var otherResponse = await CreateReviewAsync(owner, otherAccount.Id, csv, SignedMapping());
        var otherReview = await otherResponse.Content.ReadFromJsonAsync<ReviewResponse>();
        Assert.NotNull(otherReview);
        using var conflict = await CreateReviewAsync(owner, account.Id, csv, SignedMapping());
        Assert.Equal(HttpStatusCode.Conflict, conflict.StatusCode);

        using var stranger = CreateClient();
        await RegisterAndSignInAsync(stranger);
        using var denied = await SendJsonAsync(
            stranger,
            HttpMethod.Delete,
            $"/api/accounts/{account.Id}/active-import-review?reviewId={review.Id}",
            null);
        Assert.Equal(HttpStatusCode.NotFound, denied.StatusCode);
        using var noCsrf = await owner.DeleteAsync(
            $"/api/accounts/{account.Id}/active-import-review?reviewId={review.Id}");
        Assert.Equal(HttpStatusCode.BadRequest, noCsrf.StatusCode);

        using var recovery = await SendJsonAsync(
            owner,
            HttpMethod.Delete,
            $"/api/accounts/{account.Id}/active-import-review?reviewId={review.Id}",
            null);
        Assert.Equal(HttpStatusCode.NoContent, recovery.StatusCode);

        await using (var scope = fixture.Factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var ended = await db.ImportReviews.SingleAsync(candidate => candidate.Id == review.Id);
            Assert.Equal(ImportReviewState.Cancelled, ended.State);
            Assert.NotNull(ended.EndedAtUtc);
            Assert.Equal(0, await db.ImportReviewRows.CountAsync(row => row.ReviewId == review.Id));
            Assert.Null((await db.Accounts.SingleAsync(candidate => candidate.Id == account.Id)).ActiveImportId);
            Assert.Equal(otherReview.Id,
                (await db.Accounts.SingleAsync(candidate => candidate.Id == otherAccount.Id)).ActiveImportId);
            var ownerUserId = await db.Accounts
                .Where(candidate => candidate.Id == account.Id)
                .Select(candidate => candidate.OwnerUserId)
                .SingleAsync();
            Assert.Equal(1, await db.Audits.CountAsync(
                audit => audit.EventCode == "ReviewEndedElsewhere"
                    && audit.ActingUserId == ownerUserId
                    && audit.Description.Contains(account.Description)));
            Assert.Equal(0, await db.Transactions.CountAsync(transaction => transaction.AccountId == account.Id));
        }

        using var next = await CreateReviewAsync(owner, account.Id, csv, SignedMapping());
        Assert.Equal(HttpStatusCode.Created, next.StatusCode);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Cancelling_a_review_that_is_no_longer_ready_does_not_release_a_stale_lease()
    {
        using var owner = CreateClient();
        await RegisterAndSignInAsync(owner);
        var account = await CreateAccountAsync(owner, "Savings", "AUD");
        const string csv = "Date,Description,Amount\n2025-01-15,Market,12.34";
        using var response = await CreateReviewAsync(owner, account.Id, csv, SignedMapping());
        var review = await response.Content.ReadFromJsonAsync<ReviewResponse>();
        Assert.NotNull(review);

        await using (var scope = fixture.Factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.ImportReviews
                .Where(candidate => candidate.Id == review.Id)
                .ExecuteUpdateAsync(setters => setters.SetProperty(
                    candidate => candidate.State, ImportReviewState.Cancelled));
        }

        using var cancel = await SendJsonAsync(
            owner, HttpMethod.Delete, $"/api/import-reviews/{review.Id}", null);
        Assert.Equal(HttpStatusCode.Conflict, cancel.StatusCode);

        await using (var scope = fixture.Factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            Assert.Equal(
                review.Id,
                (await db.Accounts.SingleAsync(candidate => candidate.Id == account.Id)).ActiveImportId);
            Assert.True(await db.ImportReviews.AnyAsync(candidate => candidate.Id == review.Id));
            Assert.True(await db.ImportReviewRows.AnyAsync(row => row.ReviewId == review.Id));
        }

        using var next = await CreateReviewAsync(owner, account.Id, csv, SignedMapping());
        Assert.Equal(HttpStatusCode.Conflict, next.StatusCode);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Another_user_cannot_confirm_or_cancel_an_import_review()
    {
        using var owner = CreateClient();
        await RegisterAndSignInAsync(owner);
        var account = await CreateAccountAsync(owner, "Private review", "AUD");
        using var reviewResponse = await CreateReviewAsync(
            owner,
            account.Id,
            "Date,Description,Amount\n2025-01-15,Private transaction,12.34",
            SignedMapping());
        Assert.Equal(HttpStatusCode.Created, reviewResponse.StatusCode);
        var review = await reviewResponse.Content.ReadFromJsonAsync<ReviewResponse>();
        Assert.NotNull(review);

        using var otherUser = CreateClient();
        await RegisterAndSignInAsync(otherUser);
        using var deniedConfirmation = await SendJsonAsync(
            otherUser,
            HttpMethod.Post,
            $"/api/import-reviews/{review.Id}/confirm",
            new { confirmPossibleDuplicates = false });
        using var deniedCancellation = await SendJsonAsync(
            otherUser,
            HttpMethod.Delete,
            $"/api/import-reviews/{review.Id}",
            content: null);
        Assert.Equal(HttpStatusCode.NotFound, deniedConfirmation.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, deniedCancellation.StatusCode);

        await using var verifyScope = fixture.Factory.Services.CreateAsyncScope();
        var db = verifyScope.ServiceProvider.GetRequiredService<AppDbContext>();
        var persistedReview = await db.ImportReviews
            .AsNoTracking()
            .SingleAsync(candidate => candidate.Id == review.Id);
        Assert.Equal(ImportReviewState.Ready, persistedReview.State);
        Assert.Equal(review.Id, (await db.Accounts
            .AsNoTracking()
            .SingleAsync(candidate => candidate.Id == account.Id))
            .ActiveImportId);
        Assert.Single(await db.ImportReviewRows
            .AsNoTracking()
            .Where(row => row.ReviewId == review.Id)
            .ToListAsync());
        Assert.Equal(0, await db.Transactions
            .CountAsync(transaction => transaction.AccountId == account.Id));
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    [Trait("Category", "SqlServer")]
    public async Task Missing_staged_data_cancels_the_review_and_releases_the_lease(bool removeMapping)
    {
        using var client = CreateClient();
        await RegisterAndSignInAsync(client);
        var account = await CreateAccountAsync(client, "Savings", "AUD");
        const string csv = "Date,Description,Amount\n2025-01-15,Market,12.34";
        using var response = await CreateReviewAsync(client, account.Id, csv, SignedMapping());
        var review = await response.Content.ReadFromJsonAsync<ReviewResponse>();
        Assert.NotNull(review);
        await using (var scope = fixture.Factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            if (removeMapping)
            {
                await db.ImportReviews.Where(candidate => candidate.Id == review.Id)
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(candidate => candidate.SchemaVersion, (int?)null)
                        .SetProperty(candidate => candidate.MappingJson, (string?)null));
            }
            else
            {
                await db.ImportReviewRows.Where(row => row.ReviewId == review.Id).ExecuteDeleteAsync();
            }
        }

        using var confirmation = await SendJsonAsync(
            client, HttpMethod.Post, $"/api/import-reviews/{review.Id}/confirm",
            new { confirmPossibleDuplicates = false });
        Assert.Equal(HttpStatusCode.Conflict, confirmation.StatusCode);
        await using (var scope = fixture.Factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            Assert.Equal(0, await db.ImportReviews.CountAsync(candidate => candidate.Id == review.Id));
            Assert.Equal(0, await db.ImportReviewRows.CountAsync(row => row.ReviewId == review.Id));
            Assert.Null((await db.Accounts.SingleAsync(candidate => candidate.Id == account.Id)).ActiveImportId);
            Assert.Equal(0, await db.Transactions.CountAsync(candidate => candidate.AccountId == account.Id));
            var ownerUserId = await db.Accounts
                .Where(candidate => candidate.Id == account.Id)
                .Select(candidate => candidate.OwnerUserId)
                .SingleAsync();
            Assert.Equal(1, await db.Audits.CountAsync(
                audit => audit.EventCode == "ConfirmationFailed"
                    && audit.ActingUserId == ownerUserId
                    && audit.Description.Contains(account.Description)));
        }
        using var retry = await CreateReviewAsync(client, account.Id, csv, SignedMapping());
        Assert.Equal(HttpStatusCode.Created, retry.StatusCode);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Cancellation_failure_rolls_back_cleanup_and_can_be_retried()
    {
        using var client = CreateClient();
        await RegisterAndSignInAsync(client);
        var account = await CreateAccountAsync(client, "Cancellation failure", "AUD");
        using var response = await CreateReviewAsync(
            client,
            account.Id,
            "Date,Description,Amount\n2025-01-15,Market,12.34",
            SignedMapping());
        var review = await response.Content.ReadFromJsonAsync<ReviewResponse>();
        Assert.NotNull(review);

        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var original = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var ownerId = await original.Accounts.Where(candidate => candidate.Id == account.Id)
            .Select(candidate => candidate.OwnerUserId).SingleAsync()
            ?? throw new InvalidOperationException("The account must have an owner.");
        var interceptor = new FailAuditInsertInterceptor();
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlServer(original.Database.GetConnectionString())
            .AddInterceptors(interceptor)
            .Options;
        await using var db = new AppDbContext(options);
        var clock = TimeProvider.System;
        var service = new ImportReviewService(
            db, new CsvImportParser(), new AccountImportLease(db),
            new ImportAuditWriter(db, clock), new AllowImportAttempts(), clock);

        await Assert.ThrowsAsync<DbUpdateException>(
            () => service.CancelAsync(ownerId, review.Id, CancellationToken.None));
        Assert.True(interceptor.Triggered);
        Assert.True(await original.ImportReviews.AnyAsync(candidate => candidate.Id == review.Id));
        Assert.True(await original.ImportReviewRows.AnyAsync(row => row.ReviewId == review.Id));
        Assert.NotNull(await original.ImportReviews.Where(candidate => candidate.Id == review.Id)
            .Select(candidate => candidate.MappingJson).SingleAsync());
        Assert.Equal(review.Id, await original.Accounts.Where(candidate => candidate.Id == account.Id)
            .Select(candidate => candidate.ActiveImportId).SingleAsync());

        using var retry = await SendJsonAsync(
            client, HttpMethod.Delete, $"/api/import-reviews/{review.Id}", null);
        Assert.Equal(HttpStatusCode.NoContent, retry.StatusCode);
        Assert.False(await original.ImportReviews.AnyAsync(candidate => candidate.Id == review.Id));
        Assert.False(await original.ImportReviewRows.AnyAsync(row => row.ReviewId == review.Id));
        Assert.Null(await original.Accounts.Where(candidate => candidate.Id == account.Id)
            .Select(candidate => candidate.ActiveImportId).SingleAsync());
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Failure_while_persisting_review_rolls_back_the_lease_and_staged_data()
    {
        using var client = CreateClient();
        await RegisterAndSignInAsync(client);
        var account = await CreateAccountAsync(client, "Savings", "AUD");
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var original = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var ownerId = await original.Accounts
            .Where(candidate => candidate.Id == account.Id)
            .Select(candidate => candidate.OwnerUserId)
            .SingleAsync() ?? throw new InvalidOperationException("The account must have an owner.");
        var interceptor = new FailReviewInsertInterceptor();
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlServer(original.Database.GetConnectionString())
            .AddInterceptors(interceptor)
            .Options;
        await using var db = new AppDbContext(options);
        var clock = TimeProvider.System;
        var service = new ImportReviewService(
            db, new CsvImportParser(), new AccountImportLease(db),
            new ImportAuditWriter(db, clock), new AllowImportAttempts(), clock);
        var bytes = Encoding.UTF8.GetBytes("Date,Description,Amount\n2025-01-15,Market,12.34");
        await using var file = new MemoryStream(bytes);

        await Assert.ThrowsAnyAsync<Exception>(() => service.CreateAsync(
            ownerId, account.Id, file, bytes.Length, SignedMapping(), CancellationToken.None));
        Assert.True(interceptor.Triggered);
        Assert.Null((await original.Accounts.AsNoTracking().SingleAsync(candidate => candidate.Id == account.Id))
            .ActiveImportId);
        Assert.Equal(0, await original.ImportReviews.CountAsync(review => review.AccountId == account.Id));
        Assert.Equal(0, await original.Transactions.CountAsync(transaction => transaction.AccountId == account.Id));
        using var retry = await CreateReviewAsync(
            client, account.Id, "Date,Description,Amount\n2025-01-15,Market,12.34", SignedMapping());
        Assert.Equal(HttpStatusCode.Created, retry.StatusCode);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Recovery_does_not_release_a_lease_without_a_ready_review()
    {
        using var client = CreateClient();
        await RegisterAndSignInAsync(client);
        var account = await CreateAccountAsync(client, "Savings", "AUD");
        var leaseId = Guid.NewGuid();
        await using (var scope = fixture.Factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.Accounts.Where(candidate => candidate.Id == account.Id)
                .ExecuteUpdateAsync(setters => setters.SetProperty(candidate => candidate.ActiveImportId, leaseId));
        }

        using var recovery = await SendJsonAsync(
            client,
            HttpMethod.Delete,
            $"/api/accounts/{account.Id}/active-import-review?reviewId={leaseId}",
            null);
        Assert.Equal(HttpStatusCode.Conflict, recovery.StatusCode);
        using var attempt = await CreateReviewAsync(
            client, account.Id, "Date,Description,Amount\n2025-01-15,Market,12.34", SignedMapping());
        Assert.Equal(HttpStatusCode.Conflict, attempt.StatusCode);
        await using var verify = fixture.Factory.Services.CreateAsyncScope();
        var dbContext = verify.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(leaseId,
            (await dbContext.Accounts.SingleAsync(candidate => candidate.Id == account.Id)).ActiveImportId);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Currency_format_and_direction_mappings_are_validated_before_review()
    {
        using var client = CreateClient();
        await RegisterAndSignInAsync(client);
        var account = await CreateAccountAsync(client, "European account", "EUR");
        var mapping = new ImportMapping(
            0,
            1,
            "yyyy-MM-dd",
            ImportAmountMode.AmountWithDirection,
            AmountColumn: 2,
            DirectionColumn: 3,
            IncomingDirectionValue: "CREDIT",
            OutgoingDirectionValue: "DEBIT",
            NumberFormat: "comma-decimal-dot-grouping");

        using var reviewResponse = await CreateReviewAsync(
            client,
            account.Id,
            "Date,Description,Amount,Type\n2025-01-15,Refund,\"1.234,56\",CREDIT",
            mapping);

        Assert.Equal(HttpStatusCode.Created, reviewResponse.StatusCode);
        var review = await reviewResponse.Content.ReadFromJsonAsync<ReviewResponse>();
        Assert.NotNull(review);
        Assert.Equal("1234.56", Assert.Single(review.Rows).Amount);
        Assert.Equal("Incoming", review.Rows[0].Direction);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Empty_and_malformed_files_are_rejected_without_persisting_reviews()
    {
        using var client = CreateClient();
        await RegisterAndSignInAsync(client);
        var account = await CreateAccountAsync(client, "Savings", "AUD");

        foreach (var csv in new[] { string.Empty, "Date,Description,Amount\n2025-01-15,\"unfinished,12.34" })
        {
            using var response = await CreateReviewAsync(client, account.Id, csv, SignedMapping());
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(0, await dbContext.ImportReviews
            .CountAsync(review => review.AccountId == account.Id));
        Assert.Null(await dbContext.Accounts.Where(candidate => candidate.Id == account.Id)
            .Select(candidate => candidate.ActiveImportId).SingleAsync());
        Assert.Equal(0, await dbContext.ImportReviewRows
            .CountAsync(row => dbContext.ImportReviews.Any(review =>
                review.Id == row.ReviewId && review.AccountId == account.Id)));
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Expired_review_is_terminal_clears_rows_and_releases_the_account_lease()
    {
        using var client = CreateClient();
        await RegisterAndSignInAsync(client);
        var account = await CreateAccountAsync(client, "Savings", "AUD");
        using var reviewResponse = await CreateReviewAsync(
            client,
            account.Id,
            "Date,Description,Amount\n2025-01-15,Market,12.34",
            SignedMapping());
        Assert.Equal(HttpStatusCode.Created, reviewResponse.StatusCode);
        var review = await reviewResponse.Content.ReadFromJsonAsync<ReviewResponse>();
        Assert.NotNull(review);

        await using (var scope = fixture.Factory.Services.CreateAsyncScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await dbContext.ImportReviews
                .Where(candidate => candidate.Id == review.Id)
                .ExecuteUpdateAsync(setters => setters.SetProperty(
                    candidate => candidate.ExpiresAtUtc,
                    DateTimeOffset.UtcNow.AddMinutes(-1)));
        }

        using var expiredResponse = await SendJsonAsync(
            client,
            HttpMethod.Post,
            $"/api/import-reviews/{review.Id}/confirm",
            new { confirmPossibleDuplicates = false });
        Assert.Equal(HttpStatusCode.Conflict, expiredResponse.StatusCode);

        await using (var scope = fixture.Factory.Services.CreateAsyncScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            Assert.Equal(0, await dbContext.ImportReviews.CountAsync(
                candidate => candidate.Id == review.Id));
            Assert.Equal(0, await dbContext.ImportReviewRows
                .CountAsync(row => row.ReviewId == review.Id));
            var accountEntity = await dbContext.Accounts.SingleAsync(
                candidate => candidate.Id == account.Id);
            Assert.Null(accountEntity.ActiveImportId);
        }

        using var nextReview = await CreateReviewAsync(
            client,
            account.Id,
            "Date,Description,Amount\n2025-01-16,Groceries,8.00",
            SignedMapping());
        Assert.Equal(HttpStatusCode.Created, nextReview.StatusCode);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Confirmation_commits_processing_claim_before_it_can_be_cancelled_or_written()
    {
        using var client = CreateClient();
        await RegisterAndSignInAsync(client);
        var account = await CreateAccountAsync(client, "Claim barrier", "AUD");
        using var response = await CreateReviewAsync(
            client,
            account.Id,
            "Date,Description,Amount\n2025-01-15,Claim barrier transaction,12.34",
            SignedMapping());
        var review = await response.Content.ReadFromJsonAsync<ReviewResponse>();
        Assert.NotNull(review);
        string ownerUserId;
        await using (var ownerScope = fixture.Factory.Services.CreateAsyncScope())
        {
            var ownerDb = ownerScope.ServiceProvider.GetRequiredService<AppDbContext>();
            ownerUserId = await ownerDb.Accounts
                .Where(candidate => candidate.Id == account.Id)
                .Select(candidate => candidate.OwnerUserId)
                .SingleAsync() ?? throw new InvalidOperationException("The account must have an owner.");
        }

        var barrier = new SecondReviewUpdateBarrier();
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlServer(fixture.ConnectionString)
            .AddInterceptors(barrier)
            .Options;
        await using var db = new AppDbContext(options);
        var clock = TimeProvider.System;
        var auditWriter = new ImportAuditWriter(db, clock);
        var reviewService = new ImportReviewService(
            db,
            new CsvImportParser(),
            new AccountImportLease(db),
            auditWriter,
            new AllowImportAttempts(),
            clock);
        var stateService = new ImportStateService(
            db,
            clock,
            fixture.Factory.Services.GetRequiredService<ILogger<ImportStateService>>());
        var confirmService = new ConfirmImportService(
            db,
            auditWriter,
            reviewService,
            stateService,
            new AccountImportSettingsService(
                db,
                clock,
                fixture.Factory.Services.GetRequiredService<ILogger<AccountImportSettingsService>>()),
            clock);

        var confirmationTask = confirmService.ConfirmAsync(
            ownerUserId,
            review.Id,
            confirmPossibleDuplicates: false,
            CancellationToken.None);
        await barrier.SecondUpdateStarted.Task.WaitAsync(TimeSpan.FromSeconds(5));

        await using (var verifyScope = fixture.Factory.Services.CreateAsyncScope())
        {
            var verifyDb = verifyScope.ServiceProvider.GetRequiredService<AppDbContext>();
            var claimed = await verifyDb.ImportReviews.AsNoTracking()
                .SingleAsync(candidate => candidate.Id == review.Id);
            Assert.Equal(ImportReviewState.Processing, claimed.State);
            Assert.NotNull(claimed.ConfirmationAttemptId);
            Assert.NotNull(claimed.ProcessingStartedAtUtc);
            Assert.Single(await verifyDb.ImportReviewRows
                .Where(row => row.ReviewId == review.Id)
                .ToListAsync());
        }

        using var rejectedCancel = await SendJsonAsync(
            client,
            HttpMethod.Delete,
            $"/api/import-reviews/{review.Id}",
            content: null);
        Assert.Equal(HttpStatusCode.Conflict, rejectedCancel.StatusCode);

        barrier.Continue();
        var confirmation = await confirmationTask.WaitAsync(TimeSpan.FromSeconds(10));
        Assert.Equal(1, confirmation.ImportedCount);
        await using var completedScope = fixture.Factory.Services.CreateAsyncScope();
        var completedDb = completedScope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(1, await completedDb.Transactions.CountAsync(
            candidate => candidate.AccountId == account.Id));
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Lost_commit_acknowledgement_is_reported_as_unknown_without_replaying_financial_writes()
    {
        using var client = CreateClient();
        await RegisterAndSignInAsync(client);
        var account = await CreateAccountAsync(client, "Unknown commit", "AUD");
        using var response = await CreateReviewAsync(
            client,
            account.Id,
            "Date,Description,Amount\n2025-01-15,Unknown commit transaction,12.34",
            SignedMapping());
        var review = await response.Content.ReadFromJsonAsync<ReviewResponse>();
        Assert.NotNull(review);
        var ownerUserId = await GetOwnerUserIdAsync(account.Id);
        var commitInterceptor = new LostCommitAcknowledgementInterceptor();
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlServer(fixture.ConnectionString)
            .AddInterceptors(commitInterceptor)
            .Options;
        await using var db = new AppDbContext(options);
        var clock = TimeProvider.System;
        var auditWriter = new ImportAuditWriter(db, clock);
        var reviewService = new ImportReviewService(
            db,
            new CsvImportParser(),
            new AccountImportLease(db),
            auditWriter,
            new AllowImportAttempts(),
            clock);
        var confirmService = new ConfirmImportService(
            db,
            auditWriter,
            reviewService,
            new ImportStateService(
                db,
                clock,
                fixture.Factory.Services.GetRequiredService<ILogger<ImportStateService>>()),
            new AccountImportSettingsService(
                db,
                clock,
                fixture.Factory.Services.GetRequiredService<ILogger<AccountImportSettingsService>>()),
            clock);

        var problem = await Assert.ThrowsAsync<ApiProblemException>(() => confirmService.ConfirmAsync(
            ownerUserId,
            review.Id,
            confirmPossibleDuplicates: false,
            CancellationToken.None));

        Assert.Equal(StatusCodes.Status500InternalServerError, problem.StatusCode);
        Assert.Contains("ImportOutcomeUnknown", problem.Errors!["code"]);
        Assert.True(commitInterceptor.Triggered);
        await using var verifyScope = fixture.Factory.Services.CreateAsyncScope();
        var verifyDb = verifyScope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(1, await verifyDb.Transactions.CountAsync(
            candidate => candidate.AccountId == account.Id));
        Assert.False(await verifyDb.ImportReviews.AnyAsync(candidate => candidate.Id == review.Id));
        Assert.Null(await verifyDb.Accounts.Where(candidate => candidate.Id == account.Id)
            .Select(candidate => candidate.ActiveImportId).SingleAsync());
        Assert.Equal(1, await verifyDb.Audits.CountAsync(candidate =>
            candidate.EventCode == "ImportConfirmed"
            && candidate.ActingUserId == ownerUserId
            && candidate.Description.Contains(account.Description)));
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    [Trait("Category", "SqlServer")]
    public async Task Abandoned_claim_recovery_waits_for_the_guarded_write_transaction(bool writeCommits)
    {
        using var client = CreateClient();
        await RegisterAndSignInAsync(client);
        var account = await CreateAccountAsync(client, "Recovery lock", "AUD");
        using var response = await CreateReviewAsync(
            client,
            account.Id,
            "Date,Description,Amount\n2025-01-15,Recovery lock transaction,12.34",
            SignedMapping());
        var review = await response.Content.ReadFromJsonAsync<ReviewResponse>();
        Assert.NotNull(review);

        var now = DateTimeOffset.UtcNow;
        var attemptId = Guid.NewGuid();
        await using (var setupScope = fixture.Factory.Services.CreateAsyncScope())
        {
            var setupDb = setupScope.ServiceProvider.GetRequiredService<AppDbContext>();
            await setupDb.ImportReviews
                .Where(candidate => candidate.Id == review.Id)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(candidate => candidate.State, ImportReviewState.Processing)
                    .SetProperty(candidate => candidate.ConfirmationAttemptId, attemptId)
                    .SetProperty(candidate => candidate.ProcessingStartedAtUtc, now.AddMinutes(-6)));
        }

        var barrier = new ProcessingRecoveryQueryBarrier();
        var recoveryClock = new FixedTimeProvider(now);
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton<TimeProvider>(recoveryClock);
        services.AddDbContext<AppDbContext>(options => options
            .UseSqlServer(fixture.ConnectionString)
            .AddInterceptors(barrier));
        services.AddScoped<ImportAuditWriter>();
        await using var provider = services.BuildServiceProvider();
        var cleanup = new ImportReviewCleanupService(
            provider.GetRequiredService<IServiceScopeFactory>(),
            recoveryClock,
            provider.GetRequiredService<ILogger<ImportReviewCleanupService>>());

        await using var writeDb = new AppDbContext(
            new DbContextOptionsBuilder<AppDbContext>()
                .UseSqlServer(fixture.ConnectionString)
                .Options);
        await using var writeTransaction = await writeDb.Database.BeginTransactionAsync();
        await writeDb.ImportReviews
            .Where(candidate => candidate.Id == review.Id
                && candidate.State == ImportReviewState.Processing
                && candidate.ConfirmationAttemptId == attemptId)
            .ExecuteUpdateAsync(setters => setters.SetProperty(
                candidate => candidate.ConfirmationAttemptId,
                attemptId));

        var cleanupTask = cleanup.RunCleanupOnceAsync(CancellationToken.None);
        await barrier.StaleCandidateQueryStarted.Task.WaitAsync(TimeSpan.FromSeconds(5));
        Assert.False(cleanupTask.IsCompleted);

        if (writeCommits)
        {
            await writeDb.ImportReviews
                .Where(candidate => candidate.Id == review.Id)
                .ExecuteDeleteAsync();
            await writeDb.Accounts
                .Where(candidate => candidate.Id == account.Id && candidate.ActiveImportId == review.Id)
                .ExecuteUpdateAsync(setters => setters.SetProperty(
                    candidate => candidate.ActiveImportId,
                    (Guid?)null));
            await writeTransaction.CommitAsync();
        }
        else
        {
            await writeTransaction.RollbackAsync();
        }

        await cleanupTask.WaitAsync(TimeSpan.FromSeconds(10));
        await using var verifyScope = fixture.Factory.Services.CreateAsyncScope();
        var verifyDb = verifyScope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.False(await verifyDb.ImportReviews.AnyAsync(candidate => candidate.Id == review.Id));
        Assert.Null(await verifyDb.Accounts.Where(candidate => candidate.Id == account.Id)
            .Select(candidate => candidate.ActiveImportId).SingleAsync());
        var ownerUserId = await verifyDb.Accounts
            .Where(candidate => candidate.Id == account.Id)
            .Select(candidate => candidate.OwnerUserId)
            .SingleAsync();
        Assert.Equal(writeCommits ? 0 : 1, await verifyDb.Audits.CountAsync(
            audit => audit.ActingUserId == ownerUserId
                && audit.EventCode == "ConfirmationFailed"
                && audit.Description.Contains(account.Description)));
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Background_cleanup_expires_stale_reviews_and_releases_the_account_lease()
    {
        using var client = CreateClient();
        await RegisterAndSignInAsync(client);
        var account = await CreateAccountAsync(client, "Savings", "AUD");
        var activeAccount = await CreateAccountAsync(client, "Active review", "AUD");
        using var activeResponse = await CreateReviewAsync(
            client,
            activeAccount.Id,
            "Date,Description,Amount\n2025-01-15,Market,12.34",
            SignedMapping());
        Assert.Equal(HttpStatusCode.Created, activeResponse.StatusCode);
        var activeReview = await activeResponse.Content.ReadFromJsonAsync<ReviewResponse>();
        Assert.NotNull(activeReview);
        using var reviewResponse = await CreateReviewAsync(
            client,
            account.Id,
            "Date,Description,Amount\n2025-01-15,Market,12.34",
            SignedMapping());
        var review = await reviewResponse.Content.ReadFromJsonAsync<ReviewResponse>();
        Assert.NotNull(review);

        await using (var scope = fixture.Factory.Services.CreateAsyncScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await dbContext.ImportReviews
                .Where(candidate => candidate.Id == review.Id)
                .ExecuteUpdateAsync(setters => setters.SetProperty(
                    candidate => candidate.ExpiresAtUtc,
                    DateTimeOffset.UtcNow.AddMinutes(-1)));
        }

        var services = fixture.Factory.Services;
        var cleanup = new ImportReviewCleanupService(
            services.GetRequiredService<IServiceScopeFactory>(),
            services.GetRequiredService<TimeProvider>(),
            services.GetRequiredService<ILogger<ImportReviewCleanupService>>());
        await cleanup.RunCleanupOnceAsync(CancellationToken.None);

        await using var verifyScope = services.CreateAsyncScope();
        var verifyDbContext = verifyScope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(0, await verifyDbContext.ImportReviews.CountAsync(
            candidate => candidate.Id == review.Id));
        Assert.Equal(0, await verifyDbContext.ImportReviewRows
            .CountAsync(row => row.ReviewId == review.Id));
        Assert.True(await verifyDbContext.ImportReviews.AnyAsync(
            candidate => candidate.Id == activeReview.Id));
        Assert.True(await verifyDbContext.ImportReviewRows.AnyAsync(
            row => row.ReviewId == activeReview.Id));
        Assert.NotNull(await verifyDbContext.ImportReviews.Where(candidate => candidate.Id == activeReview.Id)
            .Select(candidate => candidate.MappingJson).SingleAsync());
        Assert.Equal(activeReview.Id, await verifyDbContext.Accounts
            .Where(candidate => candidate.Id == activeAccount.Id)
            .Select(candidate => candidate.ActiveImportId)
            .SingleAsync());
        var accountEntity = await verifyDbContext.Accounts
            .SingleAsync(candidate => candidate.Id == account.Id);
        Assert.Null(accountEntity.ActiveImportId);
        var ownerUserId = accountEntity.OwnerUserId;
        Assert.Equal(1, await verifyDbContext.Audits
            .CountAsync(audit => audit.EventCode == "ReviewExpired"
                && audit.ActingUserId == ownerUserId
                && audit.Description.Contains(account.Description)));
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Abandoned_review_is_preserved_until_its_deadline_then_completely_removed()
    {
        using var client = CreateClient();
        await RegisterAndSignInAsync(client);
        var account = await CreateAccountAsync(client, "Abandoned review", "AUD");
        using var response = await CreateReviewAsync(
            client,
            account.Id,
            "Date,Description,Amount\n2025-01-15,Market,12.34",
            SignedMapping());
        var review = await response.Content.ReadFromJsonAsync<ReviewResponse>();
        Assert.NotNull(review);

        var services = fixture.Factory.Services;
        var clock = new FixedTimeProvider(review.ExpiresAtUtc.AddTicks(-1));
        var cleanup = new ImportReviewCleanupService(
            services.GetRequiredService<IServiceScopeFactory>(),
            clock,
            services.GetRequiredService<ILogger<ImportReviewCleanupService>>());
        await cleanup.RunCleanupOnceAsync(CancellationToken.None);

        await using var verifyScope = services.CreateAsyncScope();
        var db = verifyScope.ServiceProvider.GetRequiredService<AppDbContext>();
        var storedReview = await db.ImportReviews.AsNoTracking().SingleAsync(
            candidate => candidate.Id == review.Id);
        Assert.Equal(TimeSpan.FromMinutes(5), storedReview.ExpiresAtUtc - storedReview.CreatedAtUtc);
        Assert.True(await db.ImportReviewRows.AnyAsync(row => row.ReviewId == review.Id));
        Assert.Equal(SignedMapping(), ImportMappingSettingsSerializer.Deserialize(
            storedReview.SchemaVersion!.Value, storedReview.MappingJson!));
        Assert.Equal(review.Id, await db.Accounts.Where(candidate => candidate.Id == account.Id)
            .Select(candidate => candidate.ActiveImportId).SingleAsync());

        clock.UtcNow = review.ExpiresAtUtc;
        await cleanup.RunCleanupOnceAsync(CancellationToken.None);

        Assert.False(await db.ImportReviews.AnyAsync(candidate => candidate.Id == review.Id));
        Assert.False(await db.ImportReviewRows.AnyAsync(row => row.ReviewId == review.Id));
        Assert.Null(await db.Accounts.Where(candidate => candidate.Id == account.Id)
            .Select(candidate => candidate.ActiveImportId).SingleAsync());
        Assert.Equal(0, await db.Transactions.CountAsync(candidate => candidate.AccountId == account.Id));
        Assert.Equal(1, await db.Audits.CountAsync(candidate =>
            candidate.EventCode == "ReviewExpired" && candidate.Description.Contains(account.Description)));
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Background_cleanup_removes_completed_rate_windows_without_a_new_import()
    {
        using var client = CreateClient();
        await RegisterAndSignInAsync(client);
        var account = await CreateAccountAsync(client, "Rate cleanup", "AUD");
        var now = DateTimeOffset.UtcNow.AddMinutes(10);
        var currentWindow = new DateTimeOffset(
            now.Year, now.Month, now.Day, now.Hour, now.Minute, 0, TimeSpan.Zero);
        var expiredWindow = currentWindow.AddMinutes(-1);
        var services = fixture.Factory.Services;
        await using (var scope = services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var ownerId = await db.Accounts.Where(candidate => candidate.Id == account.Id)
                .Select(candidate => candidate.OwnerUserId).SingleAsync()
                ?? throw new InvalidOperationException("The account must have an owner.");
            db.ImportRateWindows.Add(new ImportRateWindow(ownerId, expiredWindow));
            db.ImportRateWindows.Add(new ImportRateWindow(ownerId, currentWindow));
            await db.SaveChangesAsync();
        }

        var cleanup = new ImportReviewCleanupService(
            services.GetRequiredService<IServiceScopeFactory>(),
            new FixedTimeProvider(currentWindow.AddSeconds(30)),
            services.GetRequiredService<ILogger<ImportReviewCleanupService>>());
        await cleanup.RunCleanupOnceAsync(CancellationToken.None);

        await using var verifyScope = services.CreateAsyncScope();
        var verifyDb = verifyScope.ServiceProvider.GetRequiredService<AppDbContext>();
        var ownerUserId = await verifyDb.Accounts.Where(candidate => candidate.Id == account.Id)
            .Select(candidate => candidate.OwnerUserId).SingleAsync();
        var windows = await verifyDb.ImportRateWindows
            .Where(window => window.UserId == ownerUserId)
            .Select(window => window.WindowStartedAtUtc)
            .ToListAsync();
        Assert.Equal(currentWindow, Assert.Single(windows));
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

    private static async Task<AccountResponse> CreateAccountAsync(
        HttpClient client,
        string description,
        string currencyCode)
    {
        using var response = await SendJsonAsync(
            client,
            HttpMethod.Post,
            "/api/accounts",
            new { description, currencyCode });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var account = await response.Content.ReadFromJsonAsync<AccountResponse>();
        Assert.NotNull(account);
        return account;
    }

    private async Task<string> GetOwnerUserIdAsync(Guid accountId)
    {
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await db.Accounts
            .Where(candidate => candidate.Id == accountId)
            .Select(candidate => candidate.OwnerUserId)
            .SingleAsync() ?? throw new InvalidOperationException("The account must have an owner.");
    }

    private static async Task<HttpResponseMessage> CreateReviewAsync(
        HttpClient client,
        Guid accountId,
        string csv,
        ImportMapping mapping)
    {
        using var tokenResponse = await client.GetAsync("/api/security/csrf-token");
        tokenResponse.EnsureSuccessStatusCode();
        var csrfToken = await tokenResponse.Content.ReadFromJsonAsync<CsrfTokenResponse>();
        Assert.NotNull(csrfToken);

        using var content = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(Encoding.UTF8.GetBytes(csv));
        fileContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("text/csv");
        content.Add(fileContent, "file", "transactions.csv");
        content.Add(
            new StringContent(JsonSerializer.Serialize(mapping, new JsonSerializerOptions(
                JsonSerializerDefaults.Web))),
            "mapping");

        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"/api/accounts/{accountId}/import-reviews")
        {
            Content = content,
        };
        request.Headers.Add("X-CSRF-TOKEN", csrfToken.RequestToken);
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
        var csrfToken = await tokenResponse.Content.ReadFromJsonAsync<CsrfTokenResponse>();
        Assert.NotNull(csrfToken);

        using var request = new HttpRequestMessage(method, path)
        {
            Content = content is null ? null : JsonContent.Create(content),
        };
        request.Headers.Add("X-CSRF-TOKEN", csrfToken.RequestToken);
        return await client.SendAsync(request);
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

    private sealed class AllowImportAttempts : IImportAttemptLimiter
    {
        public Task<bool> TryConsumeAsync(
            string userId,
            int maxAttemptsPerUserPerMinute,
            CancellationToken cancellationToken) =>
            Task.FromResult(true);
    }

    private sealed class FixedTimeProvider(DateTimeOffset utcNow) : TimeProvider
    {
        public DateTimeOffset UtcNow { get; set; } = utcNow;

        public override DateTimeOffset GetUtcNow() => UtcNow;
    }

    private sealed class FailReviewInsertInterceptor : DbCommandInterceptor
    {
        public bool Triggered { get; private set; }

        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
            DbCommand command,
            CommandEventData eventData,
            InterceptionResult<DbDataReader> result,
            CancellationToken cancellationToken = default)
        {
            if (command.CommandText.Contains("INSERT INTO [ImportReviews]", StringComparison.Ordinal))
            {
                Triggered = true;
                throw new InvalidOperationException("Simulated review persistence failure.");
            }

            return base.ReaderExecutingAsync(command, eventData, result, cancellationToken);
        }
    }

    private sealed class FailAuditInsertInterceptor : DbCommandInterceptor
    {
        public bool Triggered { get; private set; }

        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
            DbCommand command,
            CommandEventData eventData,
            InterceptionResult<DbDataReader> result,
            CancellationToken cancellationToken = default)
        {
            if (command.CommandText.Contains("INSERT INTO [Audit]", StringComparison.Ordinal))
            {
                Triggered = true;
                throw new DbUpdateException("Simulated audit persistence failure.");
            }

            return base.ReaderExecutingAsync(command, eventData, result, cancellationToken);
        }
    }

    private sealed class SecondReviewUpdateBarrier : DbCommandInterceptor
    {
        private readonly TaskCompletionSource<bool> secondUpdateStarted =
            new(TaskCreationOptions.RunContinuationsAsynchronously);
        private readonly TaskCompletionSource<bool> continueExecution =
            new(TaskCreationOptions.RunContinuationsAsynchronously);
        private int reviewUpdateCount;

        public TaskCompletionSource<bool> SecondUpdateStarted => secondUpdateStarted;

        public void Continue() => continueExecution.TrySetResult(true);

        public override async ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
            DbCommand command,
            CommandEventData eventData,
            InterceptionResult<DbDataReader> result,
            CancellationToken cancellationToken = default)
        {
            await PauseSecondReviewUpdateAsync(command, cancellationToken);
            return result;
        }

        public override async ValueTask<InterceptionResult<int>> NonQueryExecutingAsync(
            DbCommand command,
            CommandEventData eventData,
            InterceptionResult<int> result,
            CancellationToken cancellationToken = default)
        {
            await PauseSecondReviewUpdateAsync(command, cancellationToken);
            return result;
        }

        private async Task PauseSecondReviewUpdateAsync(
            DbCommand command,
            CancellationToken cancellationToken)
        {
            if (!command.CommandText.Contains("UPDATE", StringComparison.OrdinalIgnoreCase)
                || !command.CommandText.Contains("ImportReviews", StringComparison.OrdinalIgnoreCase)
                || Interlocked.Increment(ref reviewUpdateCount) != 2)
            {
                return;
            }

            secondUpdateStarted.TrySetResult(true);
            await continueExecution.Task.WaitAsync(cancellationToken);
        }
    }

    private sealed class ProcessingRecoveryQueryBarrier : DbCommandInterceptor
    {
        public TaskCompletionSource<bool> StaleCandidateQueryStarted { get; } =
            new(TaskCreationOptions.RunContinuationsAsynchronously);

        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
            DbCommand command,
            CommandEventData eventData,
            InterceptionResult<DbDataReader> result,
            CancellationToken cancellationToken = default)
        {
            if (command.CommandText.Contains("SELECT", StringComparison.OrdinalIgnoreCase)
                && command.CommandText.Contains("ImportReviews", StringComparison.OrdinalIgnoreCase)
                && command.CommandText.Contains("ProcessingStartedAtUtc", StringComparison.OrdinalIgnoreCase))
            {
                StaleCandidateQueryStarted.TrySetResult(true);
            }

            return base.ReaderExecutingAsync(command, eventData, result, cancellationToken);
        }
    }

    private sealed class LostCommitAcknowledgementInterceptor : DbTransactionInterceptor
    {
        public bool Triggered { get; private set; }

        public override Task TransactionCommittedAsync(
            DbTransaction transaction,
            TransactionEndEventData eventData,
            CancellationToken cancellationToken = default)
        {
            Triggered = true;
            throw new InvalidOperationException("Simulated lost commit acknowledgement.");
        }
    }

    private sealed record CsrfTokenResponse(string RequestToken);

    private sealed record AccountResponse(
        Guid Id,
        string Description,
        string CurrencyCode,
        DateTimeOffset? LastSuccessfulImportAtUtc);

    private sealed record ReviewResponse(
        Guid Id,
        Guid AccountId,
        string CurrencyCode,
        int RowCount,
        bool DuplicateConfirmationRequired,
        DateTimeOffset ExpiresAtUtc,
        ReviewRowResponse[] Rows);

    private sealed record ReviewRowResponse(
        int SourceRowNumber,
        DateOnly TransactionDate,
        string Description,
        string Amount,
        string Direction,
        bool IsPossibleDuplicate,
        string? Balance = null);

    private sealed record ConfirmResponse(
        int ImportedCount,
        DateTimeOffset CompletedAtUtc,
        bool SettingsSaved);

    private sealed record ImportSettingsResponse(ImportMapping? Mapping);

    private sealed record TransactionPage(TransactionResponse[] Items, string? NextCursor);

    private sealed record TransactionResponse(
        Guid Id,
        DateOnly TransactionDate,
        string Description,
        string Amount,
        string Direction,
        string? Balance = null);
}
