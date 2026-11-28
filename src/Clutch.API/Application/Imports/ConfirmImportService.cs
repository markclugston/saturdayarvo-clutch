using System.Data;
using Clutch.API.Api.ProblemDetails;
using Clutch.API.Domain.Accounts;
using Clutch.API.Domain.Imports;
using Clutch.API.Domain.Shared;
using Clutch.API.Domain.Transactions;
using Clutch.API.Infrastructure.Imports;
using Clutch.API.Infrastructure.Persistence;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace Clutch.API.Application.Imports;

public sealed class ConfirmImportService(
    AppDbContext dbContext,
    ImportAuditWriter auditWriter,
    ImportReviewService importReviewService,
    ImportStateService importStateService,
    AccountImportSettingsService accountImportSettingsService,
    TimeProvider timeProvider)
{
    public async Task<ConfirmImportResponse> ConfirmAsync(
        string ownerUserId,
        Guid reviewId,
        bool confirmPossibleDuplicates,
        CancellationToken cancellationToken)
    {
        using var importMeasurement = ImportMetrics.StartImport();
        var attemptId = Guid.NewGuid();
        var claimedAt = timeProvider.GetUtcNow();
        var claim = await importStateService.TryClaimProcessingAsync(
            ownerUserId,
            reviewId,
            attemptId,
            claimedAt,
            cancellationToken);
        if (!claim.IsSuccess)
        {
            if (claim.Error == ImportCoordinationError.ImportExpired)
            {
                await importReviewService.ExpireReadyReviewAsync(
                    ownerUserId,
                    reviewId,
                    claimedAt,
                    cancellationToken);
                throw ReviewExpired();
            }

            throw ToProblem(claim.Error!.Value);
        }

        ConfirmOutcome outcome;
        try
        {
            var strategy = dbContext.Database.CreateExecutionStrategy();
            outcome = await strategy.ExecuteAsync(() => ConfirmWithinTransactionAsync(
                ownerUserId,
                reviewId,
                attemptId,
                confirmPossibleDuplicates,
                cancellationToken));
        }
        catch (Exception exception)
        {
            dbContext.ChangeTracker.Clear();
            var cleaned = await importReviewService.FailProcessingAttemptAsync(
                ownerUserId,
                reviewId,
                attemptId,
                CancellationToken.None);
            if (!cleaned)
            {
                throw ImportOutcomeUnknown();
            }

            if (exception is OperationCanceledException)
            {
                throw;
            }

            if (exception is DbUpdateException or SqlException)
            {
                throw ConfirmationFailed();
            }

            throw;
        }

        if (outcome.Problem is not null)
        {
            if (outcome.CleanupAttempt)
            {
                dbContext.ChangeTracker.Clear();
                var cleaned = await importReviewService.FailProcessingAttemptAsync(
                    ownerUserId,
                    reviewId,
                    attemptId,
                    CancellationToken.None);
                if (!cleaned)
                {
                    throw ImportOutcomeUnknown();
                }
            }

            throw outcome.Problem;
        }

        importMeasurement.MarkSucceeded(outcome.Response!.ImportedCount);
        return outcome.Response;
    }

    private async Task<ConfirmOutcome> ConfirmWithinTransactionAsync(
        string ownerUserId,
        Guid reviewId,
        Guid attemptId,
        bool confirmPossibleDuplicates,
        CancellationToken cancellationToken)
    {
        await using var transaction = await dbContext.Database.BeginTransactionAsync(
            IsolationLevel.ReadCommitted,
            cancellationToken);

        var locked = await dbContext.ImportReviews
            .Where(review =>
                review.Id == reviewId
                && review.State == ImportReviewState.Processing
                && review.ConfirmationAttemptId == attemptId
                && dbContext.Accounts.Any(account =>
                    account.Id == review.AccountId
                    && account.OwnerUserId == ownerUserId
                    && account.ActiveImportId == review.Id))
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(review => review.ConfirmationAttemptId, attemptId),
                cancellationToken);
        if (locked != 1)
        {
            return await RollbackOutcomeAsync(
                transaction,
                ImportOutcomeUnknown(),
                cleanupAttempt: false);
        }

        dbContext.ChangeTracker.Clear();
        var review = await OwnedReviews(ownerUserId)
            .Include(candidate => candidate.Rows)
            .SingleOrDefaultAsync(candidate => candidate.Id == reviewId, cancellationToken);
        if (review is null
            || review.State != ImportReviewState.Processing
            || review.ConfirmationAttemptId != attemptId)
        {
            return await RollbackOutcomeAsync(
                transaction,
                ImportOutcomeUnknown(),
                cleanupAttempt: false);
        }

        var account = await OwnedAccounts(ownerUserId)
            .SingleOrDefaultAsync(candidate => candidate.Id == review.AccountId, cancellationToken);
        if (account is null)
        {
            return await RollbackOutcomeAsync(transaction, AccountNotFound());
        }

        if (account.ActiveImportId != review.Id)
        {
            return await RollbackOutcomeAsync(transaction, LeaseNotOwned());
        }

        if (!Currency.TryGet(account.CurrencyCode, out var currency) || currency is null)
        {
            return await RollbackOutcomeAsync(transaction, AccountNotFound());
        }

        var reviewRows = review.Rows.OrderBy(row => row.SourceRowNumber).ToArray();
        if (reviewRows.Length == 0)
        {
            return await RollbackOutcomeAsync(transaction, InvalidStagedData());
        }

        // Excluded rows are never saved or counted as duplicates; there may be nothing left to save.
        var importRows = reviewRows.Where(row => !row.IsExcluded).ToArray();
        var firstDate = reviewRows.Min(row => row.TransactionDate);
        var lastDate = reviewRows.Max(row => row.TransactionDate);
        var savedRows = await dbContext.Transactions
            .AsNoTracking()
            .Where(candidate =>
                candidate.AccountId == account.Id
                && candidate.TransactionDate >= firstDate
                && candidate.TransactionDate <= lastDate)
            .Select(candidate => new SavedRow(
                new TransactionFingerprint(
                    candidate.TransactionDate,
                    candidate.Description,
                    candidate.Amount,
                    candidate.Direction),
                candidate.Sequence))
            .ToListAsync(cancellationToken);
        var existingTransactions = savedRows.Select(saved => saved.Fingerprint).ToList();
        var maxSequenceByDate = savedRows
            .GroupBy(saved => saved.Fingerprint.TransactionDate)
            .ToDictionary(group => group.Key, group => group.Max(saved => saved.Sequence));
        var previouslyFlaggedRows = reviewRows
            .Where(row => row.IsPossibleDuplicate)
            .Select(row => row.SourceRowNumber)
            .ToHashSet();
        var duplicateRows = DuplicateDetector.FindDuplicateRows(
            existingTransactions,
            importRows.Select(row => new ImportFingerprintRow(
                row.SourceRowNumber,
                new TransactionFingerprint(
                    row.TransactionDate,
                    row.Description,
                    row.Amount,
                    row.Direction))));
        var newlyDiscoveredDuplicates = duplicateRows.Except(previouslyFlaggedRows).ToHashSet();
        if (newlyDiscoveredDuplicates.Count > 0
            || (review.DuplicateConfirmationRequired && !confirmPossibleDuplicates))
        {
            if (!review.TryRejectProcessing(attemptId, duplicateRows))
            {
                return await RollbackOutcomeAsync(transaction, InvalidStagedData());
            }

            await dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return ConfirmOutcome.Failed(DuplicateConfirmationRequired(duplicateRows), cleanupAttempt: false);
        }

        if (review.SchemaVersion is null || review.MappingJson is null)
        {
            return await RollbackOutcomeAsync(transaction, InvalidStagedData());
        }

        var mapping = ImportMappingSettingsSerializer.Deserialize(
            review.SchemaVersion.Value,
            review.MappingJson);
        var transactions = new List<Transaction>(importRows.Length);
        var now = timeProvider.GetUtcNow();
        // Each date's rows go in chronological order after that date's saved rows; saved rows are
        // never renumbered (FR-002). Balances only decide the file direction, which is read from
        // every staged row by the same rule that marked the exclusions.
        var direction = ImportExclusions.Determine(
            reviewRows
                .Select(row => new ImportExclusionRow(
                    new ImportOrderRow(
                        row.SourceRowNumber,
                        row.TransactionDate,
                        row.Amount,
                        row.Direction,
                        row.Balance),
                    row.Description))
                .ToArray(),
            mapping.BalanceColumn is not null).Direction;
        var groups = ImportOrdering.ChronologicalGroups(
            importRows
                .Select(row => new ImportOrderRow(
                    row.SourceRowNumber,
                    row.TransactionDate,
                    row.Amount,
                    row.Direction,
                    row.Balance))
                .ToArray(),
            direction);
        var rowsByNumber = importRows.ToDictionary(row => row.SourceRowNumber);
        foreach (var (date, group) in groups.OrderBy(entry => entry.Key))
        {
            var sequence = maxSequenceByDate.GetValueOrDefault(date);
            foreach (var orderedRow in group)
            {
                sequence++;
                var row = rowsByNumber[orderedRow.SourceRowNumber];
                if (!Transaction.TryCreate(
                    account.Id,
                    row.TransactionDate,
                    row.Description,
                    row.Amount,
                    row.Direction,
                    row.Balance,
                    sequence,
                    currency,
                    now,
                    out var newTransaction)
                    || newTransaction is null)
                {
                    return await RollbackOutcomeAsync(transaction, InvalidStagedData());
                }

                transactions.Add(newTransaction);
            }
        }

        dbContext.Transactions.AddRange(transactions);
        await accountImportSettingsService.SaveAsync(account.Id, mapping, cancellationToken);
        account.MarkSuccessfulImport(now);
        if (!account.TryReleaseImport(review.Id))
        {
            return await RollbackOutcomeAsync(transaction, LeaseNotOwned());
        }

        dbContext.ImportReviews.Remove(review);
        auditWriter.Add(
            account.Description,
            ownerUserId,
            "ImportConfirmed",
            now);
        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return ConfirmOutcome.Succeeded(
            new ConfirmImportResponse(transactions.Count, now, SettingsSaved: true));
    }

    private async Task<ConfirmOutcome> RollbackOutcomeAsync(
        Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction transaction,
        ApiProblemException problem,
        bool cleanupAttempt = true)
    {
        await transaction.RollbackAsync(CancellationToken.None);
        return ConfirmOutcome.Failed(problem, cleanupAttempt);
    }

    private IQueryable<Account> OwnedAccounts(string ownerUserId) =>
        dbContext.Accounts.Where(account => account.OwnerUserId == ownerUserId);

    private IQueryable<ImportReview> OwnedReviews(string ownerUserId) =>
        dbContext.ImportReviews.Where(review =>
            dbContext.Accounts.Any(account =>
                account.Id == review.AccountId
                && account.OwnerUserId == ownerUserId));

    private static ApiProblemException ToProblem(ImportCoordinationError error) =>
        error switch
        {
            ImportCoordinationError.ReviewNotFound => ReviewNotFound(),
            ImportCoordinationError.ImportNotEndable => ImportNotEndable(),
            ImportCoordinationError.ImportEndedElsewhere => ImportEndedElsewhere(),
            ImportCoordinationError.ImportOutcomeUnknown => ImportOutcomeUnknown(),
            _ => LeaseNotOwned(),
        };

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

    private static ApiProblemException ImportNotEndable() =>
        Problem(
            StatusCodes.Status409Conflict,
            "The import is already being processed.",
            "Once confirmation has been accepted, an import cannot be ended from another session.",
            "ImportNotEndable");

    private static ApiProblemException ReviewExpired() =>
        Problem(
            StatusCodes.Status409Conflict,
            "The import review has expired.",
            "Start a new import review to continue.",
            "ImportChanged");

    private static ApiProblemException ImportEndedElsewhere() =>
        Problem(
            StatusCodes.Status409Conflict,
            "The import was ended elsewhere.",
            "Return to the account's transactions before continuing.",
            "ImportEndedElsewhere");

    private static ApiProblemException LeaseNotOwned() =>
        Problem(
            StatusCodes.Status409Conflict,
            "The account import is no longer active.",
            "Recheck the account import status before continuing.",
            "ImportChanged");

    private static ApiProblemException DuplicateConfirmationRequired(
        IReadOnlySet<int> duplicateRowNumbers) =>
        new(
            StatusCodes.Status409Conflict,
            "Possible duplicate transactions require confirmation.",
            "Review the duplicate warnings and explicitly confirm them before importing.",
            new Dictionary<string, string[]>
            {
                ["code"] = ["DuplicateConfirmationRequired"],
                ["rowNumbers"] = duplicateRowNumbers
                    .Order()
                    .Select(rowNumber => rowNumber.ToString(System.Globalization.CultureInfo.InvariantCulture))
                    .ToArray(),
            });

    private static ApiProblemException InvalidStagedData() =>
        Problem(
            StatusCodes.Status409Conflict,
            "The import review is no longer valid.",
            "Start a new import review to continue.",
            "ImportChanged");

    private static ApiProblemException ConfirmationFailed() =>
        Problem(
            StatusCodes.Status500InternalServerError,
            "The import could not be completed.",
            "The failed attempt was rolled back. Start a new import review and try again.",
            "ConfirmationFailed");

    private static ApiProblemException ImportOutcomeUnknown() =>
        Problem(
            StatusCodes.Status500InternalServerError,
            "The import outcome could not be verified.",
            "Check the account's transactions before attempting another import.",
            "ImportOutcomeUnknown");

    private static ApiProblemException Problem(int status, string title, string detail, string code) =>
        new(
            status,
            title,
            detail,
            new Dictionary<string, string[]> { ["code"] = [code] });

    private sealed record SavedRow(TransactionFingerprint Fingerprint, int Sequence);

    private sealed record ConfirmOutcome(
        ConfirmImportResponse? Response,
        ApiProblemException? Problem,
        bool CleanupAttempt)
    {
        public static ConfirmOutcome Succeeded(ConfirmImportResponse response) =>
            new(response, null, false);

        public static ConfirmOutcome Failed(ApiProblemException problem, bool cleanupAttempt = true) =>
            new(null, problem, cleanupAttempt);
    }
}

public sealed record ConfirmImportResponse(
    int ImportedCount,
    DateTimeOffset CompletedAtUtc,
    bool SettingsSaved);
