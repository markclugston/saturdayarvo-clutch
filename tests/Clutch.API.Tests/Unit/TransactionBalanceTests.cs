using Clutch.API.Domain.Shared;
using Clutch.API.Domain.Transactions;

namespace Clutch.API.Tests.Unit;

public sealed class TransactionBalanceTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("100.50")]
    [InlineData("-20.25")]
    [InlineData("0")]
    public void TryCreate_accepts_null_positive_negative_and_zero_balances(string? balanceText)
    {
        decimal? balance = balanceText is null ? null : decimal.Parse(balanceText, System.Globalization.CultureInfo.InvariantCulture);

        var created = Create(balance, out var transaction);

        Assert.True(created);
        Assert.Equal(balance, transaction!.Balance);
    }

    [Fact]
    public void TryCreate_rejects_a_balance_with_more_precision_than_the_currency()
    {
        Assert.False(Create(1.234m, out var transaction));
        Assert.Null(transaction);
    }

    private static bool Create(decimal? balance, out Transaction? transaction)
    {
        var currency = new Currency("AUD", "Australian dollar", 2);
        return Transaction.TryCreate(
            Guid.NewGuid(),
            new DateOnly(2025, 1, 15),
            "Market",
            10.00m,
            TransactionDirection.Outgoing,
            balance,
            currency,
            DateTimeOffset.UtcNow,
            out transaction);
    }
}
