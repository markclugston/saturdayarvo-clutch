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
    private static readonly TimeSpan ReviewLifetime = TimeSpan.FromMinutes(5);

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
                candidate.ActiveImportId,
                candidate.Description))
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
                account.Description,
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
                account.Description,
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
                account.Description,
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
                account.Description,
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
                createdAt.Add(ReviewLifetime),
                ImportMappingSettingsSerializer.CurrentSchemaVersion,
                ImportMappingSettingsSerializer.Serialize(mapping));
            review.AddRows(await CreateReviewRows(
                review.Id,
                parsed.Rows,
                accountId,
                mapping.BalanceColumn is not null,
                cancellationToken));
            dbContext.ImportReviews.Add(review);
            auditWriter.Add(account.Description, ownerUserId, "ReviewCreated", createdAt);
            var result = ToResponse(review, account.CurrencyCode);
            await dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return result;
        });

        if (response is null)
        {
            await auditWriter.WriteAsync(
                account.Description,
                ownerUserId,
                "ConcurrentImportRejected",
                cancellationToken);
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
        var review = await dbContext.ImportReviews
            .AsNoTracking()
            .Where(candidate => candidate.Id == reviewId)
            .Join(
                dbContext.Accounts
                    .AsNoTracking()
                    .Where(account => account.OwnerUserId == ownerUserId),
                candidate => candidate.AccountId,
                account => account.Id,
                (candidate, account) => new
                {
                    candidate.Id,
                    candidate.AccountId,
                    AccountDescription = account.Description,
                })
            .SingleOrDefaultAsync(cancellationToken);
        if (review is null)
        {
            throw ReviewNotFound();
        }

        if (!await CancelReadyAsync(
            ownerUserId,
            review.AccountId,
            reviewId,
            review.AccountDescription,
            cancellationToken))
        {
            throw Problem(
                StatusCodes.Status409Conflict,
                "The import has changed.",
                "Recheck the account import status before continuing.",
                "ImportChanged");
        }
    }

    public async Task CancelActiveAsync(
        string ownerUserId,
        Guid accountId,
        CancellationToken cancellationToken)
    {
        var account = await OwnedAccounts(ownerUserId)
            .AsNoTracking()
            .Where(candidate => candidate.Id == accountId)
            .Select(candidate => new { candidate.ActiveImportId, candidate.Description })
            .SingleOrDefaultAsync(cancellationToken);
        if (account is null)
        {
            throw AccountNotFound();
        }

        if (account.ActiveImportId is Guid reviewId
            && !await CancelReadyAsync(
                ownerUserId,
                accountId,
                reviewId,
                account.Description,
                cancellationToken))
        {
            throw Problem(
                StatusCodes.Status409Conflict,
                "The active import is still processing or has already changed. Try again shortly.",
                "ImportNotEndable");
        }
    }

    public async Task<ImportCoordinationOutcome<bool>> EndReviewElsewhereAsync(
        string ownerUserId,
        Guid accountId,
        Guid reviewId,
        CancellationToken cancellationToken)
    {
        using var measurement = ImportMetrics.StartCoordination(ImportCoordinationOperation.End);
        var now = timeProvider.GetUtcNow();
        var strategy = dbContext.Database.CreateExecutionStrategy();
        var outcome = await strategy.ExecuteAsync(async () =>
        {
            dbContext.ChangeTracker.Clear();
            await using var transaction = await dbContext.Database.BeginTransactionAsync(
                IsolationLevel.ReadCommitted,
                cancellationToken);
            var account = await OwnedAccounts(ownerUserId)
                .AsNoTracking()
                .Where(candidate => candidate.Id == accountId)
                .Select(candidate => candidate.Description)
                .SingleOrDefaultAsync(cancellationToken);
            if (account is null)
            {
                await transaction.RollbackAsync(cancellationToken);
                return ImportCoordinationOutcome<bool>.Failed(ImportCoordinationError.AccountNotFound);
            }

            var review = await OwnedReviews(ownerUserId)
                .AsNoTracking()
                .Where(candidate => candidate.Id == reviewId && candidate.AccountId == accountId)
                .Select(candidate => new
                {
                    candidate.State,
                    candidate.ExpiresAtUtc,
                    candidate.EndedByUserId,
                    candidate.EndedAtUtc,
                })
                .SingleOrDefaultAsync(cancellationToken);
            if (review is null)
            {
                var existsInAnotherAccount = await dbContext.ImportReviews
                    .AsNoTracking()
                    .AnyAsync(candidate => candidate.Id == reviewId, cancellationToken);
                await transaction.RollbackAsync(cancellationToken);
                return ImportCoordinationOutcome<bool>.Failed(
                    existsInAnotherAccount
                        ? ImportCoordinationError.ReviewNotFound
                        : ImportCoordinationError.ImportChanged);
            }

            if (IsExternallyEnded(review.State, review.EndedByUserId, review.EndedAtUtc))
            {
                await transaction.RollbackAsync(cancellationToken);
                return ImportCoordinationOutcome<bool>.Succeeded(true);
            }

            if (review.State == ImportReviewState.Processing)
            {
                await transaction.RollbackAsync(cancellationToken);
                return ImportCoordinationOutcome<bool>.Failed(ImportCoordinationError.ImportNotEndable);
            }

            if (review.State != ImportReviewState.Ready || review.ExpiresAtUtc <= now)
            {
                await transaction.RollbackAsync(cancellationToken);
                return ImportCoordinationOutcome<bool>.Failed(ImportCoordinationError.ImportChanged);
            }

            var locked = await OwnedReviews(ownerUserId)
                .Where(candidate =>
                    candidate.Id == reviewId
                    && candidate.AccountId == accountId
                    && candidate.State == ImportReviewState.Ready
                    && candidate.ExpiresAtUtc > now
                    && dbContext.Accounts.Any(ownedAccount =>
                        ownedAccount.Id == accountId
                        && ownedAccount.OwnerUserId == ownerUserId
                        && ownedAccount.ActiveImportId == candidate.Id))
                .ExecuteUpdateAsync(
                    setters => setters.SetProperty(candidate => candidate.State, candidate => candidate.State),
                    cancellationToken);

            if (locked != 1)
            {
                var latest = await OwnedReviews(ownerUserId)
                    .AsNoTracking()
                    .Where(candidate => candidate.Id == reviewId && candidate.AccountId == accountId)
                    .Select(candidate => new
                    {
                        candidate.State,
                        candidate.EndedByUserId,
                        candidate.EndedAtUtc,
                    })
                    .SingleOrDefaultAsync(cancellationToken);
                await transaction.RollbackAsync(cancellationToken);
                if (latest is not null
                    && IsExternallyEnded(latest.State, latest.EndedByUserId, latest.EndedAtUtc))
                {
                    return ImportCoordinationOutcome<bool>.Succeeded(true);
                }

                if (latest?.State == ImportReviewState.Processing)
                {
                    return ImportCoordinationOutcome<bool>.Failed(ImportCoordinationError.ImportNotEndable);
                }

                return ImportCoordinationOutcome<bool>.Failed(ImportCoordinationError.ImportChanged);
            }

            dbContext.ChangeTracker.Clear();
            var reviewToEnd = await OwnedReviews(ownerUserId)
                .SingleOrDefaultAsync(
                    candidate => candidate.Id == reviewId && candidate.AccountId == accountId,
                    cancellationToken);
            if (reviewToEnd is null || !reviewToEnd.TryEndElsewhere(ownerUserId, now))
            {
                await transaction.RollbackAsync(cancellationToken);
                return ImportCoordinationOutcome<bool>.Failed(ImportCoordinationError.ImportChanged);
            }

            await dbContext.ImportReviewRows
                .Where(row => row.ReviewId == reviewId)
                .ExecuteDeleteAsync(cancellationToken);
            if (!await importLease.ReleaseAsync(accountId, reviewId, cancellationToken))
            {
                await transaction.RollbackAsync(cancellationToken);
                return ImportCoordinationOutcome<bool>.Failed(ImportCoordinationError.ImportChanged);
            }

            auditWriter.Add(account, ownerUserId, "ReviewEndedElsewhere", now);
            await dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return ImportCoordinationOutcome<bool>.Succeeded(true);
        });

        if (outcome.IsSuccess)
        {
            measurement.MarkSucceeded();
        }
        else
        {
            measurement.MarkFailed(outcome.Error!.Value);
        }

        return outcome;
    }

    private async Task<bool> CancelReadyAsync(
        string ownerUserId,
        Guid accountId,
        Guid reviewId,
        string accountDescription,
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
                var currentState = await OwnedReviews(ownerUserId)
                    .AsNoTracking()
                    .Where(review => review.Id == reviewId && review.AccountId == accountId)
                    .Select(review => new { review.State, review.EndedAtUtc })
                    .SingleOrDefaultAsync(cancellationToken);
                await transaction.RollbackAsync(cancellationToken);
                if (currentState?.State == ImportReviewState.Processing)
                {
                    throw Problem(
                        StatusCodes.Status409Conflict,
                        "The import is already being processed.",
                        "Once confirmation has been accepted, an import cannot be ended.",
                        "ImportNotEndable");
                }

                if (currentState?.State == ImportReviewState.Cancelled
                    && currentState.EndedAtUtc is not null)
                {
                    throw Problem(
                        StatusCodes.Status409Conflict,
                        "The import was ended elsewhere.",
                        "Return to the account's transactions before continuing.",
                        "ImportEndedElsewhere");
                }

                if (currentState is null || currentState.State != ImportReviewState.Ready)
                {
                    return false;
                }

                return false;
            }

            await dbContext.ImportReviewRows
                .Where(row => row.ReviewId == reviewId)
                .ExecuteDeleteAsync(cancellationToken);
            await importLease.ReleaseAsync(accountId, reviewId, cancellationToken);

            auditWriter.Add(accountDescription, ownerUserId, eventCode, timeProvider.GetUtcNow());
            await dbContext.ImportReviews
                .Where(candidate => candidate.Id == reviewId)
                .ExecuteDeleteAsync(cancellationToken);
            await dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return true;
        });
    }

    internal async Task<bool> FailProcessingAttemptAsync(
        string ownerUserId,
        Guid reviewId,
        Guid attemptId,
        CancellationToken cancellationToken)
    {
        var strategy = dbContext.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            dbContext.ChangeTracker.Clear();
            await using var transaction = await dbContext.Database.BeginTransactionAsync(
                IsolationLevel.ReadCommitted,
                cancellationToken);
            var review = await OwnedReviews(ownerUserId)
                .Where(candidate => candidate.Id == reviewId)
                .Select(candidate => new
                {
                    candidate.AccountId,
                    candidate.ActingUserId,
                    AccountDescription = dbContext.Accounts
                        .Where(account => account.Id == candidate.AccountId)
                        .Select(account => account.Description)
                        .FirstOrDefault(),
                })
                .SingleOrDefaultAsync(cancellationToken);
            if (review is null)
            {
                await transaction.RollbackAsync(cancellationToken);
                return false;
            }

            var locked = await dbContext.ImportReviews
                .Where(candidate =>
                    candidate.Id == reviewId
                    && candidate.AccountId == review.AccountId
                    && candidate.State == ImportReviewState.Processing
                    && candidate.ConfirmationAttemptId == attemptId
                    && dbContext.Accounts.Any(account =>
                        account.Id == candidate.AccountId
                        && account.OwnerUserId == ownerUserId
                        && account.ActiveImportId == candidate.Id))
                .ExecuteUpdateAsync(
                    setters => setters.SetProperty(candidate => candidate.ConfirmationAttemptId, attemptId),
                    cancellationToken);
            if (locked != 1)
            {
                await transaction.RollbackAsync(cancellationToken);
                return false;
            }

            await dbContext.ImportReviewRows
                .Where(row => row.ReviewId == reviewId)
                .ExecuteDeleteAsync(cancellationToken);
            if (!await importLease.ReleaseAsync(review.AccountId, reviewId, cancellationToken))
            {
                await transaction.RollbackAsync(cancellationToken);
                return false;
            }

            auditWriter.Add(
                review.AccountDescription!,
                review.ActingUserId,
                "ConfirmationFailed",
                timeProvider.GetUtcNow());
            await dbContext.ImportReviews
                .Where(candidate => candidate.Id == reviewId
                    && candidate.State == ImportReviewState.Processing
                    && candidate.ConfirmationAttemptId == attemptId)
                .ExecuteDeleteAsync(cancellationToken);
            await dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return true;
        });
    }

    internal async Task<bool> ExpireReadyReviewAsync(
        string ownerUserId,
        Guid reviewId,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        var strategy = dbContext.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            dbContext.ChangeTracker.Clear();
            await using var transaction = await dbContext.Database.BeginTransactionAsync(
                IsolationLevel.ReadCommitted,
                cancellationToken);
            var review = await OwnedReviews(ownerUserId)
                .AsNoTracking()
                .Where(candidate => candidate.Id == reviewId)
                .Select(candidate => new
                {
                    candidate.AccountId,
                    candidate.ActingUserId,
                    AccountDescription = dbContext.Accounts
                        .Where(account => account.Id == candidate.AccountId)
                        .Select(account => account.Description)
                        .FirstOrDefault(),
                })
                .SingleOrDefaultAsync(cancellationToken);
            if (review is null)
            {
                await transaction.RollbackAsync(cancellationToken);
                return false;
            }

            var expired = await dbContext.ImportReviews
                .Where(candidate =>
                    candidate.Id == reviewId
                    && candidate.AccountId == review.AccountId
                    && candidate.State == ImportReviewState.Ready
                    && candidate.ExpiresAtUtc <= now
                    && dbContext.Accounts.Any(account =>
                        account.Id == candidate.AccountId
                        && account.OwnerUserId == ownerUserId
                        && account.ActiveImportId == candidate.Id))
                .ExecuteUpdateAsync(
                    setters => setters.SetProperty(candidate => candidate.State, ImportReviewState.Expired),
                    cancellationToken);
            if (expired != 1)
            {
                await transaction.RollbackAsync(cancellationToken);
                return false;
            }

            await dbContext.ImportReviewRows
                .Where(row => row.ReviewId == reviewId)
                .ExecuteDeleteAsync(cancellationToken);
            if (!await importLease.ReleaseAsync(review.AccountId, reviewId, cancellationToken))
            {
                await transaction.RollbackAsync(cancellationToken);
                return false;
            }

            auditWriter.Add(
                review.AccountDescription!,
                review.ActingUserId,
                "ReviewExpired",
                now);
            await dbContext.ImportReviews
                .Where(candidate => candidate.Id == reviewId
                    && candidate.State == ImportReviewState.Expired)
                .ExecuteDeleteAsync(cancellationToken);
            await dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return true;
        });
    }

    private async Task ExpireStaleReviewAsync(
        Guid accountId,
        Guid activeReviewId,
        string accountDescription,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        var strategy = dbContext.Database.CreateExecutionStrategy();
        var activeReviewIsUnexpired = await strategy.ExecuteAsync(async () =>
        {
            dbContext.ChangeTracker.Clear();
            await using var transaction = await dbContext.Database.BeginTransactionAsync(
                IsolationLevel.ReadCommitted,
                cancellationToken);
            var review = await dbContext.ImportReviews
                .AsNoTracking()
                .Where(candidate =>
                    candidate.Id == activeReviewId
                    && candidate.AccountId == accountId)
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

            if (review.State != ImportReviewState.Ready
                || ImportStateService.IsActive(review.State, review.ExpiresAtUtc, now))
            {
                await transaction.RollbackAsync(cancellationToken);
                return true;
            }

            var transitioned = await dbContext.ImportReviews
                .Where(candidate =>
                    candidate.Id == activeReviewId
                    && candidate.State == ImportReviewState.Ready
                    && candidate.ExpiresAtUtc <= now
                    && dbContext.Accounts.Any(account =>
                        account.Id == accountId
                        && account.ActiveImportId == activeReviewId))
                .ExecuteUpdateAsync(
                    setters => setters.SetProperty(
                        candidate => candidate.State,
                        ImportReviewState.Expired),
                    cancellationToken);
            if (transitioned == 0)
            {
                await transaction.RollbackAsync(cancellationToken);
                return true;
            }

            await dbContext.ImportReviewRows
                .Where(row => row.ReviewId == activeReviewId)
                .ExecuteDeleteAsync(cancellationToken);
            if (!await importLease.ReleaseAsync(accountId, activeReviewId, cancellationToken))
            {
                await transaction.RollbackAsync(cancellationToken);
                return true;
            }

            auditWriter.Add(
                accountDescription,
                review.ActingUserId,
                "ReviewExpired",
                now);
            await dbContext.ImportReviews
                .Where(candidate => candidate.Id == activeReviewId)
                .ExecuteDeleteAsync(cancellationToken);
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
        bool hasBalanceColumn,
        CancellationToken cancellationToken)
    {
        var excludedRows = ImportExclusions.Determine(
            parsedRows.Select(row => new ImportExclusionRow(
                new ImportOrderRow(
                    row.SourceRowNumber,
                    row.TransactionDate,
                    row.Amount,
                    row.Direction,
                    row.Balance),
                row.Description)).ToArray(),
            hasBalanceColumn).ExcludedRowNumbers;
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
            parsedRows
                .Where(row => !excludedRows.Contains(row.SourceRowNumber))
                .Select(row => new ImportFingerprintRow(
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
                row.Balance,
                excludedRows.Contains(row.SourceRowNumber)))
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
            review.Rows.Count(row => !row.IsExcluded),
            review.DuplicateConfirmationRequired,
            review.ExpiresAtUtc,
            review.Rows.OrderBy(row => row.SourceRowNumber).Select(row => new ImportReviewRowResponse(
                row.SourceRowNumber,
                row.TransactionDate,
                row.Description,
                row.Amount.ToString("0.############################", CultureInfo.InvariantCulture),
                row.Direction.ToString(),
                row.IsPossibleDuplicate,
                row.IsExcluded,
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

    private static ApiProblemException Problem(int statusCode, string title, string detail, string code) =>
        new(
            statusCode,
            title,
            detail,
            new Dictionary<string, string[]> { ["code"] = [code] });

    private static bool IsExternallyEnded(
        ImportReviewState state,
        string? endedByUserId,
        DateTimeOffset? endedAtUtc) =>
        state == ImportReviewState.Cancelled
        && !string.IsNullOrWhiteSpace(endedByUserId)
        && endedAtUtc is not null;

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

    private sealed record AccountImportInfo(
        Guid Id,
        string CurrencyCode,
        Guid? ActiveImportId,
        string Description);

}

public sealed record ImportReviewResponse(
    Guid Id,
    Guid AccountId,
    string CurrencyCode,
    int RowCount,
    int ImportRowCount,
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
    bool IsExcluded,
    string? Balance = null);
