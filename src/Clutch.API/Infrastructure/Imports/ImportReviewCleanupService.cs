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
    private static readonly TimeSpan AbandonedClaimLifetime = TimeSpan.FromMinutes(5);

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
        await dbContext.ImportRateWindows
            .Where(window => window.WindowStartedAtUtc <= now.AddMinutes(-1))
            .ExecuteDeleteAsync(cancellationToken);
        var strategy = dbContext.Database.CreateExecutionStrategy();
        var (expiredCount, recoveredCount) = await strategy.ExecuteAsync(async () =>
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
                .Join(
                    dbContext.Accounts.AsNoTracking(),
                    review => review.AccountId,
                    account => account.Id,
                    (review, account) => new
                    {
                        review.Id,
                        review.AccountId,
                        review.ActingUserId,
                        review.ExpiresAtUtc,
                        AccountDescription = account.Description,
                    })
                .OrderBy(review => review.ExpiresAtUtc)
                .Take(BatchSize)
                .ToListAsync(cancellationToken);

            var transitionedCount = 0;
            foreach (var review in expiredReviews)
            {
                var transitioned = await dbContext.ImportReviews
                    .Where(candidate =>
                        candidate.Id == review.Id
                        && candidate.State == ImportReviewState.Ready
                        && candidate.ExpiresAtUtc <= now
                        && dbContext.Accounts.Any(account =>
                            account.Id == candidate.AccountId
                            && account.ActiveImportId == candidate.Id))
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
                var released = await dbContext.Accounts
                    .Where(account =>
                        account.Id == review.AccountId
                        && account.ActiveImportId == review.Id)
                    .ExecuteUpdateAsync(
                        setters => setters.SetProperty(
                            account => account.ActiveImportId,
                            (Guid?)null),
                        cancellationToken);
                if (released != 1)
                {
                    throw new InvalidOperationException("The expired import lease changed during cleanup.");
                }

                await dbContext.ImportReviews
                    .Where(candidate => candidate.Id == review.Id)
                    .ExecuteDeleteAsync(cancellationToken);
                auditWriter.Add(
                    review.AccountDescription,
                    review.ActingUserId,
                    "ReviewExpired",
                    now);
                transitionedCount++;
            }

            var staleClaims = await dbContext.ImportReviews
                .AsNoTracking()
                .Where(review =>
                    review.State == ImportReviewState.Processing
                    && review.ProcessingStartedAtUtc <= now.Add(-AbandonedClaimLifetime))
                .Join(
                    dbContext.Accounts.AsNoTracking(),
                    review => review.AccountId,
                    account => account.Id,
                    (review, account) => new
                    {
                        review.Id,
                        review.AccountId,
                        review.ConfirmationAttemptId,
                        review.ActingUserId,
                        AccountDescription = account.Description,
                    })
                .OrderBy(review => review.Id)
                .Take(BatchSize)
                .ToListAsync(cancellationToken);
            var recoveredClaimCount = 0;
            foreach (var review in staleClaims)
            {
                if (review.ConfirmationAttemptId is not Guid attemptId)
                {
                    continue;
                }

                var removed = await dbContext.ImportReviews
                    .Where(candidate =>
                        candidate.Id == review.Id
                        && candidate.AccountId == review.AccountId
                        && candidate.State == ImportReviewState.Processing
                        && candidate.ConfirmationAttemptId == attemptId
                        && candidate.ProcessingStartedAtUtc <= now.Add(-AbandonedClaimLifetime)
                        && dbContext.Accounts.Any(account =>
                            account.Id == candidate.AccountId
                            && account.ActiveImportId == candidate.Id))
                    .ExecuteDeleteAsync(cancellationToken);
                if (removed == 0)
                {
                    continue;
                }

                var released = await dbContext.Accounts
                    .Where(account =>
                        account.Id == review.AccountId
                        && account.ActiveImportId == review.Id)
                    .ExecuteUpdateAsync(
                        setters => setters.SetProperty(
                            account => account.ActiveImportId,
                            (Guid?)null),
                        cancellationToken);
                if (released != 1)
                {
                    throw new InvalidOperationException("The abandoned import lease changed during recovery.");
                }

                auditWriter.Add(
                    review.AccountDescription,
                    review.ActingUserId,
                    "ConfirmationFailed",
                    now);
                recoveredClaimCount++;
            }

            await dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return (transitionedCount, recoveredClaimCount);
        });

        if (expiredCount > 0 || recoveredCount > 0)
        {
            logger.LogInformation(
                "Cleaned up {ExpiredReviewCount} expired reviews and {RecoveredClaimCount} abandoned claims.",
                expiredCount,
                recoveredCount);
        }
    }
}
