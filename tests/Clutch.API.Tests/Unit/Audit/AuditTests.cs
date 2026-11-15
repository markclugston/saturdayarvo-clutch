using Clutch.API.Domain.Audit;

namespace Clutch.API.Tests.Unit;

public sealed class AuditTests
{
    [Fact]
    public void Constructor_preserves_required_event_values_and_generates_its_own_id()
    {
        var occurredAtUtc = DateTimeOffset.UtcNow;
        var audit = new Audit(
            "user-1",
            occurredAtUtc,
            "TransactionDelete",
            "Transaction was reviewed and deleted in account Savings.");

        Assert.NotEqual(Guid.Empty, audit.Id);
        Assert.Equal("user-1", audit.ActingUserId);
        Assert.Equal(occurredAtUtc, audit.OccurredAtUtc);
        Assert.Equal("TransactionDelete", audit.EventCode);
        Assert.Contains("Savings", audit.Description, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("", "ReviewCreated", "Import ReviewCreated for account Savings.")]
    [InlineData("user-1", " ", "Import ReviewCreated for account Savings.")]
    [InlineData("user-1", "ReviewCreated", " ")]
    public void Constructor_rejects_blank_required_values(
        string actingUserId,
        string eventCode,
        string description)
    {
        Assert.Throws<ArgumentException>(() => new Audit(
            actingUserId,
            DateTimeOffset.UtcNow,
            eventCode,
            description));
    }
}
