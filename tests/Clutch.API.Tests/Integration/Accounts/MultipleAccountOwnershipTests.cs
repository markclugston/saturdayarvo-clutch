using System.Net;
using System.Net.Http.Json;
using Clutch.API.Tests.Integration.Accounts;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Clutch.API.Tests.Integration.Accounts;

[Collection(SqlServerCollection.Name)]
public sealed class MultipleAccountOwnershipTests(SqlServerFixture fixture)
{
    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Accounts_are_individually_available_only_to_their_owner()
    {
        using var owner = CreateClient();
        await RegisterAndSignInAsync(owner);
        var firstAccount = await CreateAccountAsync(owner, "Everyday", "AUD");
        var secondAccount = await CreateAccountAsync(owner, "Savings", "NZD");

        using var ownerListResponse = await owner.GetAsync("/api/accounts");
        Assert.Equal(HttpStatusCode.OK, ownerListResponse.StatusCode);
        var ownerAccounts = await ownerListResponse.Content.ReadFromJsonAsync<AccountResponse[]>();
        Assert.NotNull(ownerAccounts);
        Assert.Contains(ownerAccounts, account => account.Id == firstAccount.Id);
        Assert.Contains(ownerAccounts, account => account.Id == secondAccount.Id);

        using var firstAccountResponse = await owner.GetAsync($"/api/accounts/{firstAccount.Id}");
        using var secondAccountResponse = await owner.GetAsync($"/api/accounts/{secondAccount.Id}");
        Assert.Equal(HttpStatusCode.OK, firstAccountResponse.StatusCode);
        Assert.Equal(HttpStatusCode.OK, secondAccountResponse.StatusCode);

        using var otherUser = CreateClient();
        await RegisterAndSignInAsync(otherUser);
        using var otherListResponse = await otherUser.GetAsync("/api/accounts");
        Assert.Equal(HttpStatusCode.OK, otherListResponse.StatusCode);
        var otherAccounts = await otherListResponse.Content.ReadFromJsonAsync<AccountResponse[]>();
        Assert.NotNull(otherAccounts);
        Assert.Empty(otherAccounts);

        foreach (var account in new[] { firstAccount, secondAccount })
        {
            using var response = await otherUser.GetAsync($"/api/accounts/{account.Id}");
            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }
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

    private sealed record AccountResponse(
        Guid Id,
        string Description,
        string CurrencyCode,
        DateTimeOffset? LastSuccessfulImportAtUtc);
}
