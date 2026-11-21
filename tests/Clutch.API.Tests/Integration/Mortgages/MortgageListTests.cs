using System.Net;
using Clutch.API.Tests.Integration.Accounts;
using static Clutch.API.Tests.Integration.Mortgages.MortgageTestSupport;

namespace Clutch.API.Tests.Integration.Mortgages;

[Collection(SqlServerCollection.Name)]
public sealed class MortgageListTests(SqlServerFixture fixture)
{
    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Anonymous_request_is_unauthorized()
    {
        using var client = CreateClient(fixture.Factory);
        using var response = await client.GetAsync("/api/mortgages");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task List_is_owner_only_in_creation_order_with_rate_changes_by_effective_date()
    {
        using var owner = await SignedInClientAsync(fixture.Factory);
        using var other = await SignedInClientAsync(fixture.Factory);
        await CreateAsync(owner, Body("First"));
        await CreateAsync(owner, Body(
            "Second",
            rates: new[]
            {
                new { newInterestRate = 7m, effectiveDate = "2001-01-01" },
                new { newInterestRate = 5m, effectiveDate = "2000-01-01" },
                new { newInterestRate = 6m, effectiveDate = "2000-06-01" },
            }));
        await CreateAsync(other, Body("Not yours"));

        var list = await ListAsync(owner);

        Assert.Equal(["First", "Second"], list.Select(item => item.Name));
        Assert.Equal(
            ["2000-01-01", "2000-06-01", "2001-01-01"],
            list[1].InterestRateChanges.Select(change => change.EffectiveDate));
        Assert.Equal([5m, 6m, 7m], list[1].InterestRateChanges.Select(change => change.NewInterestRate));
        Assert.All(list, item => Assert.Equal(1, item.Version));
        Assert.Equal(["Not yours"], (await ListAsync(other)).Select(item => item.Name));
    }
}
