using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Clutch.API.Tests.Integration.Accounts;

[Collection(SqlServerCollection.Name)]
public sealed class FamilyAccountAuthorizationTests(SqlServerFixture fixture)
{
    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Signing_in_requires_a_fresh_antiforgery_token_for_family_creation()
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

        using var tokenResponse = await client.GetAsync("/api/security/csrf-token");
        tokenResponse.EnsureSuccessStatusCode();
        var token = await tokenResponse.Content.ReadFromJsonAsync<CsrfTokenResponse>();
        Assert.NotNull(token);
        using var loginRequest = new HttpRequestMessage(HttpMethod.Post, "/api/security/login")
        {
            Content = JsonContent.Create(new { email, password }),
        };
        loginRequest.Headers.Add("X-CSRF-TOKEN", token.RequestToken);
        using var login = await client.SendAsync(loginRequest);
        Assert.Equal(HttpStatusCode.NoContent, login.StatusCode);

        using var staleRequest = new HttpRequestMessage(HttpMethod.Post, "/api/families");
        staleRequest.Headers.Add("X-CSRF-TOKEN", token.RequestToken);
        using var staleResponse = await client.SendAsync(staleRequest);
        Assert.Equal(HttpStatusCode.BadRequest, staleResponse.StatusCode);

        using var freshResponse = await SendJsonAsync(client, HttpMethod.Post, "/api/families", null);
        Assert.Equal(HttpStatusCode.Created, freshResponse.StatusCode);
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
        await CreateFamilyAsync(client);

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
    public async Task Owner_cannot_create_a_second_family()
    {
        using var client = CreateClient();
        await RegisterAndSignInAsync(client);
        using var firstResponse = await SendJsonAsync(
            client,
            HttpMethod.Post,
            "/api/families",
            content: null);
        Assert.Equal(HttpStatusCode.Created, firstResponse.StatusCode);

        using var secondResponse = await SendJsonAsync(
            client,
            HttpMethod.Post,
            "/api/families",
            content: null);
        Assert.Equal(HttpStatusCode.Conflict, secondResponse.StatusCode);
        Assert.Single(await GetFamiliesAsync(client));
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Sensitive_descriptions_are_rejected_without_echo_and_accounts_are_owner_only()
    {
        using var owner = CreateClient();
        await RegisterAndSignInAsync(owner);
        await CreateFamilyAsync(owner);

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
        using var forbiddenFamily = await otherUser.GetAsync("/api/families");
        using var forbiddenAccount = await otherUser.GetAsync($"/api/accounts/{account.Id}");

        Assert.Equal(HttpStatusCode.OK, forbiddenFamily.StatusCode);
        Assert.Equal("[]", await forbiddenFamily.Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.NotFound, forbiddenAccount.StatusCode);
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

    private static async Task<FamilyResponse[]> GetFamiliesAsync(HttpClient client)
    {
        using var response = await client.GetAsync("/api/families");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var families = await response.Content.ReadFromJsonAsync<FamilyResponse[]>();
        Assert.NotNull(families);
        return families;
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

    private sealed record FamilyResponse(Guid Id, string OwnerUserId);

    private sealed record AccountResponse(
        Guid Id,
        Guid FamilyId,
        string Description,
        string CurrencyCode,
        DateTimeOffset? LastSuccessfulImportAtUtc);
}
