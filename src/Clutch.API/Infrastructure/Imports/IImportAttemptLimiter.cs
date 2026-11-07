namespace Clutch.API.Infrastructure.Imports;

public interface IImportAttemptLimiter
{
    Task<bool> TryConsumeAsync(
        string userId,
        int maxAttemptsPerUserPerMinute,
        CancellationToken cancellationToken);
}
