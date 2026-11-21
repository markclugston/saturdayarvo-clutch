using System.Net;
using System.Text;
using Clutch.API.Tests.Integration.Accounts;
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
        Assert.Equal(250000.5m, created.StartingBalance);
        Assert.Equal("Monthly", created.RepaymentFrequency);
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

        Assert.Equal("Enter a whole number of 1 or more", (await ErrorsFor(Body(numberOfPeriods: 1.5m)))["numberOfPeriods"][0]);
        Assert.Equal("Enter a valid date", (await ErrorsFor(Body(firstRepaymentDate: "2000-13-45")))["firstRepaymentDate"][0]);
        Assert.Equal(
            "Choose Weekly, Fortnightly or Monthly",
            (await ErrorsFor(Body(repaymentFrequency: "Daily")))["repaymentFrequency"][0]);
        Assert.Equal(
            "Enter a starting balance greater than 0",
            (await ErrorsFor(Body(startingBalance: "abc")))["startingBalance"][0]);
        Assert.Equal(
            "Enter a starting balance up to 999,999,999,999.99",
            (await ErrorsFor(Body(startingBalance: 1000000000000.00m)))["startingBalance"][0]);
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
            """{"name":"A","startingBalance":10,"numberOfPeriods":1e30,"firstRepaymentDate":"2000-01-01","repaymentFrequency":"Monthly","interestRateChanges":[{"newInterestRate":5,"effectiveDate":"2000-01-01"}]}""");
        Assert.Equal(
            "The final repayment date would be later than 31 Dec 9999",
            hugePeriods["numberOfPeriods"][0]);
        var hugeRate = await RawErrors(
            """{"name":"A","startingBalance":10,"numberOfPeriods":12,"firstRepaymentDate":"2000-01-01","repaymentFrequency":"Monthly","interestRateChanges":[{"newInterestRate":1e30,"effectiveDate":"2000-01-01"}]}""");
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
    public async Task First_repayment_date_bound_uses_the_latest_time_zone()
    {
        var beforeTenUtc = new FixedTimeProvider(new DateTimeOffset(2026, 6, 15, 9, 59, 0, TimeSpan.Zero));
        var atTenUtc = new FixedTimeProvider(new DateTimeOffset(2026, 6, 15, 10, 0, 0, TimeSpan.Zero));
        var body = Body(
            numberOfPeriods: 12,
            firstRepaymentDate: "2026-06-16",
            rates: new[] { new { newInterestRate = 5m, effectiveDate = "2026-06-16" } });

        using (var early = fixture.Factory.WithWebHostBuilder(builder => UseClock(builder, beforeTenUtc)))
        using (var client = await SignedInClientAsync(early))
        using (var response = await SendAsync(client, HttpMethod.Post, "/api/mortgages", body))
        {
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal(
                "Enter a date that is not in the future",
                (await ProblemAsync(response)).Errors!["firstRepaymentDate"][0]);
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

    private static void UseClock(IWebHostBuilder builder, TimeProvider clock) =>
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<TimeProvider>();
            services.AddSingleton(clock);
        });

    internal sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }
}
