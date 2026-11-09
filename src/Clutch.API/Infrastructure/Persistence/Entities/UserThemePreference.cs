using Clutch.API.Domain.Preferences;

namespace Clutch.API.Infrastructure.Persistence.Entities;

public sealed class UserThemePreference
{
    private UserThemePreference()
    {
    }

    private UserThemePreference(string userId, ThemeMode mode, DateTimeOffset updatedAtUtc)
    {
        UserId = userId;
        Mode = mode;
        UpdatedAtUtc = updatedAtUtc;
    }

    public string UserId { get; private set; } = string.Empty;

    public ThemeMode Mode { get; private set; }

    public DateTimeOffset UpdatedAtUtc { get; private set; }

    public static UserThemePreference Create(
        string userId,
        ThemeMode mode,
        DateTimeOffset updatedAtUtc) =>
        new(userId, mode, updatedAtUtc);

    public void Update(ThemeMode mode, DateTimeOffset updatedAtUtc)
    {
        Mode = mode;
        UpdatedAtUtc = updatedAtUtc;
    }
}
