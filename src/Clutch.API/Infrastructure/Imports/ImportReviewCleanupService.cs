using System.Data;
using Clutch.API.Domain.Imports;
using Clutch.API.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Clutch.API.Infrastructure.Imports;

public sealed class ImportReviewCleanupService(
    IServiceScopeFactory scopeFactory,
    TimeProvider timeProvider,
    ILogger<ImportReviewCleanupService> logger) : BackgroundService
{
    private const int BatchSize = 100;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                await Task.Delay(TimeSpan.FromMinutes(1), timeProvider, stoppingToken);
                await RunCleanupOnceAsync(stoppingToken);
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
        }
    }

    public async Task RunCleanupOnceAsync(CancellationToken cancellationToken)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var auditWriter = scope.ServiceProvider.GetRequiredService<ImportAuditWriter>();
        var now = timeProvider.GetUtcNow();
        var strategy = dbContext.Database.CreateExecutionStrategy();
        var expiredCount = await strategy.ExecuteAsync(async () =>
        {
            dbContext.ChangeTracker.Clear();
            await using var transaction = await dbContext.Database.BeginTransactionAsync(
                IsolationLevel.ReadCommitted,
                cancellationToken);
            var expiredReviews = await dbContext.ImportReviews
                .AsNoTracking()
                .Where(review =>
                    review.State == ImportReviewState.Ready
                    && review.ExpiresAtUtc <= now)
                .OrderBy(review => review.ExpiresAtUtc)
                .Take(BatchSize)
                .Select(review => new
                {
                    review.Id,
                    review.AccountId,
                    review.ActingUserId,
                })
                .ToListAsync(cancellationToken);

            var transitionedCount = 0;
            foreach (var review in expiredReviews)
            {
                var transitioned = await dbContext.ImportReviews
                    .Where(candidate =>
                        candidate.Id == review.Id
                        && candidate.State == ImportReviewState.Ready
                        && candidate.ExpiresAtUtc <= now)
                    .ExecuteUpdateAsync(
                        setters => setters.SetProperty(
                            candidate => candidate.State,
                            ImportReviewState.Expired),
                        cancellationToken);
                if (transitioned == 0)
                {
                    continue;
                }

                await dbContext.ImportReviewRows
                    .Where(row => row.ReviewId == review.Id)
                    .ExecuteDeleteAsync(cancellationToken);
                await dbContext.Accounts
                    .Where(account =>
                        account.Id == review.AccountId
                        && account.ActiveImportId == review.Id)
                    .ExecuteUpdateAsync(
                        setters => setters.SetProperty(
                            account => account.ActiveImportId,
                            (Guid?)null),
                        cancellationToken);
                auditWriter.Add(
                    review.Id,
                    review.AccountId,
                    review.ActingUserId,
                    "ReviewExpired",
                    now);
                transitionedCount++;
            }

            await dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return transitionedCount;
        });

        if (expiredCount > 0)
        {
            logger.LogInformation(
                "Expired {ReviewCount} import reviews and released their account leases.",
                expiredCount);
        }
    }
}
