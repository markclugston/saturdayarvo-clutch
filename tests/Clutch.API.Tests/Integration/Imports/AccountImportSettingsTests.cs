using System.Data.Common;
using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Clutch.API.Application.Imports;
using Clutch.API.Domain.Imports;
using Clutch.API.Infrastructure.Imports;
using Clutch.API.Infrastructure.Persistence;
using Clutch.API.Infrastructure.Persistence.Entities;
using Clutch.API.Tests.Integration.Accounts;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Clutch.API.Tests.Integration.Imports;

[Collection(SqlServerCollection.Name)]
public sealed class AccountImportSettingsTests(SqlServerFixture fixture)
{
    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Settings_are_isolated_by_account_and_owner()
    {
        using var owner = await CreateSignedInUserAsync();
        var firstAccount = await CreateAccountAsync(owner.Client, "First account");
        var secondAccount = await CreateAccountAsync(owner.Client, "Second account");
        Assert.Null((await GetSettingsAsync(owner.Client, firstAccount)).Mapping);
        var firstMapping = Mapping();
        var secondMapping = Mapping(dateFormat: "dd/MM/yyyy", incomingSign: IncomingSign.Negative);
        await using (var scope = fixture.Factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.AccountImportSettings.Add(AccountImportSettings.Create(
                firstAccount,
                ImportMappingSettingsSerializer.CurrentSchemaVersion,
                ImportMappingSettingsSerializer.Serialize(firstMapping),
                Guid.NewGuid(),
                DateTimeOffset.UtcNow));
            db.AccountImportSettings.Add(AccountImportSettings.Create(
                secondAccount,
                ImportMappingSettingsSerializer.CurrentSchemaVersion,
                ImportMappingSettingsSerializer.Serialize(secondMapping),
                Guid.NewGuid(),
                DateTimeOffset.UtcNow));
            await db.SaveChangesAsync();
        }

        var firstResponse = await GetSettingsAsync(owner.Client, firstAccount);
        var secondResponse = await GetSettingsAsync(owner.Client, secondAccount);
        Assert.Equal(firstMapping, firstResponse.Mapping);
        Assert.Equal(secondMapping, secondResponse.Mapping);

        using var otherOwner = await CreateSignedInUserAsync();
        using var unauthorizedResponse = await otherOwner.Client.GetAsync(
            $"/api/accounts/{firstAccount}/import-settings");
        Assert.Equal(HttpStatusCode.NotFound, unauthorizedResponse.StatusCode);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Latest_confirmation_token_wins_for_both_settings_write_orders()
    {
        using var owner = await CreateSignedInUserAsync();
        var accountId = await CreateAccountAsync(owner.Client, "Concurrency account");
        var olderReviewId = Guid.NewGuid();
        var newerReviewId = Guid.NewGuid();
        var olderMapping = Mapping();
        var newerMapping = Mapping(dateFormat: "dd/MM/yyyy", incomingSign: IncomingSign.Negative);
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var settings = scope.ServiceProvider.GetRequiredService<AccountImportSettingsService>();

        await SetLatestReviewAsync(db, accountId, olderReviewId);
        Assert.True(await settings.SaveAfterConfirmationAsync(
            accountId, olderReviewId, olderMapping, CancellationToken.None));

        await SetLatestReviewAsync(db, accountId, newerReviewId);
        Assert.True(await settings.SaveAfterConfirmationAsync(
            accountId, newerReviewId, newerMapping, CancellationToken.None));
        Assert.False(await settings.SaveAfterConfirmationAsync(
            accountId, olderReviewId, olderMapping, CancellationToken.None));
        Assert.Equal(newerMapping, (await GetSettingsAsync(owner.Client, accountId)).Mapping);

        await SetLatestReviewAsync(db, accountId, olderReviewId);
        Assert.True(await settings.SaveAfterConfirmationAsync(
            accountId, olderReviewId, olderMapping, CancellationToken.None));
        await SetLatestReviewAsync(db, accountId, newerReviewId);
        Assert.True(await settings.SaveAfterConfirmationAsync(
            accountId, newerReviewId, newerMapping, CancellationToken.None));
        Assert.Equal(newerMapping, (await GetSettingsAsync(owner.Client, accountId)).Mapping);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Defaults_write_failure_preserves_previous_settings_and_imported_transactions()
    {
        using var owner = await CreateSignedInUserAsync();
        var accountId = await CreateAccountAsync(owner.Client, "Failure account");
        var initialMapping = Mapping();
        using var initialReviewResponse = await CreateReviewAsync(
            owner.Client,
            accountId,
            "Date,Description,Amount\n2025-01-15,Market first,10.00",
            initialMapping);
        var initialReview = await initialReviewResponse.Content.ReadFromJsonAsync<ReviewResponse>();
        Assert.NotNull(initialReview);
        using var initialConfirmation = await SendJsonAsync(
            owner.Client,
            HttpMethod.Post,
            $"/api/import-reviews/{initialReview.Id}/confirm",
            new { confirmPossibleDuplicates = false });
        Assert.Equal(HttpStatusCode.OK, initialConfirmation.StatusCode);

        var changedMapping = Mapping(dateFormat: "dd/MM/yyyy", incomingSign: IncomingSign.Negative);
        using var nextReviewResponse = await CreateReviewAsync(
            owner.Client,
            accountId,
            "Date,Description,Amount\n16/01/2025,Market second,20.00",
            changedMapping);
        var nextReview = await nextReviewResponse.Content.ReadFromJsonAsync<ReviewResponse>();
        Assert.NotNull(nextReview);

        string ownerUserId;
        await using (var readScope = fixture.Factory.Services.CreateAsyncScope())
        {
            var readDb = readScope.ServiceProvider.GetRequiredService<AppDbContext>();
            ownerUserId = await readDb.Accounts
                .Where(account => account.Id == accountId)
                .Select(account => account.OwnerUserId)
                .SingleAsync() ?? throw new InvalidOperationException("The account must have an owner.");
        }

        var interceptor = new FailSettingsWriteInterceptor();
        await using var contextScope = fixture.Factory.Services.CreateAsyncScope();
        var existingDb = contextScope.ServiceProvider.GetRequiredService<AppDbContext>();
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlServer(existingDb.Database.GetConnectionString())
            .AddInterceptors(interceptor)
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
        var settingsService = new AccountImportSettingsService(
            db,
            clock,
            fixture.Factory.Services.GetRequiredService<ILogger<AccountImportSettingsService>>());
        var confirmService = new ConfirmImportService(
            db,
            auditWriter,
            reviewService,
            settingsService,
            clock);

        var result = await confirmService.ConfirmAsync(
            ownerUserId,
            nextReview.Id,
            confirmPossibleDuplicates: false,
            CancellationToken.None);

        Assert.True(interceptor.Triggered);
        Assert.Equal(1, result.ImportedCount);
        Assert.False(result.SettingsSaved);
        Assert.Equal(initialMapping, (await GetSettingsAsync(owner.Client, accountId)).Mapping);
        await using var verifyScope = fixture.Factory.Services.CreateAsyncScope();
        var verifyDb = verifyScope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(2, await verifyDb.Transactions.CountAsync(
            transaction => transaction.AccountId == accountId));
        Assert.Equal(0, await verifyDb.ImportReviewMappingSnapshots.CountAsync(
            snapshot => snapshot.ReviewId == nextReview.Id));
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Cancelling_a_ready_review_deletes_its_mapping_snapshot()
    {
        using var owner = await CreateSignedInUserAsync();
        var accountId = await CreateAccountAsync(owner.Client, "Cancellation account");
        using var reviewResponse = await CreateReviewAsync(
            owner.Client,
            accountId,
            "Date,Description,Amount\n2025-01-15,Market,10.00",
            Mapping());
        var review = await reviewResponse.Content.ReadFromJsonAsync<ReviewResponse>();
        Assert.NotNull(review);

        await using (var scope = fixture.Factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            Assert.Equal(1, await db.ImportReviewMappingSnapshots.CountAsync(
                snapshot => snapshot.ReviewId == review.Id));
        }

        using var cancellation = await SendJsonAsync(
            owner.Client,
            HttpMethod.Delete,
            $"/api/import-reviews/{review.Id}",
            content: null);
        Assert.Equal(HttpStatusCode.NoContent, cancellation.StatusCode);

        await using var verifyScope = fixture.Factory.Services.CreateAsyncScope();
        var verifyDb = verifyScope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(0, await verifyDb.ImportReviewMappingSnapshots.CountAsync(
            snapshot => snapshot.ReviewId == review.Id));
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Settings_read_and_upsert_use_one_joined_database_read_each()
    {
        using var owner = await CreateSignedInUserAsync();
        var accountId = await CreateAccountAsync(owner.Client, "Query account");
        var reviewId = Guid.NewGuid();
        await using var seedScope = fixture.Factory.Services.CreateAsyncScope();
        var seedDb = seedScope.ServiceProvider.GetRequiredService<AppDbContext>();
        await SetLatestReviewAsync(seedDb, accountId, reviewId);
        var ownerUserId = await seedDb.Accounts
            .Where(account => account.Id == accountId)
            .Select(account => account.OwnerUserId)
            .SingleAsync() ?? throw new InvalidOperationException("The account must have an owner.");
        var interceptor = new CapturingCommandInterceptor();
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlServer(seedDb.Database.GetConnectionString())
            .AddInterceptors(interceptor)
            .Options;
        await using var db = new AppDbContext(options);
        var service = new AccountImportSettingsService(
            db,
            TimeProvider.System,
            fixture.Factory.Services.GetRequiredService<ILogger<AccountImportSettingsService>>());

        var emptySettings = await service.GetAsync(ownerUserId, accountId, CancellationToken.None);
        Assert.Null(emptySettings.Mapping);
        Assert.Single(interceptor.Commands, command =>
            command.Contains("SELECT", StringComparison.OrdinalIgnoreCase));
        Assert.Contains("LEFT JOIN", Assert.Single(interceptor.Commands), StringComparison.OrdinalIgnoreCase);

        interceptor.Commands.Clear();
        Assert.True(await service.SaveAfterConfirmationAsync(
            accountId,
            reviewId,
            Mapping(),
            CancellationToken.None));
        var selectCommand = Assert.Single(
            interceptor.Commands,
            command => command.Contains("SELECT", StringComparison.OrdinalIgnoreCase));
        Assert.Contains("LEFT JOIN", selectCommand, StringComparison.OrdinalIgnoreCase);
        Assert.Contains(interceptor.Commands, command =>
            command.Contains("UPDATE [AccountImportSettings]", StringComparison.Ordinal)
            || command.Contains("INSERT INTO [AccountImportSettings]", StringComparison.Ordinal));
    }

    private async Task<SignedInUser> CreateSignedInUserAsync()
    {
        var client = fixture.Factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost"),
            AllowAutoRedirect = false,
        });
        var email = $"{Guid.NewGuid():N}@example.test";
        using var registration = await SendJsonAsync(
            client,
            HttpMethod.Post,
            "/api/security/register",
            new { email, password = "Test-only!Password-123" });
        Assert.Equal(HttpStatusCode.Created, registration.StatusCode);
        using var login = await SendJsonAsync(
            client,
            HttpMethod.Post,
            "/api/security/login",
            new { email, password = "Test-only!Password-123" });
        Assert.Equal(HttpStatusCode.NoContent, login.StatusCode);

        return new SignedInUser(client);
    }

    private static async Task SetLatestReviewAsync(
        AppDbContext db,
        Guid accountId,
        Guid reviewId)
    {
        db.ChangeTracker.Clear();
        var account = await db.Accounts.SingleAsync(candidate => candidate.Id == accountId);
        account.MarkSuccessfulImport(DateTimeOffset.UtcNow, reviewId);
        await db.SaveChangesAsync();
    }

    private static async Task<Guid> CreateAccountAsync(HttpClient client, string description)
    {
        using var response = await SendJsonAsync(
            client,
            HttpMethod.Post,
            "/api/accounts",
            new { description, currencyCode = "AUD" });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var account = await response.Content.ReadFromJsonAsync<AccountResponse>();
        Assert.NotNull(account);
        return account.Id;
    }

    private static async Task<ImportSettingsResponse> GetSettingsAsync(HttpClient client, Guid accountId)
    {
        using var response = await client.GetAsync($"/api/accounts/{accountId}/import-settings");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var settings = await response.Content.ReadFromJsonAsync<ImportSettingsResponse>();
        Assert.NotNull(settings);
        return settings;
    }

    private static async Task<HttpResponseMessage> CreateReviewAsync(
        HttpClient client,
        Guid accountId,
        string csv,
        ImportMapping mapping)
    {
        using var content = new MultipartFormDataContent();
        content.Add(
            new ByteArrayContent(Encoding.UTF8.GetBytes(csv)),
            "file",
            "transactions.csv");
        content.Add(
            new StringContent(JsonSerializer.Serialize(mapping, new JsonSerializerOptions(
                JsonSerializerDefaults.Web))),
            "mapping");

        var token = await GetCsrfTokenAsync(client);
        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"/api/accounts/{accountId}/import-reviews")
        {
            Content = content,
        };
        request.Headers.Add("X-CSRF-TOKEN", token);
        return await client.SendAsync(request);
    }

    private static async Task<HttpResponseMessage> SendJsonAsync(
        HttpClient client,
        HttpMethod method,
        string path,
        object? content)
    {
        var token = await GetCsrfTokenAsync(client);
        using var request = new HttpRequestMessage(method, path)
        {
            Content = content is null ? null : JsonContent.Create(content),
        };
        request.Headers.Add("X-CSRF-TOKEN", token);
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

    private static ImportMapping Mapping(
        string dateFormat = "yyyy-MM-dd",
        IncomingSign incomingSign = IncomingSign.Positive) =>
        new(
            0,
            1,
            dateFormat,
            ImportAmountMode.Signed,
            SignedAmountColumn: 2,
            IncomingSign: incomingSign,
            NumberFormat: "dot-decimal-comma-grouping");

    private sealed class AllowImportAttempts : IImportAttemptLimiter
    {
        public Task<bool> TryConsumeAsync(
            string userId,
            int maxAttemptsPerUserPerMinute,
            CancellationToken cancellationToken) =>
            Task.FromResult(true);
    }

    private sealed class FailSettingsWriteInterceptor : DbCommandInterceptor
    {
        public bool Triggered { get; private set; }

        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
            DbCommand command,
            CommandEventData eventData,
            InterceptionResult<DbDataReader> result,
            CancellationToken cancellationToken = default)
        {
            if (IsSettingsWrite(command.CommandText))
            {
                Triggered = true;
                throw new DbUpdateException("Simulated settings persistence failure.");
            }
            return base.ReaderExecutingAsync(command, eventData, result, cancellationToken);
        }

        private static bool IsSettingsWrite(string commandText) =>
            commandText.Contains("[AccountImportSettings]", StringComparison.Ordinal)
            && (commandText.Contains("INSERT", StringComparison.OrdinalIgnoreCase)
                || commandText.Contains("UPDATE", StringComparison.OrdinalIgnoreCase));
    }

    private sealed class CapturingCommandInterceptor : DbCommandInterceptor
    {
        public List<string> Commands { get; } = [];

        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
            DbCommand command,
            CommandEventData eventData,
            InterceptionResult<DbDataReader> result,
            CancellationToken cancellationToken = default)
        {
            Commands.Add(command.CommandText);
            return base.ReaderExecutingAsync(command, eventData, result, cancellationToken);
        }

        public override ValueTask<InterceptionResult<int>> NonQueryExecutingAsync(
            DbCommand command,
            CommandEventData eventData,
            InterceptionResult<int> result,
            CancellationToken cancellationToken = default)
        {
            Commands.Add(command.CommandText);
            return base.NonQueryExecutingAsync(command, eventData, result, cancellationToken);
        }
    }

    private sealed record CsrfTokenResponse(string RequestToken);

    private sealed record AccountResponse(Guid Id);

    private sealed record ReviewResponse(Guid Id);

    private sealed record ImportSettingsResponse(ImportMapping? Mapping);

    private sealed class SignedInUser(HttpClient client) : IDisposable
    {
        public HttpClient Client { get; } = client;

        public void Dispose() => Client.Dispose();
    }
}
