namespace Clutch.API.Domain.Imports;

public sealed class ImportAuditEvent
{
    private ImportAuditEvent()
    {
    }

    public ImportAuditEvent(
        Guid? reviewId,
        Guid accountId,
        string actingUserId,
        string eventCode,
        DateTimeOffset occurredAtUtc)
    {
        if (accountId == Guid.Empty
            || string.IsNullOrWhiteSpace(actingUserId)
            || string.IsNullOrWhiteSpace(eventCode)
            || eventCode.Length > 50
            || !eventCode.All(character => char.IsAsciiLetterOrDigit(character)
                || character is '.' or '_' or '-'))
        {
            throw new ArgumentException("The import audit event is invalid.");
        }

        Id = Guid.NewGuid();
        ReviewId = reviewId;
        AccountId = accountId;
        ActingUserId = actingUserId;
        EventCode = eventCode;
        OccurredAtUtc = occurredAtUtc;
    }

    public Guid Id { get; private set; }

    public Guid? ReviewId { get; private set; }

    public Guid AccountId { get; private set; }

    public string ActingUserId { get; private set; } = string.Empty;

    public string EventCode { get; private set; } = string.Empty;

    public DateTimeOffset OccurredAtUtc { get; private set; }
}
