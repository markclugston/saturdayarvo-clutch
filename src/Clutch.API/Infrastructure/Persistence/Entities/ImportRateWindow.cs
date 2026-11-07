namespace Clutch.API.Infrastructure.Persistence.Entities;

public sealed class ImportRateWindow
{
    private ImportRateWindow()
    {
    }

    public ImportRateWindow(string userId, DateTimeOffset windowStartedAtUtc)
    {
        UserId = userId;
        WindowStartedAtUtc = windowStartedAtUtc;
        AttemptCount = 1;
    }

    public string UserId { get; private set; } = string.Empty;

    public DateTimeOffset WindowStartedAtUtc { get; private set; }

    public int AttemptCount { get; private set; }

    public void Increment() => AttemptCount++;
}
