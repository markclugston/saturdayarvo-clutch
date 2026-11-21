using System.Diagnostics.Metrics;
using System.Net;
using System.Net.Http.Json;
using Clutch.API.Infrastructure.Persistence;
using Clutch.API.Infrastructure.Identity;
using Clutch.API.Tests.Integration.Accounts;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Clutch.API.Tests.Integration.Preferences;

[Collection(SqlServerCollection.Name)]
public sealed class NavigationPreferenceTests(SqlServerFixture fixture)
{
    private const string Path = "/api/preferences/navigation";

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Unauthenticated_requests_are_rejected()
    {
        using var client = CreateClient();
        using var response = await client.GetAsync(Path);
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Missing_row_reads_unpinned_and_saved_state_round_trips()
    {
        using var client = CreateClient();
        await SignInNewUserAsync(client);

        Assert.Equal("Unpinned", await GetStateAsync(client));

        using var pin = await SendJsonAsync(client, HttpMethod.Put, new { state = "Pinned" });
        Assert.Equal(HttpStatusCode.OK, pin.StatusCode);
        Assert.Equal("Pinned", await GetStateAsync(client));

        using var unpin = await SendJsonAsync(client, HttpMethod.Put, new { state = "Unpinned" });
        Assert.Equal(HttpStatusCode.OK, unpin.StatusCode);
        Assert.Equal("Unpinned", await GetStateAsync(client));
    }

    [Theory]
    [Trait("Category", "SqlServer")]
    [InlineData("{}")]
    [InlineData("{\"state\":null}")]
    [InlineData("{\"state\":\"pinned\"}")]
    [InlineData("{\"state\":\"Expanded\"}")]
    public async Task Invalid_state_is_rejected_saves_nothing_and_records_invalid_outcome(string body)
    {
        using var client = CreateClient();
        await SignInNewUserAsync(client);
        var outcomes = new List<string>();
        using var listener = new MeterListener();
        listener.InstrumentPublished = (instrument, meterListener) =>
        {
            if (instrument.Meter.Name == "Clutch.API.Preferences")
            {
                meterListener.EnableMeasurementEvents(instrument);
            }
        };
        listener.SetMeasurementEventCallback<long>((_, _, tags, _) =>
        {
            foreach (var tag in tags)
            {
                if (tag.Key == "outcome")
                {
                    lock (outcomes)
                    {
                        outcomes.Add((string)tag.Value!);
                    }
                }
            }
        });
        listener.Start();

        using var response = await SendRawAsync(client, body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ProblemBody>();
        Assert.NotNull(problem);
        Assert.Equal("The navigation state is invalid.", problem.Title);
        Assert.Equal("Choose Pinned or Unpinned.", problem.Detail);
        Assert.Equal("Unpinned", await GetStateAsync(client));
        lock (outcomes)
        {
            Assert.Contains("invalid", outcomes);
        }
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Preference_follows_the_account_last_save_wins_and_never_leaks_between_users()
    {
        using var firstClient = CreateClient();
        var email = await SignInNewUserAsync(firstClient);
        using var pin = await SendJsonAsync(firstClient, HttpMethod.Put, new { state = "Pinned" });
        Assert.Equal(HttpStatusCode.OK, pin.StatusCode);

        using var secondClient = CreateClient();
        await SignInAsync(secondClient, email);
        Assert.Equal("Pinned", await GetStateAsync(secondClient));

        using var unpin = await SendJsonAsync(secondClient, HttpMethod.Put, new { state = "Unpinned" });
        Assert.Equal(HttpStatusCode.OK, unpin.StatusCode);
        Assert.Equal("Unpinned", await GetStateAsync(firstClient));
        Assert.Equal("Unpinned", await GetStateAsync(secondClient));

        using var pinAgain = await SendJsonAsync(firstClient, HttpMethod.Put, new { state = "Pinned" });
        Assert.Equal(HttpStatusCode.OK, pinAgain.StatusCode);
        Assert.Equal("Pinned", await GetStateAsync(secondClient));

        using var otherClient = CreateClient();
        await SignInNewUserAsync(otherClient);
        Assert.Equal("Unpinned", await GetStateAsync(otherClient));
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Deleting_the_user_cascades_the_preference_row()
    {
        using var client = CreateClient();
        var email = await SignInNewUserAsync(client);
        using var pin = await SendJsonAsync(client, HttpMethod.Put, new { state = "Pinned" });
        Assert.Equal(HttpStatusCode.OK, pin.StatusCode);

        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var user = await users.FindByEmailAsync(email);
        Assert.NotNull(user);
        Assert.True(await dbContext.UserNavigationPreferences.AnyAsync(p => p.UserId == user.Id));

        var result = await users.DeleteAsync(user);

        Assert.True(result.Succeeded);
        Assert.False(await dbContext.UserNavigationPreferences.AsNoTracking()
            .AnyAsync(p => p.UserId == user.Id));
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Migration_has_created_the_table_with_its_check_constraint()
    {
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var applied = await dbContext.Database.GetAppliedMigrationsAsync();

        Assert.Contains(applied, name => name.EndsWith("_AddNavigationPreferences", StringComparison.Ordinal));
        var constraints = await dbContext.Database
            .SqlQueryRaw<string>(
                "SELECT name AS Value FROM sys.check_constraints WHERE name = 'CK_UserNavigationPreferences_State'")
            .ToListAsync();
        Assert.Single(constraints);
    }

    private HttpClient CreateClient() =>
        fixture.Factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost"),
            AllowAutoRedirect = false,
        });

    private static async Task<string> SignInNewUserAsync(HttpClient client)
    {
        var email = $"{Guid.NewGuid():N}@example.test";
        using var response = await SendJsonAsync(
            client,
            HttpMethod.Post,
            "/api/security/register",
            new { email, password = "Test-only!Password-123" });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        await SignInAsync(client, email);
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

    private static async Task<string> GetStateAsync(HttpClient client)
    {
        using var response = await client.GetAsync(Path);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var preference = await response.Content.ReadFromJsonAsync<NavigationPreferenceResponse>();
        Assert.NotNull(preference);
        return preference.State;
    }

    private static Task<HttpResponseMessage> SendJsonAsync(
        HttpClient client,
        HttpMethod method,
        object content) =>
        SendJsonAsync(client, method, Path, content);

    private static async Task<HttpResponseMessage> SendJsonAsync(
        HttpClient client,
        HttpMethod method,
        string path,
        object content)
    {
        var csrfToken = await GetCsrfTokenAsync(client);
        using var request = new HttpRequestMessage(method, path)
        {
            Content = JsonContent.Create(content),
        };
        request.Headers.Add("X-CSRF-TOKEN", csrfToken);
        return await client.SendAsync(request);
    }

    private static async Task<HttpResponseMessage> SendRawAsync(HttpClient client, string json)
    {
        var csrfToken = await GetCsrfTokenAsync(client);
        using var request = new HttpRequestMessage(HttpMethod.Put, Path)
        {
            Content = new StringContent(json, System.Text.Encoding.UTF8, "application/json"),
        };
        request.Headers.Add("X-CSRF-TOKEN", csrfToken);
        return await client.SendAsync(request);
    }

    private static async Task<string> GetCsrfTokenAsync(HttpClient client)
    {
        using var tokenResponse = await client.GetAsync("/api/security/csrf-token");
        tokenResponse.EnsureSuccessStatusCode();
        var csrfToken = await tokenResponse.Content.ReadFromJsonAsync<CsrfTokenResponse>();
        Assert.NotNull(csrfToken);
        return csrfToken.RequestToken;
    }

    private sealed record CsrfTokenResponse(string RequestToken);

    private sealed record NavigationPreferenceResponse(string State);

    private sealed record ProblemBody(string? Title, string? Detail);
}
