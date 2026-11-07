namespace Clutch.API.Infrastructure.Imports;

public interface IImportAttemptLimiter
{
    Task<bool> TryConsumeAsync(string userId, CancellationToken cancellationToken);
}
