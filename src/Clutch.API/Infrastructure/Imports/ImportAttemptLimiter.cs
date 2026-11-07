using Clutch.API.Domain.Imports;
using Clutch.API.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Clutch.API.Infrastructure.Imports;

public sealed class ImportAttemptLimiter(
    AppDbContext dbContext,
    TimeProvider timeProvider) : IImportAttemptLimiter
{
    public async Task<bool> TryConsumeAsync(string userId, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(userId);

        var now = timeProvider.GetUtcNow();
        var windowStartedAtUtc = new DateTimeOffset(
            now.Year,
            now.Month,
            now.Day,
            now.Hour,
            now.Minute,
            0,
            TimeSpan.Zero);
        var limits = await dbContext.ImportLimitSettings
            .AsNoTracking()
            .Select(settings => new ImportLimits(
                settings.MaxFileSizeBytes,
                settings.MaxRowsPerImport,
                settings.MaxImportAttemptsPerUserPerMinute))
            .SingleOrDefaultAsync(cancellationToken) ?? ImportLimits.Default;

        await dbContext.ImportRateWindows
            .Where(window => window.WindowStartedAtUtc < windowStartedAtUtc.AddMinutes(-1))
            .ExecuteDeleteAsync(cancellationToken);

        var attemptCounts = await dbContext.Database.SqlQuery<int>($"""
            MERGE [dbo].[ImportRateWindows] WITH (HOLDLOCK) AS target
            USING (
                SELECT CAST({userId} AS nvarchar(450)) AS [UserId],
                       {windowStartedAtUtc} AS [WindowStartedAtUtc]
            ) AS source
            ON target.[UserId] = source.[UserId]
               AND target.[WindowStartedAtUtc] = source.[WindowStartedAtUtc]
            WHEN MATCHED THEN
                UPDATE SET [AttemptCount] = target.[AttemptCount] + 1
            WHEN NOT MATCHED THEN
                INSERT ([UserId], [WindowStartedAtUtc], [AttemptCount])
                VALUES (source.[UserId], source.[WindowStartedAtUtc], 1)
            OUTPUT inserted.[AttemptCount] AS [Value];
            """)
            .ToListAsync(cancellationToken);
        var attemptCount = attemptCounts.Single();

        return attemptCount <= limits.MaxImportAttemptsPerUserPerMinute;
    }
}
