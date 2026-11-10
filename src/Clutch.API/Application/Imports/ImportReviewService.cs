using System.Data;
using System.Globalization;
using Clutch.API.Api.ProblemDetails;
using Clutch.API.Domain.Accounts;
using Clutch.API.Domain.Imports;
using Clutch.API.Domain.Transactions;
using Clutch.API.Infrastructure.Imports;
using Clutch.API.Infrastructure.Persistence;
using Clutch.API.Infrastructure.Persistence.Entities;
using Microsoft.EntityFrameworkCore;

namespace Clutch.API.Application.Imports;

public sealed class ImportReviewService(
    AppDbContext dbContext,
    CsvImportParser parser,
    AccountImportLease importLease,
    ImportAuditWriter auditWriter,
    IImportAttemptLimiter attemptLimiter,
    TimeProvider timeProvider)
{
    private static readonly TimeSpan ReviewLifetime = TimeSpan.FromMinutes(15);

    public async Task<ImportReviewResponse> CreateAsync(
        string ownerUserId,
        Guid accountId,
        Stream file,
        long fileSize,
        ImportMapping mapping,
        CancellationToken cancellationToken)
    {
        var account = await OwnedAccounts(ownerUserId)
            .AsNoTracking()
            .Where(candidate => candidate.Id == accountId)
            .Select(candidate => new AccountImportInfo(
                candidate.Id,
                candidate.CurrencyCode,
                candidate.ActiveImportId))
            .SingleOrDefaultAsync(cancellationToken);
        if (account is null)
        {
            throw AccountNotFound();
        }

        var limits = await GetLimitsAsync(cancellationToken);
        if (!await attemptLimiter.TryConsumeAsync(
            ownerUserId,
            limits.MaxImportAttemptsPerUserPerMinute,
            cancellationToken))
        {
            await auditWriter.WriteAsync(
                accountId,
                ownerUserId,
                "RateLimitExceeded",
                cancellationToken);
            throw Problem(
                StatusCodes.Status429TooManyRequests,
                "The import attempt limit has been reached.",
                "RateLimitExceeded");
        }

        if (fileSize > limits.MaxFileSizeBytes)
        {
            await auditWriter.WriteAsync(
                accountId,
                ownerUserId,
                "FileSizeLimitExceeded",
                cancellationToken);
            throw Problem(
                StatusCodes.Status413PayloadTooLarge,
                "The file exceeds the configured size limit.",
                "FileSizeLimitExceeded");
        }

        var now = timeProvider.GetUtcNow();
        if (account.ActiveImportId is not null)
        {
            await ExpireStaleReviewAsync(
                account.Id,
                account.ActiveImportId.Value,
                now,
                cancellationToken);
        }

        CsvImportResult parsed;
        try
        {
            parsed = await parser.ParseAsync(
                file,
                account.CurrencyCode,
                mapping,
                limits,
                cancellationToken);
        }
        catch (ImportValidationException exception)
        {
            await auditWriter.WriteAsync(
                accountId,
                ownerUserId,
                exception.Code,
                cancellationToken);
            throw ToProblem(exception);
        }

        var reviewId = Guid.NewGuid();
        var strategy = dbContext.Database.CreateExecutionStrategy();
        var response = await strategy.ExecuteAsync(async () =>
        {
            dbContext.ChangeTracker.Clear();
            await using var transaction = await dbContext.Database.BeginTransactionAsync(
                IsolationLevel.ReadCommitted,
                cancellationToken);
            if (!await importLease.TryAcquireAsync(accountId, reviewId, cancellationToken))
            {
                var existing = await OwnedReviews(ownerUserId)
                    .AsNoTracking()
                    .Include(candidate => candidate.Rows)
                    .SingleOrDefaultAsync(candidate => candidate.Id == reviewId, cancellationToken);
                await transaction.RollbackAsync(cancellationToken);
                return existing is null ? null : ToResponse(existing, account.CurrencyCode);
            }

            var createdAt = timeProvider.GetUtcNow();
            var review = new ImportReview(
                reviewId,
                accountId,
                ownerUserId,
                createdAt,
                createdAt.Add(ReviewLifetime));
            review.AddRows(await CreateReviewRows(review.Id, parsed.Rows, accountId, cancellationToken));
            dbContext.ImportReviews.Add(review);
            dbContext.ImportReviewMappingSnapshots.Add(ImportReviewMappingSnapshot.Create(
                review.Id,
                ImportMappingSettingsSerializer.CurrentSchemaVersion,
                ImportMappingSettingsSerializer.Serialize(mapping)));
            auditWriter.Add(review.Id, accountId, ownerUserId, "ReviewCreated", createdAt);
            var result = ToResponse(review, account.CurrencyCode);
            await dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return result;
        });

        if (response is null)
        {
            await auditWriter.WriteAsync(accountId, ownerUserId, "ConcurrentImportRejected", cancellationToken);
            throw Problem(
                StatusCodes.Status409Conflict,
                "An import is already active for this account.",
                "ConcurrentImport");
        }

        return response;
    }

    public async Task CancelAsync(
        string ownerUserId,
        Guid reviewId,
        CancellationToken cancellationToken)
    {
        var review = await OwnedReviews(ownerUserId)
            .AsNoTracking()
            .Where(candidate => candidate.Id == reviewId)
            .Select(candidate => new { candidate.Id, candidate.AccountId })
            .SingleOrDefaultAsync(cancellationToken);
        if (review is null)
        {
            throw ReviewNotFound();
        }

        await CancelReadyAsync(ownerUserId, review.AccountId, reviewId, cancellationToken);
    }

    public async Task CancelActiveAsync(
        string ownerUserId,
        Guid accountId,
        CancellationToken cancellationToken)
    {
        var account = await OwnedAccounts(ownerUserId)
            .AsNoTracking()
            .Where(candidate => candidate.Id == accountId)
            .Select(candidate => new { candidate.ActiveImportId })
            .SingleOrDefaultAsync(cancellationToken);
        if (account is null)
        {
            throw AccountNotFound();
        }

        if (account.ActiveImportId is Guid reviewId
            && !await CancelReadyAsync(ownerUserId, accountId, reviewId, cancellationToken))
        {
            throw Problem(
                StatusCodes.Status409Conflict,
                "The active import is still processing or has already changed. Try again shortly.",
                "ConcurrentImport");
        }
    }

    private async Task<bool> CancelReadyAsync(
        string ownerUserId,
        Guid accountId,
        Guid reviewId,
        CancellationToken cancellationToken,
        string eventCode = "ReviewCancelled")
    {
        var strategy = dbContext.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            dbContext.ChangeTracker.Clear();
            await using var transaction = await dbContext.Database.BeginTransactionAsync(
                IsolationLevel.ReadCommitted,
                cancellationToken);
            var transitioned = await OwnedReviews(ownerUserId)
                .Where(review => review.Id == reviewId
                    && review.AccountId == accountId
                    && review.State == ImportReviewState.Ready)
                .ExecuteUpdateAsync(
                    setters => setters.SetProperty(review => review.State, ImportReviewState.Cancelled),
                    cancellationToken);
            if (transitioned == 0)
            {
                // A review that is no longer Ready is terminal, so any lease it still holds is stale.
                var currentState = await OwnedReviews(ownerUserId)
                    .AsNoTracking()
                    .Where(review => review.Id == reviewId && review.AccountId == accountId)
                    .Select(review => (ImportReviewState?)review.State)
                    .SingleOrDefaultAsync(cancellationToken);
                if (currentState is null or ImportReviewState.Ready
                    || !await importLease.ReleaseAsync(accountId, reviewId, cancellationToken))
                {
                    await transaction.RollbackAsync(cancellationToken);
                    return false;
                }

                await transaction.CommitAsync(cancellationToken);
                return true;
            }

            await dbContext.ImportReviewRows
                .Where(row => row.ReviewId == reviewId)
                .ExecuteDeleteAsync(cancellationToken);
            await dbContext.ImportReviewMappingSnapshots
                .Where(snapshot => snapshot.ReviewId == reviewId)
                .ExecuteDeleteAsync(cancellationToken);
            await importLease.ReleaseAsync(accountId, reviewId, cancellationToken);
            auditWriter.Add(reviewId, accountId, ownerUserId, eventCode, timeProvider.GetUtcNow());
            await dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return true;
        });
    }

    internal async Task CancelAfterFailureAsync(
        string ownerUserId,
        Guid reviewId,
        CancellationToken cancellationToken)
    {
        var accountId = await OwnedReviews(ownerUserId)
            .AsNoTracking()
            .Where(review => review.Id == reviewId)
            .Select(review => (Guid?)review.AccountId)
            .SingleOrDefaultAsync(cancellationToken);
        if (accountId is Guid id)
        {
            await CancelReadyAsync(ownerUserId, id, reviewId, cancellationToken, "ConfirmationFailed");
        }
    }

    private async Task ExpireStaleReviewAsync(
        Guid accountId,
        Guid activeReviewId,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        var strategy = dbContext.Database.CreateExecutionStrategy();
        var activeReviewIsUnexpired = await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await dbContext.Database.BeginTransactionAsync(
                IsolationLevel.ReadCommitted,
                cancellationToken);
            var review = await dbContext.ImportReviews
                .AsNoTracking()
                .Where(candidate => candidate.Id == activeReviewId)
                .Select(candidate => new
                {
                    candidate.State,
                    candidate.ExpiresAtUtc,
                    candidate.ActingUserId,
                })
                .SingleOrDefaultAsync(cancellationToken);

            if (review is null)
            {
                await transaction.RollbackAsync(cancellationToken);
                return true;
            }

            if (review.State != ImportReviewState.Ready)
            {
                await importLease.ReleaseAsync(accountId, activeReviewId, cancellationToken);
                await transaction.CommitAsync(cancellationToken);
                return false;
            }

            if (review.ExpiresAtUtc > now)
            {
                await transaction.RollbackAsync(cancellationToken);
                return true;
            }

            var transitioned = await dbContext.ImportReviews
                .Where(candidate =>
                    candidate.Id == activeReviewId
                    && candidate.State == ImportReviewState.Ready
                    && candidate.ExpiresAtUtc <= now)
                .ExecuteUpdateAsync(
                    setters => setters.SetProperty(
                        candidate => candidate.State,
                        ImportReviewState.Expired),
                    cancellationToken);
            if (transitioned == 0)
            {
                var currentState = await dbContext.ImportReviews
                    .AsNoTracking()
                    .Where(candidate => candidate.Id == activeReviewId)
                    .Select(candidate => (ImportReviewState?)candidate.State)
                    .SingleOrDefaultAsync(cancellationToken);
                if (currentState != ImportReviewState.Ready)
                {
                    await importLease.ReleaseAsync(accountId, activeReviewId, cancellationToken);
                }
                await transaction.CommitAsync(cancellationToken);
                return currentState == ImportReviewState.Ready;
            }

            await dbContext.ImportReviewRows
                .Where(row => row.ReviewId == activeReviewId)
                .ExecuteDeleteAsync(cancellationToken);
            await dbContext.ImportReviewMappingSnapshots
                .Where(snapshot => snapshot.ReviewId == activeReviewId)
                .ExecuteDeleteAsync(cancellationToken);
            await importLease.ReleaseAsync(accountId, activeReviewId, cancellationToken);
            auditWriter.Add(
                activeReviewId,
                accountId,
                review.ActingUserId,
                "ReviewExpired",
                now);
            await dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return false;
        });

        if (activeReviewIsUnexpired)
        {
            throw Problem(
                StatusCodes.Status409Conflict,
                "An import is already active for this account.",
                "ConcurrentImport");
        }
    }

    private async Task<IReadOnlyList<ImportReviewRow>> CreateReviewRows(
        Guid reviewId,
        IReadOnlyList<ParsedImportRow> parsedRows,
        Guid accountId,
        CancellationToken cancellationToken)
    {
        var firstDate = parsedRows.Min(row => row.TransactionDate);
        var lastDate = parsedRows.Max(row => row.TransactionDate);
        var existingTransactions = await dbContext.Transactions
            .AsNoTracking()
            .Where(transaction =>
                transaction.AccountId == accountId
                && transaction.TransactionDate >= firstDate
                && transaction.TransactionDate <= lastDate)
            .Select(transaction => new TransactionFingerprint(
                transaction.TransactionDate,
                transaction.Description,
                transaction.Amount,
                transaction.Direction))
            .ToListAsync(cancellationToken);
        var duplicateRows = DuplicateDetector.FindDuplicateRows(
            existingTransactions,
            parsedRows.Select(row => new ImportFingerprintRow(
                row.SourceRowNumber,
                new TransactionFingerprint(
                    row.TransactionDate,
                    row.Description,
                    row.Amount,
                    row.Direction))));

        return parsedRows
            .Select(row => new ImportReviewRow(
                reviewId,
                row.SourceRowNumber,
                row.TransactionDate,
                row.Description,
                row.Amount,
                row.Direction,
                duplicateRows.Contains(row.SourceRowNumber),
                row.Balance))
            .ToArray();
    }

    private IQueryable<Account> OwnedAccounts(string ownerUserId) =>
        dbContext.Accounts.Where(account => account.OwnerUserId == ownerUserId);

    private IQueryable<ImportReview> OwnedReviews(string ownerUserId) =>
        dbContext.ImportReviews.Where(review =>
            dbContext.Accounts.Any(account =>
                account.Id == review.AccountId
                && account.OwnerUserId == ownerUserId));

    private async Task<ImportLimits> GetLimitsAsync(CancellationToken cancellationToken) =>
        await dbContext.ImportLimitSettings
            .AsNoTracking()
            .Select(settings => new ImportLimits(
                settings.MaxFileSizeBytes,
                settings.MaxRowsPerImport,
                settings.MaxImportAttemptsPerUserPerMinute))
            .SingleOrDefaultAsync(cancellationToken) ?? ImportLimits.Default;

    private static ImportReviewResponse ToResponse(ImportReview review, string currencyCode) =>
        new(
            review.Id,
            review.AccountId,
            currencyCode,
            review.Rows.Count,
            review.DuplicateConfirmationRequired,
            review.ExpiresAtUtc,
            review.Rows.Select(row => new ImportReviewRowResponse(
                row.SourceRowNumber,
                row.TransactionDate,
                row.Description,
                row.Amount.ToString("0.############################", CultureInfo.InvariantCulture),
                row.Direction.ToString(),
                row.IsPossibleDuplicate,
                row.Balance?.ToString("0.############################", CultureInfo.InvariantCulture))).ToArray());

    private static ApiProblemException ToProblem(ImportValidationException exception)
    {
        var errors = new Dictionary<string, string[]>();
        if (exception.RowNumber is not null)
        {
            errors.Add("rowNumber", [exception.RowNumber.Value.ToString()]);
        }

        if (exception.Field is not null)
        {
            errors.Add("field", [exception.Field]);
        }

        var statusCode = exception.Code is "FileSizeLimitExceeded" or "RowLimitExceeded"
            ? StatusCodes.Status413PayloadTooLarge
            : StatusCodes.Status400BadRequest;
        return new ApiProblemException(
            statusCode,
            "The import file could not be reviewed.",
            exception.Message,
            errors.Count == 0 ? null : errors);
    }

    private static ApiProblemException Problem(int statusCode, string detail, string code) =>
        new(
            statusCode,
            "The import could not be started.",
            detail,
            new Dictionary<string, string[]> { ["code"] = [code] });

    private static ApiProblemException AccountNotFound() =>
        new(
            StatusCodes.Status404NotFound,
            "Account not found.",
            "The account does not exist or is not available to this user.");

    private static ApiProblemException ReviewNotFound() =>
        new(
            StatusCodes.Status404NotFound,
            "Import review not found.",
            "The import review does not exist or is not available to this user.");

    private sealed record AccountImportInfo(Guid Id, string CurrencyCode, Guid? ActiveImportId);

}

public sealed record ImportReviewResponse(
    Guid Id,
    Guid AccountId,
    string CurrencyCode,
    int RowCount,
    bool DuplicateConfirmationRequired,
    DateTimeOffset ExpiresAtUtc,
    IReadOnlyList<ImportReviewRowResponse> Rows);

public sealed record ImportReviewRowResponse(
    int SourceRowNumber,
    DateOnly TransactionDate,
    string Description,
    string Amount,
    string Direction,
    bool IsPossibleDuplicate,
    string? Balance = null);
