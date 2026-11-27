namespace Clutch.API.Domain.Assets;

public enum AssetEditState
{
    Active,
    Saved,
    Released,
    Ended,
    Expired,
}

// One opened edit of an asset. The Try methods are the only allowed state changes; the service
// persists each with a conditional update. Terminal states never change again.
public sealed class AssetEdit
{
    public static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(5);

    private AssetEdit()
    {
    }

    public static AssetEdit Open(Guid assetId, string ownerUserId, DateTimeOffset openedAtUtc) =>
        new()
        {
            Id = Guid.NewGuid(),
            AssetId = assetId,
            OwnerUserId = ownerUserId,
            State = AssetEditState.Active,
            OpenedAtUtc = openedAtUtc,
            ExpiresAtUtc = openedAtUtc.Add(Lifetime),
        };

    // The one definition of effective expiry: an unmarked Active edit past its time has expired.
    public static bool HasExpired(AssetEditState state, DateTimeOffset expiresAtUtc, DateTimeOffset now) =>
        state == AssetEditState.Expired
        || (state == AssetEditState.Active && expiresAtUtc <= now);

    public static bool IsStillActive(AssetEditState state, DateTimeOffset expiresAtUtc, DateTimeOffset now) =>
        state == AssetEditState.Active && expiresAtUtc > now;

    public Guid Id { get; private set; }

    public Guid AssetId { get; private set; }

    public string OwnerUserId { get; private set; } = string.Empty;

    public AssetEditState State { get; private set; }

    public DateTimeOffset OpenedAtUtc { get; private set; }

    public DateTimeOffset ExpiresAtUtc { get; private set; }

    public string? EndedByUserId { get; private set; }

    public DateTimeOffset? EndedAtUtc { get; private set; }

    public bool IsExpiredAt(DateTimeOffset now) => HasExpired(State, ExpiresAtUtc, now);

    public bool IsActiveAt(DateTimeOffset now) => IsStillActive(State, ExpiresAtUtc, now);

    public bool TrySave(DateTimeOffset now)
    {
        if (!IsActiveAt(now))
        {
            return false;
        }

        State = AssetEditState.Saved;
        return true;
    }

    // A release that arrives after expiry records the expiry, so the two stay distinguishable.
    public bool TryRelease(DateTimeOffset now)
    {
        if (TryExpire(now))
        {
            return true;
        }

        if (!IsActiveAt(now))
        {
            return false;
        }

        State = AssetEditState.Released;
        return true;
    }

    public bool TryEnd(string endedByUserId, DateTimeOffset now)
    {
        if (!IsActiveAt(now) || string.IsNullOrWhiteSpace(endedByUserId))
        {
            return false;
        }

        State = AssetEditState.Ended;
        EndedByUserId = endedByUserId;
        EndedAtUtc = now;
        return true;
    }

    public bool TryExpire(DateTimeOffset now)
    {
        if (State != AssetEditState.Active || ExpiresAtUtc > now)
        {
            return false;
        }

        State = AssetEditState.Expired;
        EndedAtUtc = now;
        return true;
    }
}
