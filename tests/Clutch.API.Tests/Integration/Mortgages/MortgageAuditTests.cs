using System.Net;
using Clutch.API.Tests.Integration.Accounts;
using static Clutch.API.Tests.Integration.Mortgages.MortgageTestSupport;

namespace Clutch.API.Tests.Integration.Mortgages;

[Collection(SqlServerCollection.Name)]
public sealed class MortgageAuditTests(SqlServerFixture fixture)
{
    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Each_create_update_rename_unchanged_save_and_delete_writes_exactly_one_audit_row_without_amounts()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var tag = Guid.NewGuid().ToString("N")[..8];
        var original = $"Audit {tag}";
        var renamed = $"Renamed {tag}";
        var created = await CreateAsync(client, Body(original, openingBalance: 123456.78m));

        using var unchanged = await SendAsync(client, HttpMethod.Put, $"/api/mortgages/{created.Id}", Body(original, openingBalance: 123456.78m, version: 1));
        Assert.Equal(HttpStatusCode.OK, unchanged.StatusCode);
        using var rename = await SendAsync(client, HttpMethod.Put, $"/api/mortgages/{created.Id}", Body(renamed, openingBalance: 123456.78m, version: 2));
        Assert.Equal(HttpStatusCode.OK, rename.StatusCode);
        using var delete = await SendAsync(client, HttpMethod.Delete, $"/api/mortgages/{created.Id}?version=3", null);
        Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);

        var audits = (await AuditsAsync(fixture, tag)).OrderBy(audit => audit.EventCode).ToList();

        Assert.Equal(
            ["MortgageCreate", "MortgageDelete", "MortgageUpdate", "MortgageUpdate"],
            audits.Select(audit => audit.EventCode));
        Assert.Contains(audits, audit => audit.Description == $"Mortgage {original} was created.");
        Assert.Contains(audits, audit => audit.Description == $"Mortgage {original} was updated.");
        Assert.Contains(
            audits,
            audit => audit.Description == $"Mortgage {renamed} was updated, renamed from {original} to {renamed}.");
        Assert.Contains(audits, audit => audit.Description == $"Mortgage {renamed} was deleted.");
        Assert.All(audits, audit =>
        {
            Assert.DoesNotContain("123456", audit.Description);
            Assert.DoesNotContain("5.25", audit.Description);
        });
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Rejected_writes_leave_no_audit_row()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var tag = Guid.NewGuid().ToString("N")[..8];
        var created = await CreateAsync(client, Body($"Quiet {tag}"));
        using var invalid = await SendAsync(client, HttpMethod.Put, $"/api/mortgages/{created.Id}", Body($"Quiet {tag}", duration: 0, version: 1));
        using var stale = await SendAsync(client, HttpMethod.Put, $"/api/mortgages/{created.Id}", Body($"Quiet {tag}", version: 9));

        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);
        Assert.Single(await AuditsAsync(fixture, tag));
    }
}
