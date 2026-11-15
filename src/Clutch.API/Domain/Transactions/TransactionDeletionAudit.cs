namespace Clutch.API.Domain.Transactions;

public sealed class TransactionDeletionAudit
{
    private TransactionDeletionAudit()
    {
    }

    public TransactionDeletionAudit(
        string actingUserId,
        Guid accountId,
        Guid transactionId,
        DateTimeOffset deletedAtUtc)
    {
        if (string.IsNullOrWhiteSpace(actingUserId)
            || accountId == Guid.Empty
            || transactionId == Guid.Empty)
        {
            throw new ArgumentException("The transaction deletion audit is invalid.");
        }

        Id = Guid.NewGuid();
        ActingUserId = actingUserId;
        AccountId = accountId;
        TransactionId = transactionId;
        DeletedAtUtc = deletedAtUtc;
    }

    public Guid Id { get; private set; }

    public string ActingUserId { get; private set; } = string.Empty;

    public Guid AccountId { get; private set; }

    public Guid TransactionId { get; private set; }

    public DateTimeOffset DeletedAtUtc { get; private set; }
}
