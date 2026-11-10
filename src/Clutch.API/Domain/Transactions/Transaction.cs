using Clutch.API.Domain.Accounts;
using Clutch.API.Domain.Shared;

namespace Clutch.API.Domain.Transactions;

public enum TransactionDirection
{
    Incoming,
    Outgoing,
}

public sealed class Transaction
{
    private Transaction()
    {
    }

    private Transaction(
        Guid accountId,
        DateOnly transactionDate,
        string description,
        decimal amount,
        TransactionDirection direction,
        decimal? balance,
        DateTimeOffset createdAtUtc)
    {
        Id = Guid.NewGuid();
        AccountId = accountId;
        TransactionDate = transactionDate;
        Description = description.Trim();
        Amount = amount;
        Direction = direction;
        Balance = balance;
        CreatedAtUtc = createdAtUtc;
    }

    public Guid Id { get; private set; }

    public Guid AccountId { get; private set; }

    public DateOnly TransactionDate { get; private set; }

    public string Description { get; private set; } = string.Empty;

    public decimal Amount { get; private set; }

    public TransactionDirection Direction { get; private set; }

    public decimal? Balance { get; private set; }

    public DateTimeOffset CreatedAtUtc { get; private set; }

    public static bool TryCreate(
        Guid accountId,
        DateOnly transactionDate,
        string? description,
        decimal amount,
        TransactionDirection direction,
        decimal? balance,
        Currency currency,
        DateTimeOffset createdAtUtc,
        out Transaction? transaction)
    {
        if (accountId == Guid.Empty
            || !AccountDescriptionValidator.IsValid(description)
            || amount < 0
            || decimal.Round(amount, currency.MinorUnits) != amount
            || (balance is not null && decimal.Round(balance.Value, currency.MinorUnits) != balance.Value)
            || !Enum.IsDefined(direction))
        {
            transaction = null;
            return false;
        }

        transaction = new Transaction(
            accountId,
            transactionDate,
            description!,
            amount,
            direction,
            balance,
            createdAtUtc);
        return true;
    }
}
