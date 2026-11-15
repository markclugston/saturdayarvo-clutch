using Clutch.API.Domain.Transactions;

namespace Clutch.API.Tests.Unit.Transactions;

public sealed class TransactionDeletionAuditTests
{
    [Fact]
    public void Constructor_records_ids_user_and_time()
    {
        var accountId = Guid.NewGuid();
        var transactionId = Guid.NewGuid();
        var deletedAt = DateTimeOffset.UtcNow;

        var audit = new TransactionDeletionAudit("user-1", accountId, transactionId, deletedAt);

        Assert.NotEqual(Guid.Empty, audit.Id);
        Assert.Equal("user-1", audit.ActingUserId);
        Assert.Equal(accountId, audit.AccountId);
        Assert.Equal(transactionId, audit.TransactionId);
        Assert.Equal(deletedAt, audit.DeletedAtUtc);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Constructor_rejects_blank_user(string actingUserId)
    {
        Assert.Throws<ArgumentException>(() => new TransactionDeletionAudit(
            actingUserId,
            Guid.NewGuid(),
            Guid.NewGuid(),
            DateTimeOffset.UtcNow));
    }

    [Fact]
    public void Constructor_rejects_empty_ids()
    {
        Assert.Throws<ArgumentException>(() => new TransactionDeletionAudit(
            "user-1",
            Guid.Empty,
            Guid.NewGuid(),
            DateTimeOffset.UtcNow));
        Assert.Throws<ArgumentException>(() => new TransactionDeletionAudit(
            "user-1",
            Guid.NewGuid(),
            Guid.Empty,
            DateTimeOffset.UtcNow));
    }
}
