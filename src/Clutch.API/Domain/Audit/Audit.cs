namespace Clutch.API.Domain.Audit;

public sealed class Audit
{
    private Audit()
    {
    }

    public Audit(
        string actingUserId,
        DateTimeOffset occurredAtUtc,
        string eventCode,
        string description)
    {
        if (string.IsNullOrWhiteSpace(actingUserId)
            || string.IsNullOrWhiteSpace(eventCode)
            || eventCode.Length > 50
            || !eventCode.All(character => char.IsAsciiLetterOrDigit(character)
                || character is '.' or '_' or '-')
            || string.IsNullOrWhiteSpace(description))
        {
            throw new ArgumentException("The audit event is invalid.");
        }

        Id = Guid.NewGuid();
        ActingUserId = actingUserId;
        OccurredAtUtc = occurredAtUtc;
        EventCode = eventCode;
        Description = description;
    }

    public Guid Id { get; private set; }

    public string ActingUserId { get; private set; } = string.Empty;

    public DateTimeOffset OccurredAtUtc { get; private set; }

    public string EventCode { get; private set; } = string.Empty;

    public string Description { get; private set; } = string.Empty;
}
