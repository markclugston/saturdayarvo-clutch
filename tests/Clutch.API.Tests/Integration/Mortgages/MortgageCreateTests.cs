using System.Net;
using System.Text;
using Clutch.API.Tests.Integration.Accounts;
using Microsoft.EntityFrameworkCore;
using Clutch.API.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using static Clutch.API.Tests.Integration.Mortgages.MortgageTestSupport;

namespace Clutch.API.Tests.Integration.Mortgages;

[Collection(SqlServerCollection.Name)]
public sealed class MortgageCreateTests(SqlServerFixture fixture)
{
    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Create_returns_201_with_location_and_the_saved_values()
    {
        using var client = await SignedInClientAsync(fixture.Factory);

        var created = await CreateAsync(client, Body("  Home loan  "));

        Assert.Equal("Home loan", created.Name);
        Assert.Equal(1, created.Version);
        Assert.Equal(250000.5m, created.OpeningBalance);
        Assert.Equal("Monthly", created.PaymentFrequency);
        Assert.Equal(created.Id, Assert.Single(await ListAsync(client)).Id);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Signed_out_request_with_a_valid_token_is_unauthorized_and_missing_csrf_header_is_rejected()
    {
        using var anonymous = CreateClient(fixture.Factory);
        using var signedOut = await SendAsync(anonymous, HttpMethod.Post, "/api/mortgages", Body());
        Assert.Equal(HttpStatusCode.Unauthorized, signedOut.StatusCode);

        using var client = await SignedInClientAsync(fixture.Factory);
        using var noToken = await SendAsync(client, HttpMethod.Post, "/api/mortgages", Body(), withCsrf: false);
        Assert.Equal(HttpStatusCode.BadRequest, noToken.StatusCode);
        Assert.Equal("A valid anti-forgery token is required.", (await ProblemAsync(noToken)).Title);
        Assert.Empty(await ListAsync(client));
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Duplicate_names_ignoring_case_and_spaces_are_rejected()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        await CreateAsync(client, Body("Home loan"));

        using var response = await SendAsync(client, HttpMethod.Post, "/api/mortgages", Body(" home LOAN "));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await ProblemAsync(response);
        Assert.Equal("The mortgage is invalid.", problem.Title);
        Assert.Equal("A mortgage with this name already exists", problem.Errors!["name"][0]);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task The_21st_mortgage_and_a_61st_rate_change_are_rejected()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        for (var index = 0; index < 20; index++)
        {
            await CreateAsync(client, Body($"Loan {index}"));
        }

        using var twentyFirst = await SendAsync(client, HttpMethod.Post, "/api/mortgages", Body("One too many"));
        Assert.Equal(HttpStatusCode.BadRequest, twentyFirst.StatusCode);
        Assert.Equal("You can save up to 20 mortgages", (await ProblemAsync(twentyFirst)).Errors!["mortgages"][0]);

        using var other = await SignedInClientAsync(fixture.Factory);
        var rates = Enumerable.Range(0, 61)
            .Select(day => new { newInterestRate = 5m, effectiveDate = new DateOnly(2000, 1, 1).AddDays(day).ToString("yyyy-MM-dd") })
            .ToArray();
        using var tooMany = await SendAsync(other, HttpMethod.Post, "/api/mortgages", Body(rates: rates));
        Assert.Equal(HttpStatusCode.BadRequest, tooMany.StatusCode);
        Assert.Contains("interestRateChanges", (await ProblemAsync(tooMany)).Errors!.Keys);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Badly_shaped_values_return_field_errors_not_a_json_error()
    {
        using var client = await SignedInClientAsync(fixture.Factory);

        async Task<Dictionary<string, string[]>> ErrorsFor(object body)
        {
            using var response = await SendAsync(client, HttpMethod.Post, "/api/mortgages", body);
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            var problem = await ProblemAsync(response);
            Assert.Equal("The mortgage is invalid.", problem.Title);
            return problem.Errors!;
        }

        Assert.Equal("Enter a whole number of 1 or more", (await ErrorsFor(Body(duration: 1.5m)))["duration"][0]);
        Assert.Equal("Enter a valid date", (await ErrorsFor(Body(disbursalDate: "2000-13-45")))["disbursalDate"][0]);
        Assert.Equal(
            "Choose Weekly, Fortnightly or Monthly",
            (await ErrorsFor(Body(paymentFrequency: "Daily")))["paymentFrequency"][0]);
        Assert.Equal(
            "Enter a opening balance greater than 0",
            (await ErrorsFor(Body(openingBalance: "abc")))["openingBalance"][0]);
        Assert.Equal(
            "Enter a opening balance up to 999,999,999,999.99",
            (await ErrorsFor(Body(openingBalance: 1000000000000.00m)))["openingBalance"][0]);
        Assert.Equal(
            "Enter a valid date",
            (await ErrorsFor(Body(rates: new[]
            {
                new { newInterestRate = 5m, effectiveDate = "2000-01-01" },
                new { newInterestRate = 5m, effectiveDate = "not a date" },
            })))["interestRateChanges[1].effectiveDate"][0]);

        // Numbers too large for decimal are sent as raw JSON.
        async Task<Dictionary<string, string[]>> RawErrors(string json)
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, "/api/mortgages")
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json"),
            };
            using var token = await client.GetAsync("/api/security/csrf-token");
            var text = await token.Content.ReadAsStringAsync();
            request.Headers.Add("X-CSRF-TOKEN", System.Text.Json.JsonDocument.Parse(text).RootElement.GetProperty("requestToken").GetString());
            using var response = await client.SendAsync(request);
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            return (await ProblemAsync(response)).Errors!;
        }

        var hugePeriods = await RawErrors(
            """{"name":"A","openingBalance":10,"duration":1e30,"disbursalDate":"2000-01-01","paymentFrequency":"Monthly","interestRateChanges":[{"newInterestRate":5,"effectiveDate":"2000-01-01"}]}""");
        Assert.Equal(
            "The final repayment date would be later than 31 Dec 9999",
            hugePeriods["duration"][0]);
        var hugeRate = await RawErrors(
            """{"name":"A","openingBalance":10,"duration":12,"disbursalDate":"2000-01-01","paymentFrequency":"Monthly","interestRateChanges":[{"newInterestRate":1e30,"effectiveDate":"2000-01-01"}]}""");
        Assert.Equal(
            "Enter an interest rate from 0 to 100",
            hugeRate["interestRateChanges[0].newInterestRate"][0]);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Malformed_json_gets_a_generic_400()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        using var token = await client.GetAsync("/api/security/csrf-token");
        var text = await token.Content.ReadAsStringAsync();
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/mortgages")
        {
            Content = new StringContent("{ not json", Encoding.UTF8, "application/json"),
        };
        request.Headers.Add("X-CSRF-TOKEN", System.Text.Json.JsonDocument.Parse(text).RootElement.GetProperty("requestToken").GetString());

        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Disbursal_date_bound_uses_the_latest_time_zone()
    {
        var beforeTenUtc = new FixedTimeProvider(new DateTimeOffset(2026, 6, 15, 9, 59, 0, TimeSpan.Zero));
        var atTenUtc = new FixedTimeProvider(new DateTimeOffset(2026, 6, 15, 10, 0, 0, TimeSpan.Zero));
        var body = Body(
            duration: 12,
            disbursalDate: "2026-06-16",
            rates: new[] { new { newInterestRate = 5m, effectiveDate = "2026-06-16" } });

        using (var early = fixture.Factory.WithWebHostBuilder(builder => UseClock(builder, beforeTenUtc)))
        using (var client = await SignedInClientAsync(early))
        using (var response = await SendAsync(client, HttpMethod.Post, "/api/mortgages", body))
        {
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal(
                "Enter a date that is not in the future",
                (await ProblemAsync(response)).Errors!["disbursalDate"][0]);
        }

        using (var late = fixture.Factory.WithWebHostBuilder(builder => UseClock(builder, atTenUtc)))
        using (var client = await SignedInClientAsync(late))
        using (var response = await SendAsync(client, HttpMethod.Post, "/api/mortgages", body))
        {
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        }
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task An_oversized_body_gets_413_never_500()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var rates = Enumerable.Range(0, 10_000)
            .Select(_ => new { newInterestRate = 5m, effectiveDate = "2000-01-01" })
            .ToArray();

        using var response = await SendAsync(client, HttpMethod.Post, "/api/mortgages", Body(rates: rates));

        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, response.StatusCode);
    }

    // Payment N is the disbursal date plus N intervals (022 FR-007): 9999-12-10 + 3 weeks = 9999-12-31.
    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Duration_limit_accepts_the_last_payment_on_31_Dec_9999_and_refuses_one_more()
    {
        using var late = fixture.Factory.WithWebHostBuilder(builder => UseClock(builder, LateClock));
        using var client = await SignedInClientAsync(late);

        await CreateAsync(client, LateWeeklyBody("Last payment on 31 Dec 9999", duration: 3));
        using var refused = await SendAsync(
            client, HttpMethod.Post, "/api/mortgages", LateWeeklyBody("One payment too many", duration: 4));

        Assert.Equal(HttpStatusCode.BadRequest, refused.StatusCode);
        Assert.Equal(
            "The final repayment date would be later than 31 Dec 9999",
            (await ProblemAsync(refused)).Errors!["duration"][0]);
    }

    [Theory]
    [InlineData("2029-12-31", true)]
    [InlineData("2030-01-01", true)]
    [InlineData("2030-01-02", false)]
    [Trait("Category", "SqlServer")]
    public async Task Effective_date_range_ends_on_the_final_repayment_date(string effectiveDate, bool accepted)
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var body = Body(rates: new[]
        {
            new { newInterestRate = 5m, effectiveDate = "2000-01-01" },
            new { newInterestRate = 4m, effectiveDate },
        });

        using var response = await SendAsync(client, HttpMethod.Post, "/api/mortgages", body);

        if (accepted)
        {
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        }
        else
        {
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal(
                "Choose a date from 1 Jan 2000 to 1 Jan 2030",
                (await ProblemAsync(response)).Errors!["interestRateChanges[1].effectiveDate"][0]);
        }
    }

    internal static readonly TimeProvider LateClock =
        new FixedTimeProvider(new DateTimeOffset(9999, 12, 20, 0, 0, 0, TimeSpan.Zero));

    internal static object LateWeeklyBody(string name, int duration, int? version = null) =>
        Body(
            name,
            duration: duration,
            disbursalDate: "9999-12-10",
            paymentFrequency: "Weekly",
            rates: new[] { new { newInterestRate = 5m, effectiveDate = "9999-12-10" } },
            version: version);

    internal static void UseClock(IWebHostBuilder builder, TimeProvider clock) =>
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<TimeProvider>();
            services.AddSingleton(clock);
        });

    internal sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Create_saves_the_linked_account_and_reload_returns_it_and_one_audit_row_is_written()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var accountId = await CreateAccountAsync(client);

        var created = await CreateAsync(client, Body("Joined loan", accountId: accountId.ToString()));

        Assert.Equal(accountId, created.AccountId);
        Assert.Equal(accountId, Assert.Single(await ListAsync(client)).AccountId);
        var audits = await AuditsAsync(fixture, "Joined loan");
        var audit = Assert.Single(audits);
        Assert.Equal("MortgageCreate", audit.EventCode);
        Assert.DoesNotContain(accountId.ToString(), audit.Description, StringComparison.OrdinalIgnoreCase);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [Trait("Category", "SqlServer")]
    public async Task A_blank_account_id_saves_with_no_link(string? accountId)
    {
        using var client = await SignedInClientAsync(fixture.Factory);

        var created = await CreateAsync(client, Body("Unlinked loan", accountId: accountId));

        Assert.Null(created.AccountId);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task A_foreign_unknown_or_malformed_account_id_is_a_400_account_id_error()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        using var other = await SignedInClientAsync(fixture.Factory);
        var foreign = await CreateAccountAsync(other);

        foreach (var accountId in new[] { foreign.ToString(), Guid.NewGuid().ToString(), "not-a-guid" })
        {
            using var response = await SendAsync(
                client, HttpMethod.Post, "/api/mortgages", Body("Bad link", accountId: accountId));

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal(
                "Choose one of your accounts",
                (await ProblemAsync(response)).Errors!["accountId"][0]);
        }

        Assert.Empty(await ListAsync(client));
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Deleting_the_account_clears_the_link_and_the_mortgage_still_loads()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var accountId = await CreateAccountAsync(client);
        await CreateAsync(client, Body("Orphaned loan", accountId: accountId.ToString()));

        await using (var scope = fixture.Factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.Accounts.Where(account => account.Id == accountId).ExecuteDeleteAsync();
        }

        Assert.Null(Assert.Single(await ListAsync(client)).AccountId);
    }
}
