using Clutch.API.Domain.Accounts;
using Clutch.API.Domain.Transactions;

namespace Clutch.API.Domain.Imports;

public sealed class ImportReviewRow
{
    private ImportReviewRow()
    {
    }

    public ImportReviewRow(
        Guid reviewId,
        int sourceRowNumber,
        DateOnly transactionDate,
        string description,
        decimal amount,
        TransactionDirection direction,
        bool isPossibleDuplicate)
    {
        if (reviewId == Guid.Empty
            || sourceRowNumber < 2
            || !AccountDescriptionValidator.IsValid(description)
            || amount < 0
            || !Enum.IsDefined(direction))
        {
            throw new ArgumentException("The import review row is invalid.");
        }

        ReviewId = reviewId;
        SourceRowNumber = sourceRowNumber;
        TransactionDate = transactionDate;
        Description = description;
        Amount = amount;
        Direction = direction;
        IsPossibleDuplicate = isPossibleDuplicate;
    }

    public Guid ReviewId { get; private set; }

    public int SourceRowNumber { get; private set; }

    public DateOnly TransactionDate { get; private set; }

    public string Description { get; private set; } = string.Empty;

    public decimal Amount { get; private set; }

    public TransactionDirection Direction { get; private set; }

    public bool IsPossibleDuplicate { get; private set; }

    public void MarkPossibleDuplicate() => IsPossibleDuplicate = true;
}
