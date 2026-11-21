using System.Net;
using System.Net.Http.Json;
using Clutch.API.Tests.Integration.Accounts;
using static Clutch.API.Tests.Integration.Mortgages.MortgageTestSupport;

namespace Clutch.API.Tests.Integration.Mortgages;

[Collection(SqlServerCollection.Name)]
public sealed class MortgageUpdateTests(SqlServerFixture fixture)
{
    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Update_returns_200_with_the_next_version_and_replaces_the_rate_change_set()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var created = await CreateAsync(client, Body("Home loan"));

        using var response = await SendAsync(client, HttpMethod.Put, $"/api/mortgages/{created.Id}", Body(
            "Renamed",
            startingBalance: 100m,
            numberOfPeriods: 24,
            repaymentFrequency: "Weekly",
            rates: new[]
            {
                new { newInterestRate = 4m, effectiveDate = "2000-01-01" },
                new { newInterestRate = 6m, effectiveDate = "2000-03-04" },
            },
            version: 1));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = (await response.Content.ReadFromJsonAsync<MortgageDto>())!;
        Assert.Equal(2, updated.Version);
        Assert.Equal("Renamed", updated.Name);
        Assert.Equal("Weekly", updated.RepaymentFrequency);
        Assert.Equal([4m, 6m], updated.InterestRateChanges.Select(change => change.NewInterestRate));
        var listed = Assert.Single(await ListAsync(client));
        Assert.Equal(updated.Version, listed.Version);
        Assert.Equal(100m, listed.StartingBalance);
        Assert.Equal(
            [("2000-01-01", 4m), ("2000-03-04", 6m)],
            listed.InterestRateChanges.Select(change => (change.EffectiveDate, change.NewInterestRate)));
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task An_unchanged_body_still_returns_200_and_bumps_the_version()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var created = await CreateAsync(client, Body("Same"));

        using var response = await SendAsync(client, HttpMethod.Put, $"/api/mortgages/{created.Id}", Body("Same", version: 1));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(2, (await response.Content.ReadFromJsonAsync<MortgageDto>())!.Version);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task A_stale_version_is_a_409_mortgage_changed()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var created = await CreateAsync(client, Body("Stale"));
        using var first = await SendAsync(client, HttpMethod.Put, $"/api/mortgages/{created.Id}", Body("Stale", version: 1));
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);

        using var stale = await SendAsync(client, HttpMethod.Put, $"/api/mortgages/{created.Id}", Body("Stale", version: 1));

        Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);
        var problem = await ProblemAsync(stale);
        Assert.EndsWith("/mortgage-changed", problem.Type);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Concurrent_puts_with_the_same_version_give_one_200_and_one_409_and_one_audit_row()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var name = $"Race {Guid.NewGuid():N}";
        var created = await CreateAsync(client, Body(name));

        var statuses = await Task.WhenAll(Enumerable.Range(0, 2).Select(async index =>
        {
            using var response = await SendAsync(
                client,
                HttpMethod.Put,
                $"/api/mortgages/{created.Id}",
                Body(name, startingBalance: 100 + index, version: 1));
            return response.StatusCode;
        }));

        Assert.Single(statuses, status => status == HttpStatusCode.OK);
        Assert.Single(statuses, status => status == HttpStatusCode.Conflict);
        Assert.Single(await AuditsAsync(fixture, name), audit => audit.EventCode == "MortgageUpdate");
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Another_users_mortgage_is_404_and_signed_out_or_missing_csrf_changes_nothing()
    {
        using var owner = await SignedInClientAsync(fixture.Factory);
        using var other = await SignedInClientAsync(fixture.Factory);
        var created = await CreateAsync(owner, Body("Private"));

        using var cross = await SendAsync(other, HttpMethod.Put, $"/api/mortgages/{created.Id}", Body("Hacked", version: 1));
        Assert.Equal(HttpStatusCode.NotFound, cross.StatusCode);

        using var anonymous = CreateClient(fixture.Factory);
        using var signedOut = await SendAsync(anonymous, HttpMethod.Put, $"/api/mortgages/{created.Id}", Body("X", version: 1));
        Assert.Equal(HttpStatusCode.Unauthorized, signedOut.StatusCode);

        using var noToken = await SendAsync(owner, HttpMethod.Put, $"/api/mortgages/{created.Id}", Body("X", version: 1), withCsrf: false);
        Assert.Equal(HttpStatusCode.BadRequest, noToken.StatusCode);

        Assert.Equal("Private", Assert.Single(await ListAsync(owner)).Name);
        Assert.Equal(1, (await ListAsync(owner))[0].Version);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Validation_is_re_applied_and_renaming_to_an_existing_name_is_a_400()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        await CreateAsync(client, Body("Home loan"));
        var second = await CreateAsync(client, Body("Car loan"));

        using var invalid = await SendAsync(client, HttpMethod.Put, $"/api/mortgages/{second.Id}", Body("Car loan", numberOfPeriods: 0, version: 1));
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);

        using var clash = await SendAsync(client, HttpMethod.Put, $"/api/mortgages/{second.Id}", Body(" home LOAN ", version: 1));
        Assert.Equal(HttpStatusCode.BadRequest, clash.StatusCode);
        Assert.Contains("name", (await ProblemAsync(clash)).Errors!.Keys);

        using var missingVersion = await SendAsync(client, HttpMethod.Put, $"/api/mortgages/{second.Id}", Body("Car loan"));
        Assert.Equal(HttpStatusCode.BadRequest, missingVersion.StatusCode);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Concurrent_renames_to_the_same_name_give_one_200_and_one_400()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var first = await CreateAsync(client, Body("One"));
        var second = await CreateAsync(client, Body("Two"));

        var statuses = await Task.WhenAll(new[] { first, second }.Select(async mortgage =>
        {
            using var response = await SendAsync(
                client,
                HttpMethod.Put,
                $"/api/mortgages/{mortgage.Id}",
                Body("Shared", version: 1));
            if (response.StatusCode == HttpStatusCode.BadRequest)
            {
                Assert.Contains("name", (await ProblemAsync(response)).Errors!.Keys);
            }

            return response.StatusCode;
        }));

        Assert.Single(statuses, status => status == HttpStatusCode.OK);
        Assert.Single(statuses, status => status == HttpStatusCode.BadRequest);
        Assert.Single(await ListAsync(client), mortgage => mortgage.Name == "Shared");
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task A_body_over_32_KB_is_413_on_put()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var created = await CreateAsync(client, Body("Big"));
        var rates = Enumerable.Range(0, 10_000)
            .Select(_ => new { newInterestRate = 5m, effectiveDate = "2000-01-01" })
            .ToArray();

        using var response = await SendAsync(client, HttpMethod.Put, $"/api/mortgages/{created.Id}", Body("Big", rates: rates, version: 1));

        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, response.StatusCode);
    }
}
