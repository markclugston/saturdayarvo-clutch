using System.Net;
using System.Net.Http.Json;
using System.Data.Common;
using System.Text;
using System.Text.Json;
using Clutch.API.Application.Imports;
using Clutch.API.Domain.Imports;
using Clutch.API.Infrastructure.Imports;
using Clutch.API.Infrastructure.Persistence;
using Clutch.API.Tests.Integration.Accounts;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.DependencyInjection;

namespace Clutch.API.Tests.Integration.Imports;

[Collection(SqlServerCollection.Name)]
public sealed class ImportWorkflowTests(SqlServerFixture fixture)
{
    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Owner_can_review_and_confirm_all_valid_transactions()
    {
        using var client = CreateClient();
        await RegisterAndSignInAsync(client);
        await CreateFamilyAsync(client);
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
    public async Task Transaction_pages_cover_tied_dates_without_gaps_or_duplicates()
    {
        using var client = CreateClient();
        await RegisterAndSignInAsync(client);
        await CreateFamilyAsync(client);
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
        await CreateFamilyAsync(client);
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
        await CreateFamilyAsync(client);
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
        await CreateFamilyAsync(client);
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
        await CreateFamilyAsync(client);
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
        Assert.Equal(HttpStatusCode.Conflict, confirmResponse.StatusCode);

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
        await CreateFamilyAsync(owner);
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
            stranger, HttpMethod.Delete, $"/api/accounts/{account.Id}/active-import-review", null);
        Assert.Equal(HttpStatusCode.NotFound, denied.StatusCode);
        using var noCsrf = await owner.DeleteAsync($"/api/accounts/{account.Id}/active-import-review");
        Assert.Equal(HttpStatusCode.BadRequest, noCsrf.StatusCode);

        using var recovery = await SendJsonAsync(
            owner, HttpMethod.Delete, $"/api/accounts/{account.Id}/active-import-review", null);
        Assert.Equal(HttpStatusCode.NoContent, recovery.StatusCode);

        await using (var scope = fixture.Factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            Assert.Equal(ImportReviewState.Cancelled,
                (await db.ImportReviews.SingleAsync(candidate => candidate.Id == review.Id)).State);
            Assert.Equal(0, await db.ImportReviewRows.CountAsync(row => row.ReviewId == review.Id));
            Assert.Null((await db.Accounts.SingleAsync(candidate => candidate.Id == account.Id)).ActiveImportId);
            Assert.Equal(otherReview.Id,
                (await db.Accounts.SingleAsync(candidate => candidate.Id == otherAccount.Id)).ActiveImportId);
            Assert.Equal(1, await db.ImportAuditEvents.CountAsync(
                audit => audit.ReviewId == review.Id && audit.EventCode == "ReviewCancelled"));
            Assert.Equal(0, await db.Transactions.CountAsync(transaction => transaction.AccountId == account.Id));
        }

        using var next = await CreateReviewAsync(owner, account.Id, csv, SignedMapping());
        Assert.Equal(HttpStatusCode.Created, next.StatusCode);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Unrecoverable_confirmation_failure_cancels_the_review_and_releases_the_lease()
    {
        using var client = CreateClient();
        await RegisterAndSignInAsync(client);
        await CreateFamilyAsync(client);
        var account = await CreateAccountAsync(client, "Savings", "AUD");
        const string csv = "Date,Description,Amount\n2025-01-15,Market,12.34";
        using var response = await CreateReviewAsync(client, account.Id, csv, SignedMapping());
        var review = await response.Content.ReadFromJsonAsync<ReviewResponse>();
        Assert.NotNull(review);
        await using (var scope = fixture.Factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.ImportReviewRows.Where(row => row.ReviewId == review.Id).ExecuteDeleteAsync();
        }

        using var confirmation = await SendJsonAsync(
            client, HttpMethod.Post, $"/api/import-reviews/{review.Id}/confirm",
            new { confirmPossibleDuplicates = false });
        Assert.Equal(HttpStatusCode.Conflict, confirmation.StatusCode);
        await using (var scope = fixture.Factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            Assert.Equal(ImportReviewState.Cancelled,
                (await db.ImportReviews.SingleAsync(candidate => candidate.Id == review.Id)).State);
            Assert.Null((await db.Accounts.SingleAsync(candidate => candidate.Id == account.Id)).ActiveImportId);
            Assert.Equal(1, await db.ImportAuditEvents.CountAsync(
                audit => audit.ReviewId == review.Id && audit.EventCode == "ConfirmationFailed"));
        }
        using var retry = await CreateReviewAsync(client, account.Id, csv, SignedMapping());
        Assert.Equal(HttpStatusCode.Created, retry.StatusCode);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Failure_while_persisting_review_rolls_back_the_lease_and_staged_data()
    {
        using var client = CreateClient();
        await RegisterAndSignInAsync(client);
        await CreateFamilyAsync(client);
        var account = await CreateAccountAsync(client, "Savings", "AUD");
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var original = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var ownerId = await original.Families
            .Where(family => family.Id == account.FamilyId)
            .Select(family => family.OwnerUserId)
            .SingleAsync();
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
        await CreateFamilyAsync(client);
        var account = await CreateAccountAsync(client, "Savings", "AUD");
        var leaseId = Guid.NewGuid();
        await using (var scope = fixture.Factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.Accounts.Where(candidate => candidate.Id == account.Id)
                .ExecuteUpdateAsync(setters => setters.SetProperty(candidate => candidate.ActiveImportId, leaseId));
        }

        using var recovery = await SendJsonAsync(
            client, HttpMethod.Delete, $"/api/accounts/{account.Id}/active-import-review", null);
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
        await CreateFamilyAsync(client);
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
        await CreateFamilyAsync(client);
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
        await CreateFamilyAsync(client);
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
            var expiredReview = await dbContext.ImportReviews
                .SingleAsync(candidate => candidate.Id == review.Id);
            Assert.Equal(ImportReviewState.Expired, expiredReview.State);
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
    public async Task Background_cleanup_expires_stale_reviews_and_releases_the_account_lease()
    {
        using var client = CreateClient();
        await RegisterAndSignInAsync(client);
        await CreateFamilyAsync(client);
        var account = await CreateAccountAsync(client, "Savings", "AUD");
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
        var expiredReview = await verifyDbContext.ImportReviews
            .SingleAsync(candidate => candidate.Id == review.Id);
        Assert.Equal(ImportReviewState.Expired, expiredReview.State);
        Assert.Equal(0, await verifyDbContext.ImportReviewRows
            .CountAsync(row => row.ReviewId == review.Id));
        var accountEntity = await verifyDbContext.Accounts
            .SingleAsync(candidate => candidate.Id == account.Id);
        Assert.Null(accountEntity.ActiveImportId);
        Assert.Equal(1, await verifyDbContext.ImportAuditEvents
            .CountAsync(audit => audit.ReviewId == review.Id && audit.EventCode == "ReviewExpired"));
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

    private static async Task CreateFamilyAsync(HttpClient client)
    {
        using var response = await SendJsonAsync(
            client,
            HttpMethod.Post,
            "/api/families",
            content: null);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
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

    private sealed record CsrfTokenResponse(string RequestToken);

    private sealed record AccountResponse(
        Guid Id,
        Guid FamilyId,
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
        bool IsPossibleDuplicate);

    private sealed record ConfirmResponse(int ImportedCount, DateTimeOffset CompletedAtUtc);

    private sealed record TransactionPage(TransactionResponse[] Items, string? NextCursor);

    private sealed record TransactionResponse(
        Guid Id,
        DateOnly TransactionDate,
        string Description,
        string Amount,
        string Direction);
}
