using Clutch.API.Domain.Imports;
using Clutch.API.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using System.Text.Json.Serialization;

namespace Clutch.API.Application.Imports;

public sealed class ImportStateService(
    AppDbContext dbContext,
    TimeProvider timeProvider,
    ILogger<ImportStateService> logger)
{
    public static bool IsActive(
        ImportReviewState state,
        DateTimeOffset expiresAtUtc,
        DateTimeOffset now) =>
        state == ImportReviewState.Processing
        || (state == ImportReviewState.Ready && expiresAtUtc > now);

    public async Task<ImportCoordinationOutcome<ImportStatusResponse>> GetStatusAsync(
        string ownerUserId,
        Guid accountId,
        Guid? watchedReviewId,
        CancellationToken cancellationToken)
    {
        using var measurement = ImportMetrics.StartCoordination(ImportCoordinationOperation.Status);
        var now = timeProvider.GetUtcNow();
        var status = await dbContext.Accounts
            .AsNoTracking()
            .Where(account => account.Id == accountId && account.OwnerUserId == ownerUserId)
            .Select(account => new StatusProjection(
                account.Id,
                account.ActiveImportId,
                dbContext.ImportReviews
                    .AsNoTracking()
                    .Where(review =>
                        review.Id == account.ActiveImportId
                        && review.AccountId == account.Id)
                    .Select(review => new ReviewProjection(
                        review.Id,
                        review.AccountId,
                        review.State,
                        review.ExpiresAtUtc,
                        review.EndedByUserId,
                        review.EndedAtUtc,
                        dbContext.Users
                            .Where(user =>
                                user.Id == review.EndedByUserId
                                && review.AccountId == account.Id)
                            .Select(user => user.UserName)
                            .FirstOrDefault()))
                    .FirstOrDefault(),
                watchedReviewId == null
                    ? null
                    : dbContext.ImportReviews
                        .AsNoTracking()
                        .Where(review => review.Id == watchedReviewId)
                        .Select(review => new ReviewProjection(
                            review.Id,
                            review.AccountId,
                            review.State,
                            review.ExpiresAtUtc,
                            review.EndedByUserId,
                            review.EndedAtUtc,
                            dbContext.Users
                                .Where(user =>
                                    user.Id == review.EndedByUserId
                                    && review.AccountId == account.Id)
                                .Select(user => user.UserName)
                                .FirstOrDefault()))
                        .FirstOrDefault()))
            .SingleOrDefaultAsync(cancellationToken);

        if (status is null)
        {
            measurement.MarkFailed(ImportCoordinationError.AccountNotFound);
            return ImportCoordinationOutcome<ImportStatusResponse>.Failed(
                ImportCoordinationError.AccountNotFound);
        }

        var watched = BuildWatchedStatus(status.Id, watchedReviewId, status.WatchedReview, now);
        if (watched.Error is not null)
        {
            measurement.MarkFailed(watched.Error.Value);
            return ImportCoordinationOutcome<ImportStatusResponse>.Failed(watched.Error.Value);
        }

        var active = BuildActiveStatus(status, now);
        if (status.ActiveReviewId is not null && active is null)
        {
            logger.LogWarning("Import account lease references unclassifiable state.");
        }

        measurement.MarkSucceeded(
            active is null
                ? ImportCoordinationSuccessOutcome.Available
                : ImportCoordinationSuccessOutcome.Blocked);
        return ImportCoordinationOutcome<ImportStatusResponse>.Succeeded(
            new ImportStatusResponse(
                status.Id,
                active is null ? "Available" : "Blocked",
                active,
                watched.Value));
    }

    public async Task<ImportCoordinationOutcome<Guid>> TryClaimProcessingAsync(
        string ownerUserId,
        Guid reviewId,
        Guid attemptId,
        DateTimeOffset claimedAtUtc,
        CancellationToken cancellationToken)
    {
        using var measurement = ImportMetrics.StartCoordination(ImportCoordinationOperation.Claim);
        if (string.IsNullOrWhiteSpace(ownerUserId)
            || reviewId == Guid.Empty
            || attemptId == Guid.Empty
            || claimedAtUtc.Offset != TimeSpan.Zero)
        {
            measurement.MarkFailed(ImportCoordinationError.ImportChanged);
            return ImportCoordinationOutcome<Guid>.Failed(ImportCoordinationError.ImportChanged);
        }

        var strategy = dbContext.Database.CreateExecutionStrategy();
        var claimResult = await strategy.ExecuteAsync(async () =>
        {
            var updated = await dbContext.ImportReviews
                .Where(review =>
                    review.Id == reviewId
                    && review.State == ImportReviewState.Ready
                    && review.ExpiresAtUtc > claimedAtUtc
                    && dbContext.Accounts.Any(account =>
                        account.Id == review.AccountId
                        && account.OwnerUserId == ownerUserId
                        && account.ActiveImportId == review.Id))
                .ExecuteUpdateAsync(
                    setters => setters
                        .SetProperty(review => review.State, ImportReviewState.Processing)
                        .SetProperty(review => review.ConfirmationAttemptId, attemptId)
                        .SetProperty(review => review.ProcessingStartedAtUtc, claimedAtUtc),
                    cancellationToken);
            return updated;
        });

        if (claimResult == 1)
        {
            measurement.MarkSucceeded();
            return ImportCoordinationOutcome<Guid>.Succeeded(attemptId);
        }

        dbContext.ChangeTracker.Clear();
        var current = await dbContext.ImportReviews
            .AsNoTracking()
            .Where(review => review.Id == reviewId)
            .Join(
                dbContext.Accounts.AsNoTracking().Where(account => account.OwnerUserId == ownerUserId),
                review => review.AccountId,
                account => account.Id,
                (review, account) => new
                {
                    review.State,
                    review.ConfirmationAttemptId,
                    review.EndedAtUtc,
                    account.ActiveImportId,
                    review.ExpiresAtUtc,
                })
            .SingleOrDefaultAsync(cancellationToken);

        if (current is null)
        {
            measurement.MarkFailed(ImportCoordinationError.ReviewNotFound);
            return ImportCoordinationOutcome<Guid>.Failed(ImportCoordinationError.ReviewNotFound);
        }

        if (current.State == ImportReviewState.Processing
            && current.ConfirmationAttemptId == attemptId)
        {
            measurement.MarkSucceeded();
            return ImportCoordinationOutcome<Guid>.Succeeded(attemptId);
        }

        if (current.State == ImportReviewState.Processing)
        {
            measurement.MarkFailed(ImportCoordinationError.ImportNotEndable);
            return ImportCoordinationOutcome<Guid>.Failed(ImportCoordinationError.ImportNotEndable);
        }

        if (current.State == ImportReviewState.Cancelled && current.EndedAtUtc is not null)
        {
            measurement.MarkFailed(ImportCoordinationError.ImportEndedElsewhere);
            return ImportCoordinationOutcome<Guid>.Failed(ImportCoordinationError.ImportEndedElsewhere);
        }

        if (current.State == ImportReviewState.Ready
            && current.ExpiresAtUtc <= claimedAtUtc)
        {
            measurement.MarkFailed(ImportCoordinationError.ImportExpired);
            return ImportCoordinationOutcome<Guid>.Failed(ImportCoordinationError.ImportExpired);
        }

        if (current.ActiveImportId != reviewId)
        {
            measurement.MarkFailed(ImportCoordinationError.ImportChanged);
            return ImportCoordinationOutcome<Guid>.Failed(ImportCoordinationError.ImportChanged);
        }

        measurement.MarkFailed(ImportCoordinationError.ImportChanged);
        return ImportCoordinationOutcome<Guid>.Failed(ImportCoordinationError.ImportChanged);
    }

    private ImportActiveStatus? BuildActiveStatus(StatusProjection status, DateTimeOffset now)
    {
        if (status.ActiveReviewId is null)
        {
            return null;
        }

        var review = status.ActiveReview;
        if (review is null)
        {
            return UnknownActive(status.ActiveReviewId.Value);
        }

        if (review.State == ImportReviewState.Ready)
        {
            if (review.ExpiresAtUtc <= now)
            {
                return null;
            }

            return new ImportActiveStatus(review.Id, "Preview", true, review.ExpiresAtUtc);
        }

        if (review.State == ImportReviewState.Processing)
        {
            return new ImportActiveStatus(review.Id, "Processing", false, null);
        }

        logger.LogWarning("Import account lease points to a terminal review state.");
        return UnknownActive(status.ActiveReviewId.Value);
    }

    private static ImportActiveStatus UnknownActive(Guid reviewId) =>
        new(reviewId, "Unknown", false, null);

    private static WatchedStatusOutcome BuildWatchedStatus(
        Guid accountId,
        Guid? requestedReviewId,
        ReviewProjection? review,
        DateTimeOffset now)
    {
        if (requestedReviewId is null)
        {
            return WatchedStatusOutcome.Success(null);
        }

        if (review is null)
        {
            return WatchedStatusOutcome.Success(new ImportWatchedStatus(requestedReviewId.Value, "Unavailable"));
        }

        if (review.AccountId != accountId)
        {
            return WatchedStatusOutcome.Failure(ImportCoordinationError.ReviewNotFound);
        }

        if (review.State == ImportReviewState.Ready)
        {
            return review.ExpiresAtUtc <= now
                ? WatchedStatusOutcome.Success(new ImportWatchedStatus(review.Id, "Expired"))
                : WatchedStatusOutcome.Success(new ImportWatchedStatus(
                    review.Id,
                    "Ready",
                    ExpiresAtUtc: review.ExpiresAtUtc));
        }

        if (review.State == ImportReviewState.Processing)
        {
            return WatchedStatusOutcome.Success(new ImportWatchedStatus(review.Id, "Processing"));
        }

        if (review.State == ImportReviewState.Cancelled
            && review.EndedAtUtc is not null
            && !string.IsNullOrWhiteSpace(review.EndedByUserId))
        {
            if (string.IsNullOrWhiteSpace(review.EndedByUserName))
            {
                return WatchedStatusOutcome.Failure(ImportCoordinationError.EndingIdentityUnavailable);
            }

            return WatchedStatusOutcome.Success(new ImportWatchedStatus(
                review.Id,
                "Ended",
                EndedAtUtc: review.EndedAtUtc,
                EndedBy: new ImportEndingUser(review.EndedByUserId, review.EndedByUserName)));
        }

        if (review.State == ImportReviewState.Expired)
        {
            return WatchedStatusOutcome.Success(new ImportWatchedStatus(review.Id, "Expired"));
        }

        return WatchedStatusOutcome.Success(new ImportWatchedStatus(review.Id, "Unavailable"));
    }

    private sealed record StatusProjection(
        Guid Id,
        Guid? ActiveReviewId,
        ReviewProjection? ActiveReview,
        ReviewProjection? WatchedReview);

    private sealed record ReviewProjection(
        Guid Id,
        Guid AccountId,
        ImportReviewState State,
        DateTimeOffset ExpiresAtUtc,
        string? EndedByUserId,
        DateTimeOffset? EndedAtUtc,
        string? EndedByUserName);

    private sealed record WatchedStatusOutcome(
        ImportWatchedStatus? Value,
        ImportCoordinationError? Error)
    {
        public static WatchedStatusOutcome Success(ImportWatchedStatus? value) => new(value, null);

        public static WatchedStatusOutcome Failure(ImportCoordinationError error) => new(null, error);
    }
}

public enum ImportCoordinationError
{
    AccountNotFound,
    ReviewNotFound,
    ImportChanged,
    ImportExpired,
    ImportNotEndable,
    ImportEndedElsewhere,
    EndingIdentityUnavailable,
    ImportOutcomeUnknown,
}

public sealed record ImportCoordinationOutcome<T>(T? Value, ImportCoordinationError? Error)
{
    public bool IsSuccess => Error is null;

    public static ImportCoordinationOutcome<T> Succeeded(T value) => new(value, null);

    public static ImportCoordinationOutcome<T> Failed(ImportCoordinationError error) => new(default, error);
}

public sealed record ImportStatusResponse(
    Guid AccountId,
    string Availability,
    ImportActiveStatus? ActiveImport,
    ImportWatchedStatus? WatchedImport);

public sealed record ImportActiveStatus(
    Guid Id,
    string Stage,
    bool CanEnd,
    DateTimeOffset? ExpiresAtUtc);

public sealed record ImportWatchedStatus(
    Guid Id,
    string State,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    DateTimeOffset? ExpiresAtUtc = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    DateTimeOffset? EndedAtUtc = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    ImportEndingUser? EndedBy = null);

public sealed record ImportEndingUser(string UserId, string UserName);
