using System.Data;
using Clutch.API.Api.ProblemDetails;
using Clutch.API.Domain.Accounts;
using Clutch.API.Domain.Imports;
using Clutch.API.Domain.Shared;
using Clutch.API.Domain.Transactions;
using Clutch.API.Infrastructure.Imports;
using Clutch.API.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Clutch.API.Application.Imports;

public sealed class ConfirmImportService(
    AppDbContext dbContext,
    ImportAuditWriter auditWriter,
    ImportReviewService importReviewService,
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
        var strategy = dbContext.Database.CreateExecutionStrategy();
        ConfirmOutcome outcome;
        var completed = false;
        try
        {
            outcome = await strategy.ExecuteAsync(
                () => ConfirmWithinTransactionAsync(
                    ownerUserId,
                    reviewId,
                    confirmPossibleDuplicates,
                    cancellationToken));
            completed = true;
        }
        catch (DbUpdateException)
        {
            throw new ApiProblemException(
                StatusCodes.Status500InternalServerError,
                "The import could not be completed.",
                "No transactions were imported. Start a new review and try again.");
        }
        finally
        {
            if (!completed)
            {
                dbContext.ChangeTracker.Clear();
                await importReviewService.CancelAfterFailureAsync(ownerUserId, reviewId, CancellationToken.None);
            }
        }

        if (outcome.Problem is not null)
        {
            if (!outcome.RetainReview)
            {
                dbContext.ChangeTracker.Clear();
                await importReviewService.CancelAfterFailureAsync(ownerUserId, reviewId, CancellationToken.None);
            }
            throw outcome.Problem;
        }

        var settingsSaved = false;
        if (outcome.Mapping is not null && outcome.AccountId is Guid accountId)
        {
            settingsSaved = await accountImportSettingsService.SaveAfterConfirmationAsync(
                accountId,
                reviewId,
                outcome.Mapping,
                cancellationToken);
        }

        importMeasurement.MarkSucceeded(outcome.Response!.ImportedCount);
        return outcome.Response with { SettingsSaved = settingsSaved };
    }

    private async Task<ConfirmOutcome> ConfirmWithinTransactionAsync(
        string ownerUserId,
        Guid reviewId,
        bool confirmPossibleDuplicates,
        CancellationToken cancellationToken)
    {
        await using var transaction = await dbContext.Database.BeginTransactionAsync(
            IsolationLevel.Serializable,
            cancellationToken);
        var review = await OwnedReviews(ownerUserId)
            .Include(candidate => candidate.Rows)
            .SingleOrDefaultAsync(candidate => candidate.Id == reviewId, cancellationToken);
        if (review is null)
        {
            return await RollbackOutcomeAsync(transaction, ReviewNotFound());
        }

        if (review.State != ImportReviewState.Ready)
        {
            return await RollbackOutcomeAsync(transaction, ReviewNotReady());
        }

        var account = await OwnedAccounts(ownerUserId)
            .SingleOrDefaultAsync(candidate => candidate.Id == review.AccountId, cancellationToken);
        if (account is null)
        {
            return await RollbackOutcomeAsync(transaction, AccountNotFound());
        }

        var now = timeProvider.GetUtcNow();
        if (review.ExpiresAtUtc <= now)
        {
            review.TryTransition(ImportReviewState.Expired);
            account.TryReleaseImport(review.Id);
            await dbContext.ImportReviewMappingSnapshots
                .Where(snapshot => snapshot.ReviewId == review.Id)
                .ExecuteDeleteAsync(cancellationToken);
            auditWriter.Add(
                review.Id,
                account.Id,
                ownerUserId,
                "ReviewExpired",
                now);
            await dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return ConfirmOutcome.Failed(ReviewExpired());
        }

        if (account.ActiveImportId != review.Id)
        {
            return await RollbackOutcomeAsync(transaction, LeaseNotOwned());
        }

        if (!Currency.TryGet(account.CurrencyCode, out var currency) || currency is null)
        {
            return await RollbackOutcomeAsync(transaction, AccountNotFound());
        }

        var reviewRows = review.Rows.ToArray();
        if (reviewRows.Length == 0)
        {
            return await RollbackOutcomeAsync(transaction, InvalidStagedData());
        }

        var firstDate = reviewRows.Min(row => row.TransactionDate);
        var lastDate = reviewRows.Max(row => row.TransactionDate);
        var existingTransactions = await dbContext.Transactions
            .AsNoTracking()
            .Where(candidate =>
                candidate.AccountId == account.Id
                && candidate.TransactionDate >= firstDate
                && candidate.TransactionDate <= lastDate)
            .Select(candidate => new TransactionFingerprint(
                candidate.TransactionDate,
                candidate.Description,
                candidate.Amount,
                candidate.Direction))
            .ToListAsync(cancellationToken);
        var previouslyFlaggedRows = reviewRows
            .Where(row => row.IsPossibleDuplicate)
            .Select(row => row.SourceRowNumber)
            .ToHashSet();
        var duplicateRows = DuplicateDetector.FindDuplicateRows(
            existingTransactions,
            reviewRows.Select(row => new ImportFingerprintRow(
                row.SourceRowNumber,
                new TransactionFingerprint(
                    row.TransactionDate,
                    row.Description,
                    row.Amount,
                    row.Direction))));
        var newlyDiscoveredDuplicates = duplicateRows.Except(previouslyFlaggedRows).ToHashSet();
        review.UpdateDuplicateWarnings(duplicateRows);
        if (newlyDiscoveredDuplicates.Count > 0
            || (review.DuplicateConfirmationRequired && !confirmPossibleDuplicates))
        {
            await dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return ConfirmOutcome.Failed(DuplicateConfirmationRequired(duplicateRows), retainReview: true);
        }

        var transactions = new List<Transaction>(reviewRows.Length);
        foreach (var row in reviewRows)
        {
            if (!Transaction.TryCreate(
                account.Id,
                row.TransactionDate,
                row.Description,
                row.Amount,
                row.Direction,
                currency,
                now,
                out var newTransaction)
                || newTransaction is null)
            {
                return await RollbackOutcomeAsync(
                    transaction,
                    InvalidStagedData());
            }

            transactions.Add(newTransaction);
        }

        if (transactions.Count == 0)
        {
            return await RollbackOutcomeAsync(transaction, InvalidStagedData());
        }

        var snapshot = await dbContext.ImportReviewMappingSnapshots
            .AsNoTracking()
            .SingleOrDefaultAsync(candidate => candidate.ReviewId == review.Id, cancellationToken);
        if (snapshot is null)
        {
            return await RollbackOutcomeAsync(transaction, InvalidStagedData());
        }

        var mapping = ImportMappingSettingsSerializer.Deserialize(
            snapshot.SchemaVersion,
            snapshot.MappingJson);
        dbContext.Transactions.AddRange(transactions);
        account.MarkSuccessfulImport(now, review.Id);
        if (!account.TryReleaseImport(review.Id) || !review.TryTransition(ImportReviewState.Confirmed))
        {
            return await RollbackOutcomeAsync(transaction, LeaseNotOwned());
        }

        await dbContext.ImportReviewMappingSnapshots
            .Where(candidate => candidate.ReviewId == review.Id)
            .ExecuteDeleteAsync(cancellationToken);
        auditWriter.Add(
            review.Id,
            account.Id,
            ownerUserId,
            "ImportConfirmed",
            now);
        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return ConfirmOutcome.Succeeded(
            new ConfirmImportResponse(transactions.Count, now, SettingsSaved: false),
            account.Id,
            mapping);
    }

    private async Task<ConfirmOutcome> RollbackOutcomeAsync(
        Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction transaction,
        ApiProblemException problem)
    {
        await transaction.RollbackAsync(CancellationToken.None);
        return ConfirmOutcome.Failed(problem);
    }

    private IQueryable<Account> OwnedAccounts(string ownerUserId) =>
        dbContext.Accounts.Where(account => account.OwnerUserId == ownerUserId);

    private IQueryable<ImportReview> OwnedReviews(string ownerUserId) =>
        dbContext.ImportReviews.Where(review =>
            dbContext.Accounts.Any(account =>
                account.Id == review.AccountId
                && account.OwnerUserId == ownerUserId));

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

    private static ApiProblemException ReviewNotReady() =>
        new(
            StatusCodes.Status409Conflict,
            "The import review is no longer available.",
            "A review can only be confirmed once while it is ready.");

    private static ApiProblemException ReviewExpired() =>
        new(
            StatusCodes.Status409Conflict,
            "The import review has expired.",
            "Start a new import review to continue.");

    private static ApiProblemException LeaseNotOwned() =>
        new(
            StatusCodes.Status409Conflict,
            "The account import is no longer active.",
            "Start a new import review to continue.");

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
        new(
            StatusCodes.Status409Conflict,
            "The import review is no longer valid.",
            "Start a new import review to continue.");

    private sealed record ConfirmOutcome(
        ConfirmImportResponse? Response,
        ApiProblemException? Problem,
        bool RetainReview,
        Guid? AccountId,
        ImportMapping? Mapping)
    {
        public static ConfirmOutcome Succeeded(
            ConfirmImportResponse response,
            Guid accountId,
            ImportMapping mapping) =>
            new(response, null, false, accountId, mapping);

        public static ConfirmOutcome Failed(ApiProblemException problem, bool retainReview = false) =>
            new(null, problem, retainReview, null, null);
    }
}

public sealed record ConfirmImportResponse(
    int ImportedCount,
    DateTimeOffset CompletedAtUtc,
    bool SettingsSaved);
