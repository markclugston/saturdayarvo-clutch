using System.Net;
using System.Net.Http.Json;
using Clutch.API.Domain.Shared;
using Clutch.API.Domain.Transactions;
using Clutch.API.Infrastructure.Persistence;
using Clutch.API.Tests.Integration.Accounts;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Clutch.API.Tests.Integration.Transactions;

[Collection(SqlServerCollection.Name)]
public sealed class TransactionDeleteEndpointTests(SqlServerFixture fixture)
{
    private const string FailInsertTriggerName = "TR_TransactionDeletionAudits_FailInsert_Test";

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Delete_returns_NoContent_and_removes_only_the_target_transaction()
    {
        using var owner = CreateClient();
        var ownerEmail = await RegisterAndSignInAsync(owner);
        var accountId = await CreateAccountAsync(owner, "Delete endpoint account");
        var ownerUserId = await GetUserIdAsync(ownerEmail);
        var target = await SeedTransactionAsync(accountId, "Target");
        var sibling = await SeedTransactionAsync(accountId, "Sibling");
        var siblingBefore = await GetTransactionSnapshotAsync(sibling);

        using var response = await SendDeleteAsync(owner, accountId, target);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        await using var verifyScope = fixture.Factory.Services.CreateAsyncScope();
        var verifyContext = verifyScope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.False(await verifyContext.Transactions.AnyAsync(transaction => transaction.Id == target));
        var audit = await verifyContext.TransactionDeletionAudits
            .SingleAsync(entry => entry.TransactionId == target);
        Assert.Equal(ownerUserId, audit.ActingUserId);
        Assert.Equal(accountId, audit.AccountId);

        var siblingAfter = await GetTransactionSnapshotAsync(sibling);
        Assert.Equal(siblingBefore, siblingAfter);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Delete_returns_NotFound_for_another_users_transaction()
    {
        using var owner = CreateClient();
        await RegisterAndSignInAsync(owner);
        var accountId = await CreateAccountAsync(owner, "Owner account");
        var transactionId = await SeedTransactionAsync(accountId, "Owned");

        using var intruder = CreateClient();
        await RegisterAndSignInAsync(intruder);
        using var response = await SendDeleteAsync(intruder, accountId, transactionId);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        await using var verifyScope = fixture.Factory.Services.CreateAsyncScope();
        var verifyContext = verifyScope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.True(await verifyContext.Transactions.AnyAsync(transaction => transaction.Id == transactionId));
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Delete_returns_Unauthorized_when_not_signed_in()
    {
        using var owner = CreateClient();
        await RegisterAndSignInAsync(owner);
        var accountId = await CreateAccountAsync(owner, "Anonymous account");
        var transactionId = await SeedTransactionAsync(accountId, "Anonymous target");

        using var anonymous = CreateClient();
        using var response = await SendDeleteAsync(anonymous, accountId, transactionId);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        await using var verifyScope = fixture.Factory.Services.CreateAsyncScope();
        var verifyContext = verifyScope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.True(await verifyContext.Transactions.AnyAsync(transaction => transaction.Id == transactionId));
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Delete_returns_NotFound_when_transaction_belongs_to_a_different_owned_account()
    {
        using var owner = CreateClient();
        await RegisterAndSignInAsync(owner);
        var accountA = await CreateAccountAsync(owner, "Account A");
        var accountB = await CreateAccountAsync(owner, "Account B");
        var transactionInB = await SeedTransactionAsync(accountB, "Belongs to B");

        using var response = await SendDeleteAsync(owner, accountA, transactionInB);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        await using var verifyScope = fixture.Factory.Services.CreateAsyncScope();
        var verifyContext = verifyScope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.True(await verifyContext.Transactions.AnyAsync(transaction => transaction.Id == transactionInB));
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Delete_returns_NotFound_for_missing_transaction()
    {
        using var owner = CreateClient();
        await RegisterAndSignInAsync(owner);
        var accountId = await CreateAccountAsync(owner, "Empty account");

        using var response = await SendDeleteAsync(owner, accountId, Guid.NewGuid());

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Delete_without_csrf_token_is_rejected_and_keeps_transaction()
    {
        using var owner = CreateClient();
        await RegisterAndSignInAsync(owner);
        var accountId = await CreateAccountAsync(owner, "Csrf account");
        var transactionId = await SeedTransactionAsync(accountId, "Csrf target");

        using var response = await owner.DeleteAsync(
            $"/api/accounts/{accountId}/transactions/{transactionId}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await using var verifyScope = fixture.Factory.Services.CreateAsyncScope();
        var verifyContext = verifyScope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.True(await verifyContext.Transactions.AnyAsync(transaction => transaction.Id == transactionId));
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Delete_rolls_back_transaction_when_audit_insert_fails()
    {
        using var owner = CreateClient();
        await RegisterAndSignInAsync(owner);
        var accountId = await CreateAccountAsync(owner, "Atomic account");
        var transactionId = await SeedTransactionAsync(accountId, "Atomic target");

        await CreateFailingAuditInsertTriggerAsync();
        try
        {
            using var response = await SendDeleteAsync(owner, accountId, transactionId);

            Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
            var body = await response.Content.ReadAsStringAsync();
            Assert.DoesNotContain("TransactionDeletionAudits", body, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("THROW", body, StringComparison.OrdinalIgnoreCase);
        }
        finally
        {
            await DropFailingAuditInsertTriggerAsync();
        }

        await using var verifyScope = fixture.Factory.Services.CreateAsyncScope();
        var verifyContext = verifyScope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.True(await verifyContext.Transactions.AnyAsync(transaction => transaction.Id == transactionId));
        Assert.False(await verifyContext.TransactionDeletionAudits
            .AnyAsync(entry => entry.TransactionId == transactionId));
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Audit_rows_cannot_be_updated_or_deleted()
    {
        using var owner = CreateClient();
        await RegisterAndSignInAsync(owner);
        var accountId = await CreateAccountAsync(owner, "Immutable account");
        var transactionId = await SeedTransactionAsync(accountId, "Immutable target");

        using (var response = await SendDeleteAsync(owner, accountId, transactionId))
        {
            Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        }

        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        await Assert.ThrowsAsync<Microsoft.Data.SqlClient.SqlException>(() =>
            dbContext.Database.ExecuteSqlInterpolatedAsync(
                $"UPDATE TransactionDeletionAudits SET AccountId = AccountId WHERE TransactionId = {transactionId}"));

        await Assert.ThrowsAsync<Microsoft.Data.SqlClient.SqlException>(() =>
            dbContext.Database.ExecuteSqlInterpolatedAsync(
                $"DELETE FROM TransactionDeletionAudits WHERE TransactionId = {transactionId}"));
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public void No_audit_routes_are_exposed()
    {
        using var scope = fixture.Factory.Services.CreateScope();
        var dataSource = scope.ServiceProvider.GetRequiredService<EndpointDataSource>();
        var routes = dataSource.Endpoints
            .OfType<RouteEndpoint>()
            .Select(endpoint => endpoint.RoutePattern.RawText ?? string.Empty)
            .ToArray();

        Assert.DoesNotContain(routes, route => route.Contains("audit", StringComparison.OrdinalIgnoreCase));
    }

    private async Task CreateFailingAuditInsertTriggerAsync()
    {
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await dbContext.Database.ExecuteSqlRawAsync($"""
            CREATE TRIGGER [{FailInsertTriggerName}]
            ON [TransactionDeletionAudits]
            AFTER INSERT
            AS
            BEGIN
                SET NOCOUNT ON;
                THROW 51001, 'Injected audit failure.', 1;
            END
            """);
    }

    private async Task DropFailingAuditInsertTriggerAsync()
    {
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await dbContext.Database.ExecuteSqlRawAsync(
            $"IF OBJECT_ID(N'[{FailInsertTriggerName}]', N'TR') IS NOT NULL DROP TRIGGER [{FailInsertTriggerName}];");
    }

    private async Task<TransactionSnapshot> GetTransactionSnapshotAsync(Guid transactionId)
    {
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var transaction = await dbContext.Transactions.SingleAsync(entry => entry.Id == transactionId);
        return new TransactionSnapshot(
            transaction.AccountId,
            transaction.TransactionDate,
            transaction.Description,
            transaction.Amount,
            transaction.Direction,
            transaction.Balance,
            transaction.CreatedAtUtc);
    }

    private async Task<Guid> SeedTransactionAsync(Guid accountId, string description)
    {
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.True(Currency.TryGet("AUD", out var currency));
        Assert.True(Transaction.TryCreate(
            accountId,
            new DateOnly(2026, 2, 1),
            description,
            5.55m,
            TransactionDirection.Outgoing,
            50m,
            currency!,
            DateTimeOffset.UtcNow,
            out var transaction));
        dbContext.Transactions.Add(transaction!);
        await dbContext.SaveChangesAsync();
        return transaction!.Id;
    }

    private async Task<string> GetUserIdAsync(string email)
    {
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var user = await dbContext.Users.SingleAsync(entry => entry.Email == email);
        return user.Id;
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
        const string password = "Test-only!Password-123";
        using var register = await SendJsonAsync(
            client,
            HttpMethod.Post,
            "/api/security/register",
            new { email, password });
        Assert.Equal(HttpStatusCode.Created, register.StatusCode);

        using var login = await SendJsonAsync(
            client,
            HttpMethod.Post,
            "/api/security/login",
            new { email, password });
        Assert.Equal(HttpStatusCode.NoContent, login.StatusCode);
        return email;
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

    private static async Task<HttpResponseMessage> SendDeleteAsync(
        HttpClient client,
        Guid accountId,
        Guid transactionId)
    {
        using var tokenResponse = await client.GetAsync("/api/security/csrf-token");
        tokenResponse.EnsureSuccessStatusCode();
        var token = await tokenResponse.Content.ReadFromJsonAsync<CsrfTokenResponse>();
        Assert.NotNull(token);
        using var request = new HttpRequestMessage(
            HttpMethod.Delete,
            $"/api/accounts/{accountId}/transactions/{transactionId}");
        request.Headers.Add("X-CSRF-TOKEN", token.RequestToken);
        return await client.SendAsync(request);
    }

    private static async Task<HttpResponseMessage> SendJsonAsync(
        HttpClient client,
        HttpMethod method,
        string path,
        object content)
    {
        using var tokenResponse = await client.GetAsync("/api/security/csrf-token");
        tokenResponse.EnsureSuccessStatusCode();
        var token = await tokenResponse.Content.ReadFromJsonAsync<CsrfTokenResponse>();
        Assert.NotNull(token);
        using var request = new HttpRequestMessage(method, path)
        {
            Content = JsonContent.Create(content),
        };
        request.Headers.Add("X-CSRF-TOKEN", token.RequestToken);
        return await client.SendAsync(request);
    }

    private sealed record CsrfTokenResponse(string RequestToken);

    private sealed record AccountResponse(Guid Id);

    private sealed record TransactionSnapshot(
        Guid AccountId,
        DateOnly TransactionDate,
        string Description,
        decimal Amount,
        TransactionDirection Direction,
        decimal? Balance,
        DateTimeOffset CreatedAtUtc);
}
