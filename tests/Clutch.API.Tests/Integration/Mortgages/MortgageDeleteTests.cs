using System.Net;
using Microsoft.Extensions.DependencyInjection;
using Clutch.API.Tests.Integration.Accounts;
using static Clutch.API.Tests.Integration.Mortgages.MortgageTestSupport;

namespace Clutch.API.Tests.Integration.Mortgages;

[Collection(SqlServerCollection.Name)]
public sealed class MortgageDeleteTests(SqlServerFixture fixture)
{
    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Delete_with_the_current_version_is_204_and_cascades_the_rate_changes()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var created = await CreateAsync(client, Body("Gone"));

        using var response = await SendAsync(client, HttpMethod.Delete, $"/api/mortgages/{created.Id}?version=1", null);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Empty(await ListAsync(client));
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<Clutch.API.Infrastructure.Persistence.AppDbContext>();
        Assert.False(await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.AnyAsync(
            db.MortgageInterestRateChanges,
            change => change.MortgageId == created.Id));
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Missing_version_is_400_stale_is_409_and_other_user_is_404()
    {
        using var owner = await SignedInClientAsync(fixture.Factory);
        using var other = await SignedInClientAsync(fixture.Factory);
        var created = await CreateAsync(owner, Body("Keep"));

        using var missing = await SendAsync(owner, HttpMethod.Delete, $"/api/mortgages/{created.Id}", null);
        Assert.Equal(HttpStatusCode.BadRequest, missing.StatusCode);

        using var stale = await SendAsync(owner, HttpMethod.Delete, $"/api/mortgages/{created.Id}?version=7", null);
        Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);
        Assert.EndsWith("/mortgage-changed", (await ProblemAsync(stale)).Type);

        using var cross = await SendAsync(other, HttpMethod.Delete, $"/api/mortgages/{created.Id}?version=1", null);
        Assert.Equal(HttpStatusCode.NotFound, cross.StatusCode);

        Assert.Single(await ListAsync(owner));
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Signed_out_is_401_and_missing_csrf_deletes_nothing()
    {
        using var owner = await SignedInClientAsync(fixture.Factory);
        var created = await CreateAsync(owner, Body("Safe"));

        using var anonymous = CreateClient(fixture.Factory);
        using var signedOut = await SendAsync(anonymous, HttpMethod.Delete, $"/api/mortgages/{created.Id}?version=1", null);
        Assert.Equal(HttpStatusCode.Unauthorized, signedOut.StatusCode);

        using var noToken = await SendAsync(owner, HttpMethod.Delete, $"/api/mortgages/{created.Id}?version=1", null, withCsrf: false);
        Assert.Equal(HttpStatusCode.BadRequest, noToken.StatusCode);

        Assert.Single(await ListAsync(owner));
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Deleting_an_already_deleted_mortgage_is_404()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var created = await CreateAsync(client, Body("Twice"));
        using var first = await SendAsync(client, HttpMethod.Delete, $"/api/mortgages/{created.Id}?version=1", null);
        Assert.Equal(HttpStatusCode.NoContent, first.StatusCode);

        using var second = await SendAsync(client, HttpMethod.Delete, $"/api/mortgages/{created.Id}?version=1", null);

        Assert.Equal(HttpStatusCode.NotFound, second.StatusCode);
    }
}
