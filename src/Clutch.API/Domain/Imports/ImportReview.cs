namespace Clutch.API.Domain.Imports;

public enum ImportReviewState
{
    Ready,
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
        DateTimeOffset expiresAtUtc)
    {
        if (id == Guid.Empty
            || accountId == Guid.Empty
            || string.IsNullOrWhiteSpace(actingUserId)
            || expiresAtUtc <= createdAtUtc)
        {
            throw new ArgumentException("The import review is invalid.");
        }

        Id = id;
        AccountId = accountId;
        ActingUserId = actingUserId;
        State = ImportReviewState.Ready;
        CreatedAtUtc = createdAtUtc;
        ExpiresAtUtc = expiresAtUtc;
    }

    public Guid Id { get; private set; }

    public Guid AccountId { get; private set; }

    public string ActingUserId { get; private set; } = string.Empty;

    public ImportReviewState State { get; private set; }

    public DateTimeOffset CreatedAtUtc { get; private set; }

    public DateTimeOffset ExpiresAtUtc { get; private set; }

    public bool DuplicateConfirmationRequired { get; private set; }

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

    public void UpdateDuplicateWarnings(IReadOnlySet<int> duplicateRowNumbers)
    {
        if (State != ImportReviewState.Ready)
        {
            throw new InvalidOperationException("Only a ready review can update duplicate warnings.");
        }

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
