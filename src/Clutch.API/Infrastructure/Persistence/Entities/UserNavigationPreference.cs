using Clutch.API.Domain.Preferences;

namespace Clutch.API.Infrastructure.Persistence.Entities;

public sealed class UserNavigationPreference
{
    private UserNavigationPreference()
    {
    }

    private UserNavigationPreference(string userId, NavigationState state, DateTimeOffset updatedAtUtc)
    {
        UserId = userId;
        State = state;
        UpdatedAtUtc = updatedAtUtc;
    }

    public string UserId { get; private set; } = string.Empty;

    public NavigationState State { get; private set; }

    public DateTimeOffset UpdatedAtUtc { get; private set; }

    public static UserNavigationPreference Create(
        string userId,
        NavigationState state,
        DateTimeOffset updatedAtUtc) =>
        new(userId, state, updatedAtUtc);

    public void Update(NavigationState state, DateTimeOffset updatedAtUtc)
    {
        State = state;
        UpdatedAtUtc = updatedAtUtc;
    }
}
