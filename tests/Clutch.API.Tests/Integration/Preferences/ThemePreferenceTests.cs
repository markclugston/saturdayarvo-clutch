using System.Net;
using System.Net.Http.Json;
using Clutch.API.Tests.Integration.Accounts;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Clutch.API.Tests.Integration.Preferences;

[Collection(SqlServerCollection.Name)]
public sealed class ThemePreferenceTests(SqlServerFixture fixture)
{
    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Theme_preferences_are_authenticated_account_scoped_and_replaceable()
    {
        using var firstClient = CreateClient();
        using var anonymousResponse = await firstClient.GetAsync("/api/preferences/theme");
        Assert.Equal(HttpStatusCode.Unauthorized, anonymousResponse.StatusCode);

        var firstEmail = await RegisterAsync(firstClient);
        await SignInAsync(firstClient, firstEmail);
        Assert.Equal("Light", await GetModeAsync(firstClient));

        using var invalidModeResponse = await SendJsonAsync(
            firstClient,
            HttpMethod.Put,
            "/api/preferences/theme",
            new { mode = "dark" });
        Assert.Equal(HttpStatusCode.BadRequest, invalidModeResponse.StatusCode);
        Assert.Equal("Light", await GetModeAsync(firstClient));

        using var missingTokenResponse = await firstClient.PutAsJsonAsync(
            "/api/preferences/theme",
            new { mode = "Dark" });
        Assert.Equal(HttpStatusCode.BadRequest, missingTokenResponse.StatusCode);

        using var firstSaveResponse = await SendJsonAsync(
            firstClient,
            HttpMethod.Put,
            "/api/preferences/theme",
            new { mode = "Dark" });
        Assert.Equal(HttpStatusCode.OK, firstSaveResponse.StatusCode);
        Assert.Equal("Dark", await GetModeAsync(firstClient));

        using var secondClient = CreateClient();
        await SignInAsync(secondClient, firstEmail);
        Assert.Equal("Dark", await GetModeAsync(secondClient));

        using var secondSaveResponse = await SendJsonAsync(
            secondClient,
            HttpMethod.Put,
            "/api/preferences/theme",
            new { mode = "System" });
        Assert.Equal(HttpStatusCode.OK, secondSaveResponse.StatusCode);
        Assert.Equal("System", await GetModeAsync(firstClient));

        using var otherUserClient = CreateClient();
        var otherEmail = await RegisterAsync(otherUserClient);
        await SignInAsync(otherUserClient, otherEmail);
        Assert.Equal("Light", await GetModeAsync(otherUserClient));
    }

    private HttpClient CreateClient() =>
        fixture.Factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost"),
            AllowAutoRedirect = false,
        });

    private static async Task<string> RegisterAsync(HttpClient client)
    {
        var email = $"{Guid.NewGuid():N}@example.test";
        using var response = await SendJsonAsync(
            client,
            HttpMethod.Post,
            "/api/security/register",
            new { email, password = "Test-only!Password-123" });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return email;
    }

    private static async Task SignInAsync(HttpClient client, string email)
    {
        using var response = await SendJsonAsync(
            client,
            HttpMethod.Post,
            "/api/security/login",
            new { email, password = "Test-only!Password-123" });
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    private static async Task<string> GetModeAsync(HttpClient client)
    {
        using var response = await client.GetAsync("/api/preferences/theme");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var preference = await response.Content.ReadFromJsonAsync<ThemePreferenceResponse>();
        Assert.NotNull(preference);
        return preference.Mode;
    }

    private static async Task<HttpResponseMessage> SendJsonAsync(
        HttpClient client,
        HttpMethod method,
        string path,
        object content)
    {
        using var tokenResponse = await client.GetAsync("/api/security/csrf-token");
        tokenResponse.EnsureSuccessStatusCode();
        var csrfToken = await tokenResponse.Content.ReadFromJsonAsync<CsrfTokenResponse>();
        Assert.NotNull(csrfToken);

        using var request = new HttpRequestMessage(method, path)
        {
            Content = JsonContent.Create(content),
        };
        request.Headers.Add("X-CSRF-TOKEN", csrfToken.RequestToken);
        return await client.SendAsync(request);
    }

    private sealed record CsrfTokenResponse(string RequestToken);

    private sealed record ThemePreferenceResponse(string Mode);
}
