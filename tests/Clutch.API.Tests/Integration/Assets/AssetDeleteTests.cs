using System.Collections.Concurrent;
using System.Diagnostics.Metrics;
using System.Net;
using Clutch.API.Tests.Integration.Accounts;
using Microsoft.EntityFrameworkCore;
using static Clutch.API.Tests.Integration.Assets.AssetTestSupport;

namespace Clutch.API.Tests.Integration.Assets;

[Collection(SqlServerCollection.Name)]
public sealed class AssetDeleteTests(SqlServerFixture fixture)
{
    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Delete_removes_the_asset_valuations_and_edits_and_audits_what_was_removed()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var asset = await CreateAsync(client, Body("Sold", "A boat", "USD",
        [
            Valuation(100m, "2025-01-01"),
            Valuation(250.5m, "2026-01-01"),
        ]));
        await CreateAsync(client, Body("Kept", valuations: [Valuation(5m)]));
        var lease = await LeaseAsync(client, asset.Id);
        (await ReleaseAsync(client, asset.Id, lease.EditId)).Dispose();

        using var response = await DeleteAsync(client, asset.Id);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var list = await ListAsync(client);
        Assert.Equal(["Kept"], list.Assets.Select(item => item.Name));
        Assert.Equal([new TotalDto("AUD", "5.00")], list.Totals);
        Assert.False(await QueryAsync(fixture, db => db.AssetValuations.AnyAsync(item => item.AssetId == asset.Id)));
        Assert.Empty(await EditsAsync(fixture, asset.Id));
        var audit = Assert.Single(await AuditsAsync(fixture, asset.Id), row => row.EventCode == "AssetDelete");
        Assert.Contains("Name: Sold.", audit.Description, StringComparison.Ordinal);
        Assert.Contains("Description: A boat.", audit.Description, StringComparison.Ordinal);
        Assert.Contains("Currency: USD.", audit.Description, StringComparison.Ordinal);
        Assert.Contains(
            "Valuations removed: 250.50 USD on 2026-01-01; 100.00 USD on 2025-01-01.",
            audit.Description,
            StringComparison.Ordinal);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Delete_is_refused_while_an_unexpired_edit_exists_and_writes_nothing()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var asset = await CreateAsync(client, Body("Being edited"));
        var lease = await LeaseAsync(client, asset.Id);
        var outcomes = new ConcurrentQueue<string>();
        using var listener = new MeterListener();
        listener.InstrumentPublished = (instrument, meterListener) =>
        {
            if (instrument.Name == "clutch.asset.delete.outcomes")
            {
                meterListener.EnableMeasurementEvents(instrument);
            }
        };
        listener.SetMeasurementEventCallback<long>((_, _, tags, _) =>
            outcomes.Enqueue((string)tags.ToArray().Single(tag => tag.Key == "outcome").Value!));
        listener.Start();

        using var response = await DeleteAsync(client, asset.Id);

        await AssertCodeAsync(response, HttpStatusCode.Conflict, "AssetEditActive");
        Assert.Single((await ListAsync(client)).Assets);
        Assert.Equal(lease.EditId, await ActiveEditIdAsync(fixture, asset.Id));
        Assert.Single(await AuditsAsync(fixture, asset.Id));
        Assert.Equal(["EditActive"], outcomes);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Delete_succeeds_when_the_only_edit_has_expired_but_is_still_marked_active()
    {
        var clock = new MutableTimeProvider(DateTimeOffset.UtcNow);
        using var factory = WithClock(fixture, clock);
        using var client = await SignedInClientAsync(factory);
        var asset = await CreateAsync(client, Body());
        await LeaseAsync(client, asset.Id);
        clock.Advance(TimeSpan.FromMinutes(5));

        using var response = await DeleteAsync(client, asset.Id);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Empty((await ListAsync(client)).Assets);
        Assert.Empty(await EditsAsync(fixture, asset.Id));
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Another_users_or_unknown_asset_is_not_found()
    {
        using var owner = await SignedInClientAsync(fixture.Factory);
        using var other = await SignedInClientAsync(fixture.Factory);
        var asset = await CreateAsync(owner, Body());

        using var foreign = await DeleteAsync(other, asset.Id);
        using var unknown = await DeleteAsync(owner, Guid.NewGuid());

        await AssertCodeAsync(foreign, HttpStatusCode.NotFound, "AssetNotFound");
        await AssertCodeAsync(unknown, HttpStatusCode.NotFound, "AssetNotFound");
        Assert.Single((await ListAsync(owner)).Assets);
        Assert.Single(await AuditsAsync(fixture, asset.Id));
    }
}
