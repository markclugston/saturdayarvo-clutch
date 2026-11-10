using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Clutch.API.Domain.Shared;
using Clutch.API.Domain.Transactions;
using Clutch.API.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Clutch.API.Tests.Integration.Accounts;

[Collection(SqlServerCollection.Name)]
public sealed class FamilyAccountAuthorizationTests(SqlServerFixture fixture)
{
    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Removed_family_routes_are_not_available()
    {
        using var client = CreateClient();
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

        using var listResponse = await client.GetAsync("/api/families");
        using var createResponse = await SendJsonAsync(client, HttpMethod.Post, "/api/families", null);
        Assert.Equal(HttpStatusCode.NotFound, listResponse.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, createResponse.StatusCode);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Registration_failure_provides_safe_guidance_without_disclosing_account_existence()
    {
        using var client = CreateClient();
        var email = $"{Guid.NewGuid():N}@example.test";
        const string password = "Test-only!Password-123";
        using var weakPassword = await SendJsonAsync(
            client,
            HttpMethod.Post,
            "/api/security/register",
            new { email, password = "weak" });
        Assert.Equal(HttpStatusCode.BadRequest, weakPassword.StatusCode);

        using var created = await SendJsonAsync(
            client,
            HttpMethod.Post,
            "/api/security/register",
            new { email, password });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);

        using var duplicate = await SendJsonAsync(
            client,
            HttpMethod.Post,
            "/api/security/register",
            new { email, password });
        Assert.Equal(HttpStatusCode.BadRequest, duplicate.StatusCode);
        var weakBody = await weakPassword.Content.ReadAsStringAsync();
        var duplicateBody = await duplicate.Content.ReadAsStringAsync();
        using var weakProblem = JsonDocument.Parse(weakBody);
        using var duplicateProblem = JsonDocument.Parse(duplicateBody);
        Assert.Equal(
            weakProblem.RootElement.GetProperty("title").GetString(),
            duplicateProblem.RootElement.GetProperty("title").GetString());
        Assert.Equal(
            weakProblem.RootElement.GetProperty("detail").GetString(),
            duplicateProblem.RootElement.GetProperty("detail").GetString());
        Assert.Contains("password meets the requirements", weakBody, StringComparison.Ordinal);
        Assert.DoesNotContain(email, weakBody, StringComparison.Ordinal);
        Assert.DoesNotContain("weak", weakBody, StringComparison.Ordinal);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Owner_can_create_accounts_and_edit_descriptions_without_changing_currency()
    {
        using var client = CreateClient();
        await RegisterAndSignInAsync(client);

        var first = await CreateAccountAsync(client, "Daily spending", "AUD");
        var second = await CreateAccountAsync(client, "Travel savings", "NZD");

        Assert.NotEqual(first.Id, second.Id);
        Assert.Equal("AUD", first.CurrencyCode);
        Assert.Equal("NZD", second.CurrencyCode);

        using var response = await SendJsonAsync(
            client,
            HttpMethod.Patch,
            $"/api/accounts/{first.Id}",
            new { description = "Household spending" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = await response.Content.ReadFromJsonAsync<AccountResponse>();
        Assert.NotNull(updated);
        Assert.Equal("Household spending", updated.Description);
        Assert.Equal("AUD", updated.CurrencyCode);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Same_owner_can_access_accounts_from_separate_sessions()
    {
        using var firstSession = CreateClient();
        var (email, password) = await RegisterAndSignInAsync(firstSession);
        var account = await CreateAccountAsync(firstSession, "Shared session", "AUD");
        using var secondSession = CreateClient();
        await SignInAsync(secondSession, email, password);

        using var listResponse = await secondSession.GetAsync("/api/accounts");
        using var accountResponse = await secondSession.GetAsync($"/api/accounts/{account.Id}");
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
        Assert.Equal(HttpStatusCode.OK, accountResponse.StatusCode);
        var accounts = await listResponse.Content.ReadFromJsonAsync<AccountResponse[]>();
        Assert.NotNull(accounts);
        Assert.Contains(accounts, response => response.Id == account.Id);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Sensitive_descriptions_are_rejected_without_echo_and_accounts_are_owner_only()
    {
        using var owner = CreateClient();
        await RegisterAndSignInAsync(owner);

        using var invalidResponse = await SendJsonAsync(
            owner,
            HttpMethod.Post,
            "/api/accounts",
            new { description = "BSB 123456", currencyCode = "AUD" });

        Assert.Equal(HttpStatusCode.BadRequest, invalidResponse.StatusCode);
        var invalidBody = await invalidResponse.Content.ReadAsStringAsync();
        Assert.DoesNotContain("123456", invalidBody, StringComparison.Ordinal);

        var account = await CreateAccountAsync(owner, "Savings", "AUD");
        const string cardPattern = "4000 0000 0000 0000";
        using var cardResponse = await SendJsonAsync(
            owner,
            HttpMethod.Patch,
            $"/api/accounts/{account.Id}",
            new { description = $"Payment {cardPattern}" });
        Assert.Equal(HttpStatusCode.BadRequest, cardResponse.StatusCode);
        Assert.DoesNotContain(
            cardPattern,
            await cardResponse.Content.ReadAsStringAsync(),
            StringComparison.Ordinal);

        using var otherUser = CreateClient();
        await RegisterAndSignInAsync(otherUser);
        using var ownerList = await owner.GetAsync("/api/accounts");
        using var otherUserList = await otherUser.GetAsync("/api/accounts");
        Assert.Equal(HttpStatusCode.OK, ownerList.StatusCode);
        Assert.Equal(HttpStatusCode.OK, otherUserList.StatusCode);
        var otherAccounts = await otherUserList.Content.ReadFromJsonAsync<AccountResponse[]>();
        Assert.NotNull(otherAccounts);
        Assert.Empty(otherAccounts);

        await AddTransactionAsync(account.Id);
        using var ownerAccount = await owner.GetAsync($"/api/accounts/{account.Id}");
        using var forbiddenAccount = await otherUser.GetAsync($"/api/accounts/{account.Id}");
        using var ownerTransactions = await owner.GetAsync(
            $"/api/accounts/{account.Id}/transactions");
        using var forbiddenTransactions = await otherUser.GetAsync(
            $"/api/accounts/{account.Id}/transactions");
        using var forbiddenUpdate = await SendJsonAsync(
            otherUser,
            HttpMethod.Patch,
            $"/api/accounts/{account.Id}",
            new { description = "Not the owner" });

        Assert.Equal(HttpStatusCode.OK, ownerAccount.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, forbiddenAccount.StatusCode);
        Assert.Equal(HttpStatusCode.OK, ownerTransactions.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, forbiddenTransactions.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, forbiddenUpdate.StatusCode);
    }

    private async Task AddTransactionAsync(Guid accountId)
    {
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var account = await dbContext.Accounts.SingleAsync(value => value.Id == accountId);
        Assert.True(Currency.TryGet(account.CurrencyCode, out var currency));
        Assert.True(Transaction.TryCreate(
            accountId,
            new DateOnly(2026, 1, 2),
            "Test transaction",
            12.34m,
            TransactionDirection.Outgoing,
            null,
            currency!,
            DateTimeOffset.UtcNow,
            out var transaction));
        dbContext.Transactions.Add(transaction!);
        await dbContext.SaveChangesAsync();
    }

    private HttpClient CreateClient() =>
        fixture.Factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost"),
            AllowAutoRedirect = false,
        });

    private static async Task<(string Email, string Password)> RegisterAndSignInAsync(HttpClient client)
    {
        var email = $"{Guid.NewGuid():N}@example.test";
        const string password = "Test-only!Password-123";
        using var register = await SendJsonAsync(
            client,
            HttpMethod.Post,
            "/api/security/register",
            new { email, password });
        Assert.Equal(HttpStatusCode.Created, register.StatusCode);

        await SignInAsync(client, email, password);
        return (email, password);
    }

    private static async Task SignInAsync(HttpClient client, string email, string password)
    {
        using var login = await SendJsonAsync(
            client,
            HttpMethod.Post,
            "/api/security/login",
            new { email, password });
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

    private sealed record CsrfTokenResponse(string RequestToken);

    private sealed record AccountResponse(
        Guid Id,
        string Description,
        string CurrencyCode,
        DateTimeOffset? LastSuccessfulImportAtUtc);
}
