using System.Collections.Concurrent;
using System.Diagnostics.Metrics;
using System.Net;
using System.Net.Http.Json;
using Clutch.API.Domain.Assets;
using Clutch.API.Tests.Integration.Accounts;
using Microsoft.EntityFrameworkCore;
using static Clutch.API.Tests.Integration.Assets.AssetTestSupport;

namespace Clutch.API.Tests.Integration.Assets;

[Collection(SqlServerCollection.Name)]
public sealed class AssetEditLeaseTests(SqlServerFixture fixture)
{
    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Concurrent_acquires_give_exactly_one_active_edit_and_audit_each_refusal()
    {
        var (first, second, _) = await TwoSessionsAsync(fixture.Factory);
        using var firstClient = first;
        using var secondClient = second;
        var asset = await CreateAsync(first, Body("Contested"));

        var responses = await Task.WhenAll(
            Enumerable.Range(0, 8).Select(index => AcquireAsync(index % 2 == 0 ? first : second, asset.Id)));

        var winner = Assert.Single(responses, response => response.StatusCode == HttpStatusCode.Created);
        var lease = (await winner.Content.ReadFromJsonAsync<LeaseDto>())!;
        Assert.Equal("Contested", lease.Asset.Name);
        Assert.Equal(lease.ServerTimeUtc.AddMinutes(5), lease.ExpiresAtUtc);
        foreach (var refused in responses.Where(response => response != winner))
        {
            Assert.Equal(HttpStatusCode.Conflict, refused.StatusCode);
            var blocked = (await refused.Content.ReadFromJsonAsync<BlockedDto>())!;
            Assert.Equal(["AssetEditActive"], blocked.Errors["code"]);
            Assert.Equal("Blocked", blocked.EditStatus.Availability);
            Assert.Equal(lease.EditId, blocked.EditStatus.ActiveEdit!.Id);
        }

        var edit = Assert.Single(await EditsAsync(fixture, asset.Id));
        Assert.Equal(AssetEditState.Active, edit.State);
        Assert.Equal(lease.EditId, await ActiveEditIdAsync(fixture, asset.Id));
        var rejections = (await AuditsAsync(fixture, asset.Id))
            .Where(row => row.EventCode == "AssetEditRejected")
            .ToList();
        Assert.Equal(7, rejections.Count);
        Assert.All(rejections, row =>
        {
            Assert.Contains($"by user {row.ActingUserId}", row.Description, StringComparison.Ordinal);
            Assert.Contains(lease.EditId.ToString(), row.Description, StringComparison.Ordinal);
        });
        foreach (var response in responses)
        {
            response.Dispose();
        }
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Save_and_end_racing_each_other_have_exactly_one_winner()
    {
        var (holder, other, _) = await TwoSessionsAsync(fixture.Factory);
        using var holderClient = holder;
        using var otherClient = other;
        var asset = await CreateAsync(holder, Body("Original"));

        for (var round = 0; round < 10; round++)
        {
            var before = Assert.Single((await ListAsync(holder)).Assets).Name;
            var lease = await LeaseAsync(holder, asset.Id);
            var name = $"Round {round}";
            var saveTask = SaveAsync(holder, asset.Id, Body(
                name,
                valuations: [Valuation(asset.Valuations[0])],
                editId: lease.EditId));
            var endTask = EndAsync(other, asset.Id, lease.EditId);
            using var save = await saveTask;
            using var end = await endTask;

            var stored = Assert.Single((await ListAsync(holder)).Assets).Name;
            var state = (await EditAsync(fixture, lease.EditId)).State;
            if (save.StatusCode == HttpStatusCode.OK)
            {
                await AssertCodeAsync(end, HttpStatusCode.Conflict, "AssetEditChanged");
                Assert.Equal(name, stored);
                Assert.Equal(AssetEditState.Saved, state);
            }
            else
            {
                await AssertCodeAsync(save, HttpStatusCode.Conflict, "AssetEditEnded");
                Assert.Equal(HttpStatusCode.NoContent, end.StatusCode);
                Assert.Equal(before, stored);
                Assert.Equal(AssetEditState.Ended, state);
            }

            Assert.Null(await ActiveEditIdAsync(fixture, asset.Id));
        }
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Ending_records_the_ender_and_a_stale_end_never_ends_a_newer_edit()
    {
        var (holder, other, userName) = await TwoSessionsAsync(fixture.Factory);
        using var holderClient = holder;
        using var otherClient = other;
        var asset = await CreateAsync(holder, Body("Handed over"));
        var first = await LeaseAsync(holder, asset.Id);

        using (var end = await EndAsync(other, asset.Id, first.EditId))
        using (var repeat = await EndAsync(other, asset.Id, first.EditId))
        {
            Assert.Equal(HttpStatusCode.NoContent, end.StatusCode);
            Assert.Equal(HttpStatusCode.NoContent, repeat.StatusCode);
        }

        var ended = await EditAsync(fixture, first.EditId);
        Assert.Equal(AssetEditState.Ended, ended.State);
        Assert.Equal(ended.OwnerUserId, ended.EndedByUserId);
        Assert.NotNull(ended.EndedAtUtc);
        var audit = Assert.Single(await AuditsAsync(fixture, asset.Id), row => row.EventCode == "AssetEditEnded");
        Assert.Contains(first.EditId.ToString(), audit.Description, StringComparison.Ordinal);
        Assert.Contains($"by user {ended.EndedByUserId}", audit.Description, StringComparison.Ordinal);
        var watched = (await StatusAsync(holder, asset.Id, first.EditId)).WatchedEdit!;
        Assert.Equal("Ended", watched.State);
        Assert.Equal(userName, watched.EndedBy!.UserName);
        Assert.Equal(ended.EndedByUserId, watched.EndedBy.UserId);

        using (var save = await SaveAsync(holder, asset.Id, Body(
            "Too late",
            valuations: [Valuation(asset.Valuations[0])],
            editId: first.EditId)))
        {
            await AssertCodeAsync(save, HttpStatusCode.Conflict, "AssetEditEnded");
        }

        var second = await LeaseAsync(other, asset.Id);
        var third = await StatusAsync(holder, asset.Id);
        Assert.Equal(second.EditId, third.ActiveEdit!.Id);

        using (var repeat = await EndAsync(holder, asset.Id, first.EditId))
        {
            // The target is already ended: success, and the newer edit is untouched.
            Assert.Equal(HttpStatusCode.NoContent, repeat.StatusCode);
        }

        Assert.Equal(AssetEditState.Active, (await EditAsync(fixture, second.EditId)).State);
        using (var release = await ReleaseAsync(other, asset.Id, second.EditId))
        {
            Assert.Equal(HttpStatusCode.NoContent, release.StatusCode);
        }

        var latest = await LeaseAsync(other, asset.Id);
        using (var stale = await EndAsync(holder, asset.Id, second.EditId))
        {
            await AssertCodeAsync(stale, HttpStatusCode.Conflict, "AssetEditChanged");
        }

        Assert.Equal(AssetEditState.Active, (await EditAsync(fixture, latest.EditId)).State);
        Assert.Equal(latest.EditId, await ActiveEditIdAsync(fixture, asset.Id));
        Assert.Equal("Handed over", Assert.Single((await ListAsync(holder)).Assets).Name);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Release_frees_the_asset_and_is_idempotent_without_audit()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var asset = await CreateAsync(client, Body());
        var lease = await LeaseAsync(client, asset.Id);

        using (var release = await ReleaseAsync(client, asset.Id, lease.EditId))
        using (var repeat = await ReleaseAsync(client, asset.Id, lease.EditId))
        {
            Assert.Equal(HttpStatusCode.NoContent, release.StatusCode);
            Assert.Equal(HttpStatusCode.NoContent, repeat.StatusCode);
        }

        var edit = await EditAsync(fixture, lease.EditId);
        Assert.Equal(AssetEditState.Released, edit.State);
        Assert.Null(edit.EndedAtUtc);
        Assert.Null(await ActiveEditIdAsync(fixture, asset.Id));
        Assert.Single(await AuditsAsync(fixture, asset.Id));
        using var save = await SaveAsync(client, asset.Id, Body(
            valuations: [Valuation(asset.Valuations[0])],
            editId: lease.EditId));
        await AssertCodeAsync(save, HttpStatusCode.Conflict, "AssetEditChanged");
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Status_and_save_on_an_expired_edit_write_nothing_and_acquire_persists_expiry()
    {
        var clock = new MutableTimeProvider(DateTimeOffset.UtcNow);
        using var factory = WithClock(fixture, clock);
        using var client = await SignedInClientAsync(factory);
        var asset = await CreateAsync(client, Body("Expiring"));
        var lease = await LeaseAsync(client, asset.Id);
        clock.Advance(TimeSpan.FromMinutes(5));
        using var metrics = new ExpiryMetrics();

        var status = await StatusAsync(client, asset.Id, lease.EditId);
        Assert.Equal("Available", status.Availability);
        Assert.Null(status.ActiveEdit);
        Assert.Equal("Expired", status.WatchedEdit!.State);
        using (var save = await SaveAsync(client, asset.Id, Body(
            "Late",
            valuations: [Valuation(asset.Valuations[0])],
            editId: lease.EditId)))
        {
            await AssertCodeAsync(save, HttpStatusCode.Conflict, "AssetEditExpired");
        }

        Assert.Equal(AssetEditState.Active, (await EditAsync(fixture, lease.EditId)).State);
        Assert.Equal(lease.EditId, await ActiveEditIdAsync(fixture, asset.Id));
        Assert.Single(await AuditsAsync(fixture, asset.Id));
        Assert.Equal(0, metrics.Expired);

        var next = await LeaseAsync(client, asset.Id);

        var expired = await EditAsync(fixture, lease.EditId);
        Assert.Equal(AssetEditState.Expired, expired.State);
        Assert.Equal(clock.GetUtcNow(), expired.EndedAtUtc);
        Assert.Null(expired.EndedByUserId);
        Assert.Equal(next.EditId, await ActiveEditIdAsync(fixture, asset.Id));
        Assert.Equal(1, metrics.Expired);
        Assert.Single(await AuditsAsync(fixture, asset.Id));

        using (var release = await ReleaseAsync(client, asset.Id, lease.EditId))
        {
            Assert.Equal(HttpStatusCode.NoContent, release.StatusCode);
        }

        Assert.Equal(1, metrics.Expired);
        Assert.Equal(next.EditId, await ActiveEditIdAsync(fixture, asset.Id));
        Assert.Contains(("acquire", "success"), metrics.Outcomes);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Release_of_an_expired_edit_persists_expiry_once_never_release()
    {
        var clock = new MutableTimeProvider(DateTimeOffset.UtcNow);
        using var factory = WithClock(fixture, clock);
        using var client = await SignedInClientAsync(factory);
        var asset = await CreateAsync(client, Body());
        var lease = await LeaseAsync(client, asset.Id);
        clock.Advance(TimeSpan.FromMinutes(6));
        var releasedAt = clock.GetUtcNow();
        using var metrics = new ExpiryMetrics();

        using (var release = await ReleaseAsync(client, asset.Id, lease.EditId))
        {
            Assert.Equal(HttpStatusCode.NoContent, release.StatusCode);
        }

        clock.Advance(TimeSpan.FromMinutes(1));
        using (var repeat = await ReleaseAsync(client, asset.Id, lease.EditId))
        {
            Assert.Equal(HttpStatusCode.NoContent, repeat.StatusCode);
        }

        await LeaseAsync(client, asset.Id);
        var edit = await EditAsync(fixture, lease.EditId);
        Assert.Equal(AssetEditState.Expired, edit.State);
        Assert.Equal(releasedAt, edit.EndedAtUtc);
        Assert.Equal(1, metrics.Expired);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task An_end_of_an_expired_edit_is_refused_and_writes_nothing()
    {
        var clock = new MutableTimeProvider(DateTimeOffset.UtcNow);
        using var factory = WithClock(fixture, clock);
        using var client = await SignedInClientAsync(factory);
        var asset = await CreateAsync(client, Body());
        var lease = await LeaseAsync(client, asset.Id);
        clock.Advance(TimeSpan.FromMinutes(6));
        using var metrics = new ExpiryMetrics();

        using var end = await EndAsync(client, asset.Id, lease.EditId);

        await AssertCodeAsync(end, HttpStatusCode.Conflict, "AssetEditChanged");
        Assert.Equal(AssetEditState.Active, (await EditAsync(fixture, lease.EditId)).State);
        Assert.Single(await AuditsAsync(fixture, asset.Id));
        Assert.Contains(("end", "changed"), metrics.Outcomes);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Status_for_an_edit_with_no_row_is_unavailable()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var asset = await CreateAsync(client, Body());
        var unknown = Guid.NewGuid();

        var status = await StatusAsync(client, asset.Id, unknown);

        Assert.Equal("Available", status.Availability);
        Assert.Equal(unknown, status.WatchedEdit!.Id);
        Assert.Equal("Unavailable", status.WatchedEdit.State);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Acquire_removes_only_terminal_edits_that_finished_over_24_hours_ago()
    {
        var (holder, other, _) = await TwoSessionsAsync(fixture.Factory);
        using var holderClient = holder;
        using var otherClient = other;
        var asset = await CreateAsync(holder, Body());

        async Task<Guid> ReleasedAsync()
        {
            var lease = await LeaseAsync(holder, asset.Id);
            await ReleaseOkAsync(holder, asset.Id, lease.EditId);
            return lease.EditId;
        }

        async Task<Guid> EndedAsync()
        {
            var lease = await LeaseAsync(holder, asset.Id);
            using var end = await EndAsync(other, asset.Id, lease.EditId);
            Assert.Equal(HttpStatusCode.NoContent, end.StatusCode);
            return lease.EditId;
        }

        var oldReleased = await ReleasedAsync();
        var oldEnded = await EndedAsync();
        var oldOpeningRecentEnding = await EndedAsync();
        var recentReleased = await ReleasedAsync();
        var saved = await LeaseAsync(holder, asset.Id);
        using (var save = await SaveAsync(holder, asset.Id, Body(
            valuations: [Valuation(asset.Valuations[0])],
            editId: saved.EditId)))
        {
            Assert.Equal(HttpStatusCode.OK, save.StatusCode);
        }

        var abandoned = (await LeaseAsync(holder, asset.Id)).EditId;

        // Age the rows in the database: moving the clock would also expire the sign-in cookies.
        var now = DateTimeOffset.UtcNow;
        await AgeAsync(oldReleased, openedHoursAgo: 25, endedHoursAgo: null);
        await AgeAsync(oldEnded, openedHoursAgo: 26, endedHoursAgo: 25);
        await AgeAsync(oldOpeningRecentEnding, openedHoursAgo: 25, endedHoursAgo: 23);
        await AgeAsync(recentReleased, openedHoursAgo: 23, endedHoursAgo: null);
        await AgeAsync(saved.EditId, openedHoursAgo: 23, endedHoursAgo: null);
        // Still marked Active and long past expiry: this acquire is what expires it, so it is kept.
        await AgeAsync(abandoned, openedHoursAgo: 30, endedHoursAgo: null);

        var final = await LeaseAsync(holder, asset.Id);

        var kept = (await EditsAsync(fixture, asset.Id)).ToDictionary(edit => edit.Id, edit => edit.State);
        Assert.Equal(
            new[] { oldOpeningRecentEnding, recentReleased, saved.EditId, abandoned, final.EditId }.Order(),
            kept.Keys.Order());
        Assert.Equal(AssetEditState.Expired, kept[abandoned]);
        Assert.Equal(AssetEditState.Active, kept[final.EditId]);
        Assert.Equal("Unavailable", (await StatusAsync(holder, asset.Id, oldEnded)).WatchedEdit!.State);

        Task<int> AgeAsync(Guid editId, int openedHoursAgo, int? endedHoursAgo) =>
            QueryAsync(fixture, db =>
            {
                var opened = now.AddHours(-openedHoursAgo);
                var expires = opened.AddMinutes(5);
                DateTimeOffset? ended = endedHoursAgo is { } hours ? now.AddHours(-hours) : null;
                return db.AssetEdits
                    .Where(edit => edit.Id == editId)
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(edit => edit.OpenedAtUtc, opened)
                        .SetProperty(edit => edit.ExpiresAtUtc, expires)
                        .SetProperty(edit => edit.EndedAtUtc, ended));
            });
    }

    private static async Task ReleaseOkAsync(HttpClient client, Guid assetId, Guid editId)
    {
        using var response = await ReleaseAsync(client, assetId, editId);
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    // The SQL Server collection never runs in parallel with itself, so these are this test's own.
    private sealed class ExpiryMetrics : IDisposable
    {
        private readonly MeterListener listener = new();
        private readonly ConcurrentQueue<(string Name, string Operation, string Outcome)> measurements = new();

        public ExpiryMetrics()
        {
            listener.InstrumentPublished = (instrument, meterListener) =>
            {
                if (instrument.Meter.Name == "Clutch.API.Assets")
                {
                    meterListener.EnableMeasurementEvents(instrument);
                }
            };
            listener.SetMeasurementEventCallback<long>((instrument, _, tags, _) =>
            {
                var values = tags.ToArray().ToDictionary(tag => tag.Key, tag => (string)tag.Value!);
                measurements.Enqueue((instrument.Name, values["operation"], values["outcome"]));
            });
            listener.Start();
        }

        public int Expired => measurements.Count(item => item.Name == "clutch.asset.edit.expired");

        public IReadOnlyList<(string, string)> Outcomes =>
            measurements.Select(item => (item.Operation, item.Outcome)).ToList();

        public void Dispose() => listener.Dispose();
    }
}
