using System.Net;
using System.Text.Json;
using Clutch.API.Domain.Assets;
using Clutch.API.Tests.Integration.Accounts;
using static Clutch.API.Tests.Integration.Assets.AssetTestSupport;

namespace Clutch.API.Tests.Integration.Assets;

[Collection(SqlServerCollection.Name)]
public sealed class AssetEditStatusTests(SqlServerFixture fixture)
{
    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Status_shapes_follow_the_contract_and_are_never_cached()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var asset = await CreateAsync(client, Body());

        using var idle = await client.GetAsync($"/api/assets/{asset.Id}/edit-status");
        Assert.Equal(HttpStatusCode.OK, idle.StatusCode);
        Assert.Equal("no-store", idle.Headers.CacheControl!.ToString());
        var available = await JsonAsync(idle);
        Assert.Equal(["activeEdit", "assetId", "availability", "watchedEdit"], Names(available));
        Assert.Equal("Available", available.GetProperty("availability").GetString());
        Assert.Equal(JsonValueKind.Null, available.GetProperty("activeEdit").ValueKind);
        Assert.Equal(JsonValueKind.Null, available.GetProperty("watchedEdit").ValueKind);

        var lease = await LeaseAsync(client, asset.Id);
        using var held = await client.GetAsync($"/api/assets/{asset.Id}/edit-status?editId={lease.EditId}");
        var blocked = await JsonAsync(held);
        Assert.Equal("Blocked", blocked.GetProperty("availability").GetString());
        // Always endable while blocked, so there is no canEnd flag.
        Assert.Equal(["expiresAtUtc", "id"], Names(blocked.GetProperty("activeEdit")));
        var watched = blocked.GetProperty("watchedEdit");
        Assert.Equal(["expiresAtUtc", "id", "state"], Names(watched));
        Assert.Equal("Active", watched.GetProperty("state").GetString());

        (await ReleaseAsync(client, asset.Id, lease.EditId)).Dispose();
        using var released = await client.GetAsync($"/api/assets/{asset.Id}/edit-status?editId={lease.EditId}");
        var terminal = (await JsonAsync(released)).GetProperty("watchedEdit");
        Assert.Equal(["id", "state"], Names(terminal));
        Assert.Equal("Released", terminal.GetProperty("state").GetString());

        var next = await LeaseAsync(client, asset.Id);
        (await EndAsync(client, asset.Id, next.EditId)).Dispose();
        using var ended = await client.GetAsync($"/api/assets/{asset.Id}/edit-status?editId={next.EditId}");
        var endedEdit = (await JsonAsync(ended)).GetProperty("watchedEdit");
        Assert.Equal(["endedAtUtc", "endedBy", "id", "state"], Names(endedEdit));
        Assert.Equal(["userId", "userName"], Names(endedEdit.GetProperty("endedBy")));
    }

    [Theory]
    [InlineData("not-an-id")]
    [InlineData("00000000-0000-0000-0000-000000000000")]
    [Trait("Category", "SqlServer")]
    public async Task Status_rejects_a_bad_edit_id(string editId)
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var asset = await CreateAsync(client, Body());

        using var response = await client.GetAsync($"/api/assets/{asset.Id}/edit-status?editId={editId}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("editId", (await ProblemAsync(response)).Errors!.Keys);
    }

    [Theory]
    [InlineData("")]
    [InlineData("?editId=not-an-id")]
    [InlineData("?editId=00000000-0000-0000-0000-000000000000")]
    [Trait("Category", "SqlServer")]
    public async Task Ending_requires_an_exact_target(string query)
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var asset = await CreateAsync(client, Body());
        var lease = await LeaseAsync(client, asset.Id);

        using var response = await SendAsync(
            client, HttpMethod.Delete, $"/api/assets/{asset.Id}/active-edit{query}", null);

        await AssertCodeAsync(response, HttpStatusCode.BadRequest, "AssetEditTargetRequired");
        Assert.Equal(lease.EditId, await ActiveEditIdAsync(fixture, asset.Id));
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Another_assets_or_unknown_edit_is_not_found()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var asset = await CreateAsync(client, Body("One"));
        var second = await CreateAsync(client, Body("Two"));
        var lease = await LeaseAsync(client, second.Id);

        foreach (var editId in new[] { lease.EditId, Guid.NewGuid() })
        {
            using var end = await EndAsync(client, asset.Id, editId);
            using var release = await ReleaseAsync(client, asset.Id, editId);
            Assert.Equal(HttpStatusCode.NotFound, end.StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, release.StatusCode);
        }

        Assert.Equal(AssetEditState.Active, (await EditAsync(fixture, lease.EditId)).State);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Another_users_asset_is_not_found_on_every_edit_route()
    {
        using var owner = await SignedInClientAsync(fixture.Factory);
        using var other = await SignedInClientAsync(fixture.Factory);
        var asset = await CreateAsync(owner, Body());
        var lease = await LeaseAsync(owner, asset.Id);

        using var acquire = await AcquireAsync(other, asset.Id);
        using var status = await other.GetAsync($"/api/assets/{asset.Id}/edit-status?editId={lease.EditId}");
        using var end = await EndAsync(other, asset.Id, lease.EditId);
        using var release = await ReleaseAsync(other, asset.Id, lease.EditId);
        using var unknown = await AcquireAsync(owner, Guid.NewGuid());

        await AssertCodeAsync(acquire, HttpStatusCode.NotFound, "AssetNotFound");
        await AssertCodeAsync(unknown, HttpStatusCode.NotFound, "AssetNotFound");
        Assert.Equal(HttpStatusCode.NotFound, status.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, end.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, release.StatusCode);
        Assert.Equal(AssetEditState.Active, (await EditAsync(fixture, lease.EditId)).State);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task A_save_over_64_kb_is_rejected_and_stores_nothing()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var asset = await CreateAsync(client, Body("Small"));
        var lease = await LeaseAsync(client, asset.Id);

        using var response = await SaveAsync(client, asset.Id, Body(
            description: new string('d', 70 * 1024),
            editId: lease.EditId));

        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, response.StatusCode);
        Assert.Equal("Small", Assert.Single((await ListAsync(client)).Assets).Name);
        Assert.Equal(AssetEditState.Active, (await EditAsync(fixture, lease.EditId)).State);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Every_mutation_requires_an_antiforgery_token()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var asset = await CreateAsync(client, Body());
        var lease = await LeaseAsync(client, asset.Id);
        var requests = new (HttpMethod Method, string Path, object? Body)[]
        {
            (HttpMethod.Post, $"/api/assets/{asset.Id}/edits", null),
            (HttpMethod.Put, $"/api/assets/{asset.Id}", Body(editId: lease.EditId)),
            (HttpMethod.Delete, $"/api/assets/{asset.Id}/edits/{lease.EditId}", null),
            (HttpMethod.Delete, $"/api/assets/{asset.Id}/active-edit?editId={lease.EditId}", null),
            (HttpMethod.Delete, $"/api/assets/{asset.Id}", null),
        };

        foreach (var (method, path, body) in requests)
        {
            using var response = await SendAsync(client, method, path, body, withCsrf: false);
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        Assert.Equal(AssetEditState.Active, (await EditAsync(fixture, lease.EditId)).State);
        Assert.Single((await ListAsync(client)).Assets);
    }

    private static IEnumerable<string> Names(JsonElement element) =>
        element.EnumerateObject().Select(property => property.Name).Order(StringComparer.Ordinal);
}
