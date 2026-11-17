namespace Clutch.API.Domain.Imports;

public enum ImportReviewState
{
    Ready,
    Processing,
    Confirmed,
    Cancelled,
    Expired,
}

public sealed class ImportReview
{
    private readonly List<ImportReviewRow> rows = [];

    private ImportReview()
    {
    }

    public ImportReview(
        Guid id,
        Guid accountId,
        string actingUserId,
        DateTimeOffset createdAtUtc,
        DateTimeOffset expiresAtUtc,
        int schemaVersion,
        string mappingJson)
    {
        if (id == Guid.Empty
            || accountId == Guid.Empty
            || string.IsNullOrWhiteSpace(actingUserId)
            || expiresAtUtc <= createdAtUtc
            || schemaVersion <= 0
            || string.IsNullOrWhiteSpace(mappingJson))
        {
            throw new ArgumentException("The import review is invalid.");
        }

        Id = id;
        AccountId = accountId;
        ActingUserId = actingUserId;
        State = ImportReviewState.Ready;
        CreatedAtUtc = createdAtUtc;
        ExpiresAtUtc = expiresAtUtc;
        SchemaVersion = schemaVersion;
        MappingJson = mappingJson;
    }

    public Guid Id { get; private set; }

    public Guid AccountId { get; private set; }

    public string ActingUserId { get; private set; } = string.Empty;

    public ImportReviewState State { get; private set; }

    public DateTimeOffset CreatedAtUtc { get; private set; }

    public DateTimeOffset ExpiresAtUtc { get; private set; }

    public int? SchemaVersion { get; private set; }

    public string? MappingJson { get; private set; }

    public bool DuplicateConfirmationRequired { get; private set; }

    public Guid? ConfirmationAttemptId { get; private set; }

    public DateTimeOffset? ProcessingStartedAtUtc { get; private set; }

    public string? EndedByUserId { get; private set; }

    public DateTimeOffset? EndedAtUtc { get; private set; }

    public IReadOnlyCollection<ImportReviewRow> Rows => rows;

    public void AddRows(IEnumerable<ImportReviewRow> reviewRows)
    {
        if (State != ImportReviewState.Ready || rows.Count > 0)
        {
            throw new InvalidOperationException("Rows can only be added to a new ready review.");
        }

        var values = reviewRows.ToArray();
        if (values.Length == 0 || values.Any(row => row.ReviewId != Id))
        {
            throw new ArgumentException("A review must contain rows belonging to that review.");
        }

        rows.AddRange(values);
        DuplicateConfirmationRequired = values.Any(row => row.IsPossibleDuplicate);
    }

    public bool TryTransition(ImportReviewState state)
    {
        if (State != ImportReviewState.Ready
            || state is not (ImportReviewState.Confirmed
                or ImportReviewState.Cancelled
                or ImportReviewState.Expired))
        {
            return false;
        }

        State = state;
        rows.Clear();
        return true;
    }

    public bool TryClaimProcessing(Guid attemptId, DateTimeOffset startedAtUtc)
    {
        if (State != ImportReviewState.Ready
            || attemptId == Guid.Empty
            || startedAtUtc.Offset != TimeSpan.Zero
            || rows.Count == 0
            || SchemaVersion is null
            || MappingJson is null)
        {
            return false;
        }

        State = ImportReviewState.Processing;
        ConfirmationAttemptId = attemptId;
        ProcessingStartedAtUtc = startedAtUtc;
        return true;
    }

    public bool TryRejectProcessing(Guid attemptId, IReadOnlySet<int> duplicateRowNumbers)
    {
        ArgumentNullException.ThrowIfNull(duplicateRowNumbers);
        if (State != ImportReviewState.Processing
            || attemptId == Guid.Empty
            || ConfirmationAttemptId != attemptId)
        {
            return false;
        }

        UpdateDuplicateWarningsCore(duplicateRowNumbers);
        State = ImportReviewState.Ready;
        ConfirmationAttemptId = null;
        ProcessingStartedAtUtc = null;
        return true;
    }

    public bool TryEndElsewhere(string endedByUserId, DateTimeOffset endedAtUtc)
    {
        if (State != ImportReviewState.Ready
            || string.IsNullOrWhiteSpace(endedByUserId)
            || endedAtUtc.Offset != TimeSpan.Zero)
        {
            return false;
        }

        State = ImportReviewState.Cancelled;
        EndedByUserId = endedByUserId;
        EndedAtUtc = endedAtUtc;
        SchemaVersion = null;
        MappingJson = null;
        DuplicateConfirmationRequired = false;
        rows.Clear();
        return true;
    }

    public void UpdateDuplicateWarnings(IReadOnlySet<int> duplicateRowNumbers)
    {
        if (State != ImportReviewState.Ready)
        {
            throw new InvalidOperationException("Only a ready review can update duplicate warnings.");
        }

        UpdateDuplicateWarningsCore(duplicateRowNumbers);
    }

    private void UpdateDuplicateWarningsCore(IReadOnlySet<int> duplicateRowNumbers)
    {
        foreach (var row in rows.Where(row => duplicateRowNumbers.Contains(row.SourceRowNumber)))
        {
            row.MarkPossibleDuplicate();
        }

        DuplicateConfirmationRequired = rows.Any(row => row.IsPossibleDuplicate);
    }

    public void RemoveRows()
    {
        rows.Clear();
    }
}
