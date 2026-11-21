using System.Net;
using Clutch.API.Tests.Integration.Accounts;
using static Clutch.API.Tests.Integration.Mortgages.MortgageTestSupport;

namespace Clutch.API.Tests.Integration.Mortgages;

[Collection(SqlServerCollection.Name)]
public sealed class MortgageCreateConcurrencyTests(SqlServerFixture fixture)
{
    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Concurrent_creates_never_exceed_the_limit_or_duplicate_a_name()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        for (var index = 0; index < 18; index++)
        {
            await CreateAsync(client, Body($"Seed {index}"));
        }

        var responses = await Task.WhenAll(Enumerable.Range(0, 6).Select(async index =>
        {
            using var response = await SendAsync(client, HttpMethod.Post, "/api/mortgages", Body($"Racer {index}"));
            var keys = response.StatusCode == HttpStatusCode.BadRequest
                ? (await ProblemAsync(response)).Errors!.Keys.ToList()
                : [];
            return (response.StatusCode, Keys: keys);
        }));

        Assert.Equal(2, responses.Count(item => item.StatusCode == HttpStatusCode.Created));
        Assert.All(
            responses.Where(item => item.StatusCode != HttpStatusCode.Created),
            item =>
            {
                Assert.Equal(HttpStatusCode.BadRequest, item.StatusCode);
                Assert.Contains(item.Keys, key => key is "mortgages" or "name");
            });
        Assert.Equal(20, (await ListAsync(client)).Count);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Concurrent_creates_of_the_same_name_produce_one_mortgage_and_one_audit_row()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var name = $"Twin {Guid.NewGuid():N}";

        var statuses = await Task.WhenAll(Enumerable.Range(0, 4).Select(async _ =>
        {
            using var response = await SendAsync(client, HttpMethod.Post, "/api/mortgages", Body(name));
            if (response.StatusCode == HttpStatusCode.BadRequest)
            {
                Assert.Contains("name", (await ProblemAsync(response)).Errors!.Keys);
            }

            return response.StatusCode;
        }));

        Assert.Single(statuses, status => status == HttpStatusCode.Created);
        Assert.All(statuses, status => Assert.True(status is HttpStatusCode.Created or HttpStatusCode.BadRequest));
        Assert.Single(await ListAsync(client));

        var audits = await AuditsAsync(fixture, name);
        var audit = Assert.Single(audits);
        Assert.Equal("MortgageCreate", audit.EventCode);
        Assert.Equal($"Mortgage {name} was created.", audit.Description);
        Assert.DoesNotContain("250000", audit.Description);
    }
}
