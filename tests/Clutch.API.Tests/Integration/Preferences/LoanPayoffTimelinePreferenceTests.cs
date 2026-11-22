using System.Diagnostics.Metrics;
using System.Net;
using System.Net.Http.Json;
using Clutch.API.Infrastructure.Identity;
using Clutch.API.Infrastructure.Persistence;
using Clutch.API.Tests.Integration.Accounts;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Clutch.API.Tests.Integration.Preferences;

[Collection(SqlServerCollection.Name)]
public sealed class LoanPayoffTimelinePreferenceTests(SqlServerFixture fixture)
{
    private const string Path = "/api/preferences/loan-payoff-timeline";
    private const string PrecedingMigration = "20261121084453_RenameMortgageDetailFields";
    private const string InvalidTitle = "The loan payoff timeline view is invalid.";
    private const string InvalidDetail = "Choose Burndown or Schedule.";
    private const string ValidClientId = "3f2b8c1e-5d7a-4c2e-9b1f-0a6d4e8c7b21";

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Unauthenticated_read_is_rejected()
    {
        using var client = CreateClient();
        using var response = await client.GetAsync(Path);
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Unauthenticated_save_is_rejected()
    {
        using var anonymous = CreateClient();

        // Take a valid antiforgery token anonymously so only authentication is missing.
        using var response = await SaveAsync(anonymous, "Schedule", Guid.NewGuid(), 1);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Missing_row_reads_burndown_and_a_save_is_read_by_another_client_of_the_same_user()
    {
        using var firstClient = CreateClient();
        var email = await SignInNewUserAsync(firstClient);

        Assert.Equal("Burndown", await GetViewAsync(firstClient));

        using var save = await SaveAsync(firstClient, "Schedule", Guid.NewGuid(), 1);
        Assert.Equal(HttpStatusCode.OK, save.StatusCode);
        Assert.Equal("Schedule", await ReadViewAsync(save));

        using var secondClient = CreateClient();
        await SignInAsync(secondClient, email);
        Assert.Equal("Schedule", await GetViewAsync(secondClient));
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Save_without_an_antiforgery_token_is_rejected_and_saves_nothing()
    {
        using var client = CreateClient();
        await SignInNewUserAsync(client);
        using var request = new HttpRequestMessage(HttpMethod.Put, Path)
        {
            Content = JsonContent.Create(new { view = "Schedule", clientId = Guid.NewGuid(), clientSequence = 1 }),
        };

        using var response = await client.SendAsync(request);

        Assert.Contains(response.StatusCode, new[] { HttpStatusCode.BadRequest, HttpStatusCode.Forbidden });
        Assert.Equal("Burndown", await GetViewAsync(client));
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task One_users_view_is_never_read_by_another_user()
    {
        using var firstClient = CreateClient();
        await SignInNewUserAsync(firstClient);
        using var save = await SaveAsync(firstClient, "Schedule", Guid.NewGuid(), 1);
        Assert.Equal(HttpStatusCode.OK, save.StatusCode);

        using var otherClient = CreateClient();
        await SignInNewUserAsync(otherClient);

        Assert.Equal("Burndown", await GetViewAsync(otherClient));
        Assert.Equal("Schedule", await GetViewAsync(firstClient));
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Deleting_the_user_cascades_the_preference_row()
    {
        using var client = CreateClient();
        var email = await SignInNewUserAsync(client);
        using var save = await SaveAsync(client, "Schedule", Guid.NewGuid(), 1);
        Assert.Equal(HttpStatusCode.OK, save.StatusCode);

        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var user = await users.FindByEmailAsync(email);
        Assert.NotNull(user);
        Assert.True(await dbContext.UserLoanPayoffTimelinePreferences.AnyAsync(p => p.UserId == user.Id));

        var result = await users.DeleteAsync(user);

        Assert.True(result.Succeeded);
        Assert.False(await dbContext.UserLoanPayoffTimelinePreferences.AsNoTracking()
            .AnyAsync(p => p.UserId == user.Id));
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Migration_creates_the_table_with_its_constraints_and_down_drops_it()
    {
        var databaseName = $"LoanPayoffTimelineMigration_{Guid.NewGuid():N}";
        var adminConnectionString = new SqlConnectionStringBuilder(fixture.ConnectionString)
        {
            InitialCatalog = "master",
        };
        var targetConnectionString = new SqlConnectionStringBuilder(fixture.ConnectionString)
        {
            InitialCatalog = databaseName,
        };

        await ExecuteAsync(adminConnectionString.ConnectionString, $"CREATE DATABASE [{databaseName}]");
        try
        {
            await using var dbContext = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
                .UseSqlServer(targetConnectionString.ConnectionString)
                .Options);
            await dbContext.Database.MigrateAsync(PrecedingMigration);
            Assert.Equal(0, await CountTableAsync(dbContext));

            await dbContext.Database.MigrateAsync();

            Assert.Equal(1, await CountTableAsync(dbContext));
            Assert.Equal(2, await dbContext.Database.SqlQuery<int>(
                $"SELECT COUNT(*) AS [Value] FROM sys.check_constraints WHERE [name] IN ('CK_UserLoanPayoffTimelinePreferences_View', 'CK_UserLoanPayoffTimelinePreferences_ClientSequence')")
                .SingleAsync());
            Assert.Equal(1, await dbContext.Database.SqlQuery<int>(
                $"SELECT COUNT(*) AS [Value] FROM sys.foreign_keys WHERE [name] = 'FK_UserLoanPayoffTimelinePreferences_AspNetUsers_UserId' AND [delete_referential_action_desc] = 'CASCADE'")
                .SingleAsync());

            await dbContext.Database.MigrateAsync(PrecedingMigration);

            Assert.Equal(0, await CountTableAsync(dbContext));
        }
        finally
        {
            await ExecuteAsync(
                adminConnectionString.ConnectionString,
                $"ALTER DATABASE [{databaseName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{databaseName}]");
        }
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task An_older_save_from_the_same_page_arriving_late_is_superseded()
    {
        using var client = CreateClient();
        await SignInNewUserAsync(client);
        var clientId = Guid.NewGuid();
        using var outcomes = new OutcomeRecorder();

        using var newer = await SaveAsync(client, "Schedule", clientId, 2);
        Assert.Equal(HttpStatusCode.OK, newer.StatusCode);
        using var older = await SaveAsync(client, "Burndown", clientId, 1);
        Assert.Equal(HttpStatusCode.OK, older.StatusCode);
        Assert.Equal("Schedule", await ReadViewAsync(older));

        // The same sequence again is not newer either.
        using var repeated = await SaveAsync(client, "Burndown", clientId, 2);
        Assert.Equal("Schedule", await ReadViewAsync(repeated));

        Assert.Equal("Schedule", await GetViewAsync(client));
        Assert.Contains("superseded", outcomes.Snapshot());
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Many_parallel_saves_from_one_page_end_with_the_highest_sequence()
    {
        using var client = CreateClient();
        await SignInNewUserAsync(client);
        var clientId = Guid.NewGuid();

        // Odd sequences save Burndown, even ones Schedule; the highest (12) is Schedule.
        var responses = await Task.WhenAll(Enumerable.Range(1, 12)
            .Select(sequence => SaveAsync(client, sequence % 2 == 0 ? "Schedule" : "Burndown", clientId, sequence)));
        try
        {
            Assert.All(responses, response => Assert.Equal(HttpStatusCode.OK, response.StatusCode));
        }
        finally
        {
            foreach (var response in responses)
            {
                response.Dispose();
            }
        }

        Assert.Equal("Schedule", await GetViewAsync(client));
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Saves_from_different_pages_or_devices_apply_in_commit_order()
    {
        using var firstClient = CreateClient();
        var email = await SignInNewUserAsync(firstClient);
        using var secondClient = CreateClient();
        await SignInAsync(secondClient, email);
        var firstPage = Guid.NewGuid();
        var secondPage = Guid.NewGuid();

        using var first = await SaveAsync(firstClient, "Schedule", firstPage, 5);
        Assert.Equal("Schedule", await ReadViewAsync(first));

        // A lower sequence from a different page still wins: it is the most recent save.
        using var second = await SaveAsync(secondClient, "Burndown", secondPage, 1);
        Assert.Equal("Burndown", await ReadViewAsync(second));
        Assert.Equal("Burndown", await GetViewAsync(firstClient));

        using var third = await SaveAsync(firstClient, "Schedule", firstPage, 6);
        Assert.Equal("Schedule", await ReadViewAsync(third));
        Assert.Equal("Schedule", await GetViewAsync(secondClient));
    }

    [Theory]
    [Trait("Category", "SqlServer")]
    [InlineData("{\"clientId\":\"" + ValidClientId + "\",\"clientSequence\":1}")]
    [InlineData("{\"view\":null,\"clientId\":\"" + ValidClientId + "\",\"clientSequence\":1}")]
    [InlineData("{\"view\":\"schedule\",\"clientId\":\"" + ValidClientId + "\",\"clientSequence\":1}")]
    [InlineData("{\"view\":\"Table\",\"clientId\":\"" + ValidClientId + "\",\"clientSequence\":1}")]
    [InlineData("{\"view\":5,\"clientId\":\"" + ValidClientId + "\",\"clientSequence\":1}")]
    [InlineData("{\"view\":{},\"clientId\":\"" + ValidClientId + "\",\"clientSequence\":1}")]
    [InlineData("{\"view\":\"Schedule\",\"clientSequence\":1}")]
    [InlineData("{\"view\":\"Schedule\",\"clientId\":\"not-a-guid\",\"clientSequence\":1}")]
    [InlineData("{\"view\":\"Schedule\",\"clientId\":5,\"clientSequence\":1}")]
    [InlineData("{\"view\":\"Schedule\",\"clientId\":\"00000000-0000-0000-0000-000000000000\",\"clientSequence\":1}")]
    [InlineData("{\"view\":\"Schedule\",\"clientId\":\"" + ValidClientId + "\"}")]
    [InlineData("{\"view\":\"Schedule\",\"clientId\":\"" + ValidClientId + "\",\"clientSequence\":0}")]
    [InlineData("{\"view\":\"Schedule\",\"clientId\":\"" + ValidClientId + "\",\"clientSequence\":-1}")]
    [InlineData("{\"view\":\"Schedule\",\"clientId\":\"" + ValidClientId + "\",\"clientSequence\":9007199254740992}")]
    [InlineData("{\"view\":\"Schedule\",\"clientId\":\"" + ValidClientId + "\",\"clientSequence\":\"1\"}")]
    [InlineData("{\"view\":\"Schedule\",\"clientId\":\"" + ValidClientId + "\",\"clientSequence\":1.5}")]
    [InlineData("[]")]
    [InlineData("")]
    [InlineData("{\"view\":")]
    public async Task Invalid_request_is_rejected_saves_nothing_and_records_invalid_outcome(string body)
    {
        using var client = CreateClient();
        await SignInNewUserAsync(client);
        using var outcomes = new OutcomeRecorder();

        using var response = await SendRawAsync(client, body);

        await AssertInvalidAsync(response);
        Assert.Equal("Burndown", await GetViewAsync(client));
        Assert.Contains("invalid", outcomes.Snapshot());
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Largest_allowed_sequence_is_accepted()
    {
        using var client = CreateClient();
        await SignInNewUserAsync(client);

        using var response = await SendRawAsync(
            client,
            "{\"view\":\"Schedule\",\"clientId\":\"" + ValidClientId + "\",\"clientSequence\":9007199254740991}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Schedule", await GetViewAsync(client));
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Oversized_body_is_rejected_as_invalid_and_saves_nothing()
    {
        using var client = CreateClient();
        await SignInNewUserAsync(client);
        var body = "{\"view\":\"Schedule\",\"clientId\":\"" + ValidClientId
            + "\",\"clientSequence\":1,\"padding\":\"" + new string('x', 1100) + "\"}";

        using var response = await SendRawAsync(client, body);

        await AssertInvalidAsync(response);
        Assert.Equal("Burndown", await GetViewAsync(client));
    }

    private static async Task AssertInvalidAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ProblemBody>();
        Assert.NotNull(problem);
        Assert.Equal(InvalidTitle, problem.Title);
        Assert.Equal(InvalidDetail, problem.Detail);
    }

    private static Task<int> CountTableAsync(AppDbContext dbContext) =>
        dbContext.Database.SqlQuery<int>(
            $"SELECT COUNT(*) AS [Value] FROM sys.tables WHERE [name] = 'UserLoanPayoffTimelinePreferences'")
            .SingleAsync();

    private static async Task ExecuteAsync(string connectionString, string sql)
    {
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        await command.ExecuteNonQueryAsync();
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

    private static async Task<string> GetViewAsync(HttpClient client)
    {
        using var response = await client.GetAsync(Path);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await ReadViewAsync(response);
    }

    private static async Task<string> ReadViewAsync(HttpResponseMessage response)
    {
        var preference = await response.Content.ReadFromJsonAsync<PreferenceResponse>();
        Assert.NotNull(preference);
        return preference.View;
    }

    private static Task<HttpResponseMessage> SaveAsync(
        HttpClient client,
        string view,
        Guid clientId,
        long clientSequence) =>
        SendJsonAsync(client, HttpMethod.Put, Path, new { view, clientId, clientSequence });

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

    /// <summary>Collects loan payoff timeline save outcomes recorded while it is alive.</summary>
    private sealed class OutcomeRecorder : IDisposable
    {
        private readonly MeterListener _listener = new();
        private readonly List<string> _outcomes = [];

        public OutcomeRecorder()
        {
            _listener.InstrumentPublished = (instrument, meterListener) =>
            {
                if (instrument.Name == "clutch.preference.loan_payoff_timeline.save.outcomes")
                {
                    meterListener.EnableMeasurementEvents(instrument);
                }
            };
            _listener.SetMeasurementEventCallback<long>((_, _, tags, _) =>
            {
                foreach (var tag in tags)
                {
                    if (tag.Key == "outcome")
                    {
                        lock (_outcomes)
                        {
                            _outcomes.Add((string)tag.Value!);
                        }
                    }
                }
            });
            _listener.Start();
        }

        public string[] Snapshot()
        {
            lock (_outcomes)
            {
                return [.. _outcomes];
            }
        }

        public void Dispose() => _listener.Dispose();
    }

    private sealed record CsrfTokenResponse(string RequestToken);

    private sealed record PreferenceResponse(string View);

    private sealed record ProblemBody(string? Title, string? Detail);
}
