using System.Data.Common;
using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Clutch.API.Api.ProblemDetails;
using Clutch.API.Application.Imports;
using Clutch.API.Domain.Imports;
using Clutch.API.Infrastructure.Imports;
using Clutch.API.Infrastructure.Persistence;
using Clutch.API.Tests.Integration.Accounts;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Clutch.API.Tests.Integration.Imports;

[Collection(SqlServerCollection.Name)]
public sealed class ImportEndingTests(SqlServerFixture fixture)
{
    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Owner_ends_the_exact_preview_and_retains_a_minimal_actor_header()
    {
        using var owner = CreateClient();
        var username = await RegisterAndSignInAsync(owner);
        var account = await CreateAccountAsync(owner, "Exact end");
        using var reviewResponse = await CreateReviewAsync(
            owner,
            account.Id,
            "Date,Description,Amount\n2025-01-15,Private staged ending row,12.34");
        Assert.Equal(HttpStatusCode.Created, reviewResponse.StatusCode);
        var review = await reviewResponse.Content.ReadFromJsonAsync<ReviewResponse>();
        Assert.NotNull(review);
        var ownerUserId = await GetOwnerIdAsync(account.Id);

        using var endedResponse = await DeleteExactAsync(owner, account.Id, review.Id);

        Assert.Equal(HttpStatusCode.NoContent, endedResponse.StatusCode);
        await using var verifyScope = fixture.Factory.Services.CreateAsyncScope();
        var db = verifyScope.ServiceProvider.GetRequiredService<AppDbContext>();
        var ended = await db.ImportReviews.AsNoTracking().SingleAsync(candidate => candidate.Id == review.Id);
        Assert.Equal(ImportReviewState.Cancelled, ended.State);
        Assert.Equal(ownerUserId, ended.EndedByUserId);
        Assert.NotNull(ended.EndedAtUtc);
        Assert.Null(ended.SchemaVersion);
        Assert.Null(ended.MappingJson);
        Assert.Null(ended.ConfirmationAttemptId);
        Assert.Null(ended.ProcessingStartedAtUtc);
        Assert.False(ended.DuplicateConfirmationRequired);
        Assert.False(await db.ImportReviewRows.AnyAsync(row => row.ReviewId == review.Id));
        Assert.Null(await db.Accounts.Where(candidate => candidate.Id == account.Id)
            .Select(candidate => candidate.ActiveImportId).SingleAsync());
        var audit = await db.Audits.SingleAsync(candidate =>
            candidate.EventCode == "ReviewEndedElsewhere"
            && candidate.ActingUserId == ownerUserId);
        Assert.Contains(account.Description, audit.Description, StringComparison.Ordinal);
        Assert.DoesNotContain(account.Id.ToString(), audit.Description, StringComparison.Ordinal);
        Assert.DoesNotContain(review.Id.ToString(), audit.Description, StringComparison.Ordinal);
        Assert.Equal(0, await db.Transactions.CountAsync(candidate => candidate.AccountId == account.Id));

        using var statusResponse = await owner.GetAsync(
            $"/api/accounts/{account.Id}/import-status?reviewId={review.Id}");
        Assert.Equal(HttpStatusCode.OK, statusResponse.StatusCode);
        using var statusJson = JsonDocument.Parse(await statusResponse.Content.ReadAsStringAsync());
        var watched = statusJson.RootElement.GetProperty("watchedImport");
        Assert.Equal("Ended", watched.GetProperty("state").GetString());
        Assert.Equal(username, watched.GetProperty("endedBy").GetProperty("userName").GetString());
        Assert.Equal(ownerUserId, watched.GetProperty("endedBy").GetProperty("userId").GetString());
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task End_requires_an_exact_target_and_csrf_without_mutating_the_preview_on_bad_requests()
    {
        using var owner = CreateClient();
        await RegisterAndSignInAsync(owner);
        var account = await CreateAccountAsync(owner, "Required target");
        using var reviewResponse = await CreateReviewAsync(
            owner,
            account.Id,
            "Date,Description,Amount\n2025-01-15,Target row,12.34");
        var review = await reviewResponse.Content.ReadFromJsonAsync<ReviewResponse>();
        Assert.NotNull(review);

        using var missingTarget = await SendDeleteAsync(
            owner,
            $"/api/accounts/{account.Id}/active-import-review",
            includeCsrf: true);
        Assert.Equal(HttpStatusCode.BadRequest, missingTarget.StatusCode);
        AssertProblemCode(await missingTarget.Content.ReadAsStringAsync(), "ImportTargetRequired");

        using var malformedTarget = await SendDeleteAsync(
            owner,
            $"/api/accounts/{account.Id}/active-import-review?reviewId=not-a-guid",
            includeCsrf: true);
        Assert.Equal(HttpStatusCode.BadRequest, malformedTarget.StatusCode);
        AssertProblemCode(await malformedTarget.Content.ReadAsStringAsync(), "ImportTargetRequired");

        using var missingCsrf = await SendDeleteAsync(
            owner,
            $"/api/accounts/{account.Id}/active-import-review?reviewId={review.Id}",
            includeCsrf: false);
        Assert.Equal(HttpStatusCode.BadRequest, missingCsrf.StatusCode);

        await AssertReviewIsReadyAsync(account.Id, review.Id);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Repeated_old_target_is_idempotent_and_cannot_end_a_replacement()
    {
        using var owner = CreateClient();
        await RegisterAndSignInAsync(owner);
        var account = await CreateAccountAsync(owner, "Replacement target");
        using var firstResponse = await CreateReviewAsync(
            owner,
            account.Id,
            "Date,Description,Amount\n2025-01-15,First preview,12.34");
        var firstReview = await firstResponse.Content.ReadFromJsonAsync<ReviewResponse>();
        Assert.NotNull(firstReview);

        using var firstEnd = await DeleteExactAsync(owner, account.Id, firstReview.Id);
        Assert.Equal(HttpStatusCode.NoContent, firstEnd.StatusCode);
        var firstAuditCount = await CountEndAuditsAsync(account.Id);

        using var replacementResponse = await CreateReviewAsync(
            owner,
            account.Id,
            "Date,Description,Amount\n2025-01-16,Replacement preview,45.67");
        Assert.Equal(HttpStatusCode.Created, replacementResponse.StatusCode);
        var replacement = await replacementResponse.Content.ReadFromJsonAsync<ReviewResponse>();
        Assert.NotNull(replacement);

        using var repeatedEnd = await DeleteExactAsync(owner, account.Id, firstReview.Id);
        Assert.Equal(HttpStatusCode.NoContent, repeatedEnd.StatusCode);
        Assert.Equal(firstAuditCount, await CountEndAuditsAsync(account.Id));

        await using var verifyScope = fixture.Factory.Services.CreateAsyncScope();
        var db = verifyScope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(replacement.Id, await db.Accounts.Where(candidate => candidate.Id == account.Id)
            .Select(candidate => candidate.ActiveImportId).SingleAsync());
        Assert.Equal(ImportReviewState.Ready, await db.ImportReviews
            .Where(candidate => candidate.Id == replacement.Id)
            .Select(candidate => candidate.State).SingleAsync());
        Assert.True(await db.ImportReviewRows.AnyAsync(row => row.ReviewId == replacement.Id));
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Processing_expired_and_disappeared_targets_return_distinct_conflicts()
    {
        using var owner = CreateClient();
        await RegisterAndSignInAsync(owner);
        var account = await CreateAccountAsync(owner, "Protected targets");
        using var processingResponse = await CreateReviewAsync(
            owner,
            account.Id,
            "Date,Description,Amount\n2025-01-15,Processing target,12.34");
        var processing = await processingResponse.Content.ReadFromJsonAsync<ReviewResponse>();
        Assert.NotNull(processing);
        var attemptId = Guid.NewGuid();
        await using (var scope = fixture.Factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.ImportReviews.Where(candidate => candidate.Id == processing.Id)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(candidate => candidate.State, ImportReviewState.Processing)
                    .SetProperty(candidate => candidate.ConfirmationAttemptId, attemptId)
                    .SetProperty(candidate => candidate.ProcessingStartedAtUtc, DateTimeOffset.UtcNow));
        }

        using var processingEnd = await DeleteExactAsync(owner, account.Id, processing.Id);
        Assert.Equal(HttpStatusCode.Conflict, processingEnd.StatusCode);
        AssertProblemCode(await processingEnd.Content.ReadAsStringAsync(), "ImportNotEndable");
        await AssertReviewIsProcessingAsync(account.Id, processing.Id, attemptId);

        await using (var scope = fixture.Factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.ImportReviewRows.Where(row => row.ReviewId == processing.Id)
                .ExecuteDeleteAsync();
            await db.ImportReviews.Where(candidate => candidate.Id == processing.Id)
                .ExecuteDeleteAsync();
            await db.Accounts.Where(candidate => candidate.Id == account.Id)
                .ExecuteUpdateAsync(setters => setters.SetProperty(
                    candidate => candidate.ActiveImportId,
                    (Guid?)null));
        }

        using var disappearedEnd = await DeleteExactAsync(owner, account.Id, processing.Id);
        Assert.Equal(HttpStatusCode.Conflict, disappearedEnd.StatusCode);
        AssertProblemCode(await disappearedEnd.Content.ReadAsStringAsync(), "ImportChanged");

        using var expiredResponse = await CreateReviewAsync(
            owner,
            account.Id,
            "Date,Description,Amount\n2025-01-16,Expired target,45.67");
        var expired = await expiredResponse.Content.ReadFromJsonAsync<ReviewResponse>();
        Assert.NotNull(expired);
        await using (var scope = fixture.Factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.ImportReviews.Where(candidate => candidate.Id == expired.Id)
                .ExecuteUpdateAsync(setters => setters.SetProperty(
                    candidate => candidate.ExpiresAtUtc,
                    DateTimeOffset.UtcNow.AddMinutes(-1)));
        }

        using var expiredEnd = await DeleteExactAsync(owner, account.Id, expired.Id);
        Assert.Equal(HttpStatusCode.Conflict, expiredEnd.StatusCode);
        AssertProblemCode(await expiredEnd.Content.ReadAsStringAsync(), "ImportChanged");
        await AssertReviewIsReadyAsync(account.Id, expired.Id);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Another_owner_cannot_end_or_learn_about_a_preview()
    {
        using var owner = CreateClient();
        await RegisterAndSignInAsync(owner);
        var account = await CreateAccountAsync(owner, "Private ending");
        using var reviewResponse = await CreateReviewAsync(
            owner,
            account.Id,
            "Date,Description,Amount\n2025-01-15,Private target,12.34");
        var review = await reviewResponse.Content.ReadFromJsonAsync<ReviewResponse>();
        Assert.NotNull(review);

        using var stranger = CreateClient();
        await RegisterAndSignInAsync(stranger);
        using var denied = await DeleteExactAsync(stranger, account.Id, review.Id);
        Assert.Equal(HttpStatusCode.NotFound, denied.StatusCode);
        await AssertReviewIsReadyAsync(account.Id, review.Id);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Confirmation_claim_wins_race_and_prevents_ending()
    {
        using var owner = CreateClient();
        await RegisterAndSignInAsync(owner);
        var account = await CreateAccountAsync(owner, "Confirmation wins race");
        using var response = await CreateReviewAsync(
            owner,
            account.Id,
            "Date,Description,Amount\n2025-01-15,Race transaction,12.34");
        var review = await response.Content.ReadFromJsonAsync<ReviewResponse>();
        Assert.NotNull(review);
        var ownerUserId = await GetOwnerIdAsync(account.Id);
        var barrier = new SecondReviewUpdateBarrier();
        await using var confirmDb = CreateDbContext(barrier);
        var confirm = CreateConfirmService(confirmDb);

        var confirmation = confirm.ConfirmAsync(
            ownerUserId,
            review.Id,
            confirmPossibleDuplicates: false,
            CancellationToken.None);
        await barrier.SecondUpdateStarted.Task.WaitAsync(TimeSpan.FromSeconds(5));

        var outcome = await EndReviewAsync(ownerUserId, account.Id, review.Id);

        Assert.Equal(ImportCoordinationError.ImportNotEndable, outcome.Error);
        barrier.Continue();
        Assert.Equal(1, (await confirmation.WaitAsync(TimeSpan.FromSeconds(10))).ImportedCount);
        await using var verifyScope = fixture.Factory.Services.CreateAsyncScope();
        var verifyDb = verifyScope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(1, await verifyDb.Transactions.CountAsync(
            candidate => candidate.AccountId == account.Id));
        Assert.False(await verifyDb.ImportReviews.AnyAsync(candidate => candidate.Id == review.Id));
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Ending_commit_wins_race_and_prevents_financial_writes()
    {
        using var owner = CreateClient();
        await RegisterAndSignInAsync(owner);
        var account = await CreateAccountAsync(owner, "Ending wins race");
        using var response = await CreateReviewAsync(
            owner,
            account.Id,
            "Date,Description,Amount\n2025-01-15,Race transaction,12.34");
        var review = await response.Content.ReadFromJsonAsync<ReviewResponse>();
        Assert.NotNull(review);
        var ownerUserId = await GetOwnerIdAsync(account.Id);
        var endingBarrier = new ReviewUpdateExecutedBarrier();
        await using var endingDb = CreateDbContext(endingBarrier);
        var ending = CreateReviewService(endingDb)
            .EndReviewElsewhereAsync(ownerUserId, account.Id, review.Id, CancellationToken.None);
        await endingBarrier.UpdateExecuted.Task.WaitAsync(TimeSpan.FromSeconds(5));

        var claimBarrier = new ReviewClaimStartedBarrier();
        await using var confirmDb = CreateDbContext(claimBarrier);
        var confirmation = CreateConfirmService(confirmDb).ConfirmAsync(
            ownerUserId,
            review.Id,
            confirmPossibleDuplicates: false,
            CancellationToken.None);
        await claimBarrier.ClaimStarted.Task.WaitAsync(TimeSpan.FromSeconds(5));
        Assert.False(confirmation.IsCompleted);

        endingBarrier.Continue();
        var endingOutcome = await ending.WaitAsync(TimeSpan.FromSeconds(10));
        Assert.True(endingOutcome.IsSuccess);
        var problem = await Assert.ThrowsAsync<ApiProblemException>(
            () => confirmation.WaitAsync(TimeSpan.FromSeconds(10)));
        Assert.Contains("ImportEndedElsewhere", problem.Errors!["code"]);

        await using var verifyScope = fixture.Factory.Services.CreateAsyncScope();
        var verifyDb = verifyScope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(0, await verifyDb.Transactions.CountAsync(
            candidate => candidate.AccountId == account.Id));
        var ended = await verifyDb.ImportReviews.AsNoTracking()
            .SingleAsync(candidate => candidate.Id == review.Id);
        Assert.Equal(ImportReviewState.Cancelled, ended.State);
        Assert.NotNull(ended.EndedAtUtc);
        Assert.Equal(ownerUserId, ended.EndedByUserId);
        Assert.False(await verifyDb.ImportReviewRows.AnyAsync(row => row.ReviewId == review.Id));
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Replacement_start_waits_for_the_ending_transaction_and_acquires_the_released_lease()
    {
        using var owner = CreateClient();
        await RegisterAndSignInAsync(owner);
        var account = await CreateAccountAsync(owner, "Concurrent replacement");
        using var response = await CreateReviewAsync(
            owner,
            account.Id,
            "Date,Description,Amount\n2025-01-15,Original transaction,12.34");
        var original = await response.Content.ReadFromJsonAsync<ReviewResponse>();
        Assert.NotNull(original);
        var ownerUserId = await GetOwnerIdAsync(account.Id);
        var endingBarrier = new EndingSaveChangesBarrier();
        await using var endingDb = CreateDbContext(endingBarrier);
        var ending = CreateReviewService(endingDb)
            .EndReviewElsewhereAsync(ownerUserId, account.Id, original.Id, CancellationToken.None);
        await endingBarrier.SaveChangesStarted.Task.WaitAsync(TimeSpan.FromSeconds(5));

        var createBarrier = new AccountReadStartedBarrier();
        await using var createDb = CreateDbContext(createBarrier);
        var csv = Encoding.UTF8.GetBytes("Date,Description,Amount\n2025-01-16,Replacement transaction,45.67");
        await using var file = new MemoryStream(csv);
        var replacementTask = CreateReviewService(createDb).CreateAsync(
            ownerUserId,
            account.Id,
            file,
            csv.Length,
            SignedMapping(),
            CancellationToken.None);
        await createBarrier.ReadStarted.Task.WaitAsync(TimeSpan.FromSeconds(5));
        Assert.False(replacementTask.IsCompleted);

        endingBarrier.Continue();
        Assert.True((await ending.WaitAsync(TimeSpan.FromSeconds(10))).IsSuccess);
        var replacement = await replacementTask.WaitAsync(TimeSpan.FromSeconds(10));

        await using var verifyScope = fixture.Factory.Services.CreateAsyncScope();
        var verifyDb = verifyScope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(replacement.Id, await verifyDb.Accounts.Where(candidate => candidate.Id == account.Id)
            .Select(candidate => candidate.ActiveImportId).SingleAsync());
        Assert.Equal(ImportReviewState.Cancelled, await verifyDb.ImportReviews
            .Where(candidate => candidate.Id == original.Id)
            .Select(candidate => candidate.State).SingleAsync());
        Assert.Equal(ImportReviewState.Ready, await verifyDb.ImportReviews
            .Where(candidate => candidate.Id == replacement.Id)
            .Select(candidate => candidate.State).SingleAsync());
        Assert.True(await verifyDb.ImportReviewRows.AnyAsync(row => row.ReviewId == replacement.Id));
        Assert.Equal(0, await verifyDb.Transactions.CountAsync(candidate => candidate.AccountId == account.Id));
    }

    private HttpClient CreateClient() =>
        fixture.Factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost"),
            AllowAutoRedirect = false,
        });

    private AppDbContext CreateDbContext(params IInterceptor[] interceptors)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlServer(fixture.ConnectionString)
            .AddInterceptors(interceptors)
            .Options;
        return new AppDbContext(options);
    }

    private ImportReviewService CreateReviewService(AppDbContext db)
    {
        var clock = TimeProvider.System;
        return new ImportReviewService(
            db,
            new CsvImportParser(),
            new AccountImportLease(db),
            new ImportAuditWriter(db, clock),
            new AllowImportAttempts(),
            clock);
    }

    private static ImportMapping SignedMapping() =>
        new(
            DateColumn: 0,
            DescriptionColumn: 1,
            DateFormat: "yyyy-MM-dd",
            AmountMode: ImportAmountMode.Signed,
            SignedAmountColumn: 2,
            IncomingSign: IncomingSign.Positive,
            NumberFormat: "dot-decimal-comma-grouping");

    private ConfirmImportService CreateConfirmService(AppDbContext db)
    {
        var clock = TimeProvider.System;
        var auditWriter = new ImportAuditWriter(db, clock);
        var reviewService = CreateReviewService(db);
        var stateService = new ImportStateService(
            db,
            clock,
            fixture.Factory.Services.GetRequiredService<ILogger<ImportStateService>>());
        var settingsService = new AccountImportSettingsService(
            db,
            clock,
            fixture.Factory.Services.GetRequiredService<ILogger<AccountImportSettingsService>>());
        return new ConfirmImportService(
            db,
            auditWriter,
            reviewService,
            stateService,
            settingsService,
            clock);
    }

    private async Task<ImportCoordinationOutcome<bool>> EndReviewAsync(
        string ownerUserId,
        Guid accountId,
        Guid reviewId)
    {
        await using var db = CreateDbContext();
        return await CreateReviewService(db).EndReviewElsewhereAsync(
            ownerUserId,
            accountId,
            reviewId,
            CancellationToken.None);
    }

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
        await SendDeleteAsync(
            client,
            $"/api/accounts/{accountId}/active-import-review?reviewId={reviewId}",
            includeCsrf: true);

    private static async Task<HttpResponseMessage> SendDeleteAsync(
        HttpClient client,
        string path,
        bool includeCsrf)
    {
        using var request = new HttpRequestMessage(HttpMethod.Delete, path);
        if (includeCsrf)
        {
            using var tokenResponse = await client.GetAsync("/api/security/csrf-token");
            tokenResponse.EnsureSuccessStatusCode();
            var csrf = await tokenResponse.Content.ReadFromJsonAsync<CsrfTokenResponse>();
            Assert.NotNull(csrf);
            request.Headers.Add("X-CSRF-TOKEN", csrf.RequestToken);
        }

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

    private async Task<string> GetOwnerIdAsync(Guid accountId)
    {
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await db.Accounts.Where(candidate => candidate.Id == accountId)
            .Select(candidate => candidate.OwnerUserId)
            .SingleAsync() ?? throw new InvalidOperationException("The account must have an owner.");
    }

    private async Task<int> CountEndAuditsAsync(Guid accountId)
    {
        var ownerUserId = await GetOwnerIdAsync(accountId);
        string accountDescription;
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        accountDescription = await db.Accounts.Where(candidate => candidate.Id == accountId)
            .Select(candidate => candidate.Description)
            .SingleAsync();
        return await db.Audits.CountAsync(candidate =>
            candidate.ActingUserId == ownerUserId
            && candidate.EventCode == "ReviewEndedElsewhere"
            && candidate.Description.Contains(accountDescription));
    }

    private async Task AssertReviewIsReadyAsync(Guid accountId, Guid reviewId)
    {
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(ImportReviewState.Ready, await db.ImportReviews
            .Where(candidate => candidate.Id == reviewId)
            .Select(candidate => candidate.State).SingleAsync());
        Assert.Equal(reviewId, await db.Accounts.Where(candidate => candidate.Id == accountId)
            .Select(candidate => candidate.ActiveImportId).SingleAsync());
        Assert.True(await db.ImportReviewRows.AnyAsync(row => row.ReviewId == reviewId));
        var ownerUserId = await db.Accounts.Where(candidate => candidate.Id == accountId)
            .Select(candidate => candidate.OwnerUserId)
            .SingleAsync();
        var description = await db.Accounts.Where(candidate => candidate.Id == accountId)
            .Select(candidate => candidate.Description)
            .SingleAsync();
        Assert.False(await db.Audits.AnyAsync(candidate =>
            candidate.ActingUserId == ownerUserId
            && candidate.EventCode == "ReviewEndedElsewhere"
            && candidate.Description.Contains(description)));
    }

    private async Task AssertReviewIsProcessingAsync(Guid accountId, Guid reviewId, Guid attemptId)
    {
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var review = await db.ImportReviews.AsNoTracking().SingleAsync(candidate => candidate.Id == reviewId);
        Assert.Equal(ImportReviewState.Processing, review.State);
        Assert.Equal(attemptId, review.ConfirmationAttemptId);
        Assert.True(await db.ImportReviewRows.AnyAsync(row => row.ReviewId == reviewId));
        Assert.Equal(reviewId, await db.Accounts.Where(candidate => candidate.Id == accountId)
            .Select(candidate => candidate.ActiveImportId).SingleAsync());
    }

    private static void AssertProblemCode(string body, string expectedCode)
    {
        using var json = JsonDocument.Parse(body);
        Assert.Contains(
            expectedCode,
            json.RootElement.GetProperty("errors").GetProperty("code")
                .EnumerateArray().Select(value => value.GetString()));
    }

    private sealed record CsrfTokenResponse(string RequestToken);

    private sealed record AccountResponse(Guid Id, string Description);

    private sealed record ReviewResponse(Guid Id, DateTimeOffset ExpiresAtUtc);

    private sealed class AllowImportAttempts : IImportAttemptLimiter
    {
        public Task<bool> TryConsumeAsync(
            string userId,
            int maxAttemptsPerUserPerMinute,
            CancellationToken cancellationToken) =>
            Task.FromResult(true);
    }

    private sealed class SecondReviewUpdateBarrier : DbCommandInterceptor
    {
        private readonly TaskCompletionSource<bool> secondUpdateStarted =
            new(TaskCreationOptions.RunContinuationsAsynchronously);
        private readonly TaskCompletionSource<bool> continueExecution =
            new(TaskCreationOptions.RunContinuationsAsynchronously);
        private int updateCount;

        public TaskCompletionSource<bool> SecondUpdateStarted => secondUpdateStarted;

        public void Continue() => continueExecution.TrySetResult(true);

        public override async ValueTask<InterceptionResult<int>> NonQueryExecutingAsync(
            DbCommand command,
            CommandEventData eventData,
            InterceptionResult<int> result,
            CancellationToken cancellationToken = default)
        {
            if (command.CommandText.Contains("UPDATE", StringComparison.OrdinalIgnoreCase)
                && command.CommandText.Contains("ImportReviews", StringComparison.OrdinalIgnoreCase)
                && Interlocked.Increment(ref updateCount) == 2)
            {
                secondUpdateStarted.TrySetResult(true);
                await continueExecution.Task.WaitAsync(cancellationToken);
            }

            return result;
        }

        public override async ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
            DbCommand command,
            CommandEventData eventData,
            InterceptionResult<DbDataReader> result,
            CancellationToken cancellationToken = default)
        {
            if (command.CommandText.Contains("UPDATE", StringComparison.OrdinalIgnoreCase)
                && command.CommandText.Contains("ImportReviews", StringComparison.OrdinalIgnoreCase)
                && Interlocked.Increment(ref updateCount) == 2)
            {
                secondUpdateStarted.TrySetResult(true);
                await continueExecution.Task.WaitAsync(cancellationToken);
            }

            return result;
        }
    }

    private sealed class ReviewUpdateExecutedBarrier : DbCommandInterceptor
    {
        private readonly TaskCompletionSource<bool> updateExecuted =
            new(TaskCreationOptions.RunContinuationsAsynchronously);
        private readonly TaskCompletionSource<bool> continueExecution =
            new(TaskCreationOptions.RunContinuationsAsynchronously);

        public TaskCompletionSource<bool> UpdateExecuted => updateExecuted;

        public void Continue() => continueExecution.TrySetResult(true);

        public override async ValueTask<int> NonQueryExecutedAsync(
            DbCommand command,
            CommandExecutedEventData eventData,
            int result,
            CancellationToken cancellationToken = default)
        {
            await PauseAfterReviewUpdateAsync(command, cancellationToken);
            return result;
        }

        public override async ValueTask<DbDataReader> ReaderExecutedAsync(
            DbCommand command,
            CommandExecutedEventData eventData,
            DbDataReader result,
            CancellationToken cancellationToken = default)
        {
            if (command.CommandText.Contains("UPDATE", StringComparison.OrdinalIgnoreCase)
                && command.CommandText.Contains("ImportReviews", StringComparison.OrdinalIgnoreCase))
            {
                updateExecuted.TrySetResult(true);
                await continueExecution.Task.WaitAsync(cancellationToken);
            }

            return result;
        }

        private async Task PauseAfterReviewUpdateAsync(
            DbCommand command,
            CancellationToken cancellationToken)
        {
            if (command.CommandText.Contains("UPDATE", StringComparison.OrdinalIgnoreCase)
                && command.CommandText.Contains("ImportReviews", StringComparison.OrdinalIgnoreCase))
            {
                updateExecuted.TrySetResult(true);
                await continueExecution.Task.WaitAsync(cancellationToken);
            }
        }
    }

    private sealed class ReviewClaimStartedBarrier : DbCommandInterceptor
    {
        public TaskCompletionSource<bool> ClaimStarted { get; } =
            new(TaskCreationOptions.RunContinuationsAsynchronously);

        public override ValueTask<InterceptionResult<int>> NonQueryExecutingAsync(
            DbCommand command,
            CommandEventData eventData,
            InterceptionResult<int> result,
            CancellationToken cancellationToken = default)
        {
            if (command.CommandText.Contains("UPDATE", StringComparison.OrdinalIgnoreCase)
                && command.CommandText.Contains("ImportReviews", StringComparison.OrdinalIgnoreCase))
            {
                ClaimStarted.TrySetResult(true);
            }

            return base.NonQueryExecutingAsync(command, eventData, result, cancellationToken);
        }

        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
            DbCommand command,
            CommandEventData eventData,
            InterceptionResult<DbDataReader> result,
            CancellationToken cancellationToken = default)
        {
            if (command.CommandText.Contains("UPDATE", StringComparison.OrdinalIgnoreCase)
                && command.CommandText.Contains("ImportReviews", StringComparison.OrdinalIgnoreCase))
            {
                ClaimStarted.TrySetResult(true);
            }

            return base.ReaderExecutingAsync(command, eventData, result, cancellationToken);
        }
    }

    private sealed class EndingSaveChangesBarrier : SaveChangesInterceptor
    {
        private readonly TaskCompletionSource<bool> continueExecution =
            new(TaskCreationOptions.RunContinuationsAsynchronously);

        public TaskCompletionSource<bool> SaveChangesStarted { get; } =
            new(TaskCreationOptions.RunContinuationsAsynchronously);

        public void Continue() => continueExecution.TrySetResult(true);

        public override async ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData,
            InterceptionResult<int> result,
            CancellationToken cancellationToken = default)
        {
            SaveChangesStarted.TrySetResult(true);
            await continueExecution.Task.WaitAsync(cancellationToken);
            return result;
        }
    }

    private sealed class AccountReadStartedBarrier : DbCommandInterceptor
    {
        public TaskCompletionSource<bool> ReadStarted { get; } =
            new(TaskCreationOptions.RunContinuationsAsynchronously);

        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
            DbCommand command,
            CommandEventData eventData,
            InterceptionResult<DbDataReader> result,
            CancellationToken cancellationToken = default)
        {
            if (command.CommandText.Contains("SELECT", StringComparison.OrdinalIgnoreCase))
            {
                ReadStarted.TrySetResult(true);
            }

            return base.ReaderExecutingAsync(command, eventData, result, cancellationToken);
        }
    }
}
