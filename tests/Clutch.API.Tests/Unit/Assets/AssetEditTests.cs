using Clutch.API.Domain.Assets;

namespace Clutch.API.Tests.Unit.Assets;

public sealed class AssetEditTests
{
    private static readonly DateTimeOffset Opened = new(2026, 11, 27, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public void An_opened_edit_is_active_for_five_minutes()
    {
        var assetId = Guid.NewGuid();

        var edit = AssetEdit.Open(assetId, "user-1", Opened);

        Assert.NotEqual(Guid.Empty, edit.Id);
        Assert.Equal(assetId, edit.AssetId);
        Assert.Equal("user-1", edit.OwnerUserId);
        Assert.Equal(AssetEditState.Active, edit.State);
        Assert.Equal(Opened.AddMinutes(5), edit.ExpiresAtUtc);
        Assert.True(edit.IsActiveAt(Opened.AddMinutes(5).AddTicks(-1)));
        AssertEndMetadata(edit, null, null);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(1)]
    public void An_active_edit_at_or_past_its_expiry_counts_as_expired(int minutesPast)
    {
        var edit = Open();
        var now = edit.ExpiresAtUtc.AddMinutes(minutesPast);

        Assert.True(edit.IsExpiredAt(now));
        Assert.False(edit.IsActiveAt(now));
        Assert.Equal(AssetEditState.Active, edit.State);
    }

    [Fact]
    public void Save_ends_an_unexpired_edit_without_end_metadata()
    {
        var edit = Open();

        Assert.True(edit.TrySave(Opened.AddMinutes(1)));

        Assert.Equal(AssetEditState.Saved, edit.State);
        AssertEndMetadata(edit, null, null);
        Assert.False(edit.IsExpiredAt(Opened.AddMinutes(10)));
    }

    [Fact]
    public void Release_of_an_unexpired_edit_is_released_without_end_metadata()
    {
        var edit = Open();

        Assert.True(edit.TryRelease(Opened.AddMinutes(1)));

        Assert.Equal(AssetEditState.Released, edit.State);
        AssertEndMetadata(edit, null, null);
    }

    [Fact]
    public void Release_of_an_expired_edit_records_expiry_not_release()
    {
        var edit = Open();
        var now = Opened.AddMinutes(8);

        Assert.True(edit.TryRelease(now));

        Assert.Equal(AssetEditState.Expired, edit.State);
        AssertEndMetadata(edit, null, now);
    }

    [Fact]
    public void Ending_records_who_ended_it_and_when()
    {
        var edit = Open();
        var now = Opened.AddMinutes(1);

        Assert.True(edit.TryEnd("user-2", now));

        Assert.Equal(AssetEditState.Ended, edit.State);
        AssertEndMetadata(edit, "user-2", now);
    }

    [Fact]
    public void Expiry_applies_only_once_the_time_is_reached()
    {
        var edit = Open();

        Assert.False(edit.TryExpire(Opened.AddMinutes(4)));
        Assert.Equal(AssetEditState.Active, edit.State);
        Assert.True(edit.TryExpire(Opened.AddMinutes(6)));
        Assert.Equal(AssetEditState.Expired, edit.State);
        Assert.True(edit.IsExpiredAt(Opened.AddMinutes(6)));
        AssertEndMetadata(edit, null, Opened.AddMinutes(6));
    }

    [Fact]
    public void An_expired_edit_cannot_be_saved_or_ended()
    {
        var edit = Open();

        Assert.False(edit.TrySave(edit.ExpiresAtUtc));
        Assert.False(edit.TryEnd("user-2", edit.ExpiresAtUtc));
        Assert.Equal(AssetEditState.Active, edit.State);
    }

    [Theory]
    [InlineData(AssetEditState.Saved)]
    [InlineData(AssetEditState.Released)]
    [InlineData(AssetEditState.Ended)]
    [InlineData(AssetEditState.Expired)]
    public void A_terminal_edit_never_changes_again(AssetEditState terminal)
    {
        var edit = Open();
        var reached = terminal switch
        {
            AssetEditState.Saved => edit.TrySave(Opened.AddMinutes(1)),
            AssetEditState.Released => edit.TryRelease(Opened.AddMinutes(1)),
            AssetEditState.Ended => edit.TryEnd("user-2", Opened.AddMinutes(1)),
            _ => edit.TryExpire(Opened.AddMinutes(6)),
        };
        Assert.True(reached);
        var endedBy = edit.EndedByUserId;
        var endedAt = edit.EndedAtUtc;

        Assert.False(edit.TrySave(Opened.AddMinutes(2)));
        Assert.False(edit.TryRelease(Opened.AddMinutes(2)));
        Assert.False(edit.TryEnd("user-3", Opened.AddMinutes(2)));
        Assert.False(edit.TryExpire(Opened.AddMinutes(9)));
        Assert.Equal(terminal, edit.State);
        AssertEndMetadata(edit, endedBy, endedAt);
    }

    private static AssetEdit Open() => AssetEdit.Open(Guid.NewGuid(), "user-1", Opened);

    private static void AssertEndMetadata(AssetEdit edit, string? endedBy, DateTimeOffset? endedAt)
    {
        Assert.Equal(endedBy, edit.EndedByUserId);
        Assert.Equal(endedAt, edit.EndedAtUtc);
    }
}
