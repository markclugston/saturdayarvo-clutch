namespace Clutch.API.Domain.Families;

public sealed class Family
{
    private Family()
    {
    }

    public Family(string ownerUserId)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(ownerUserId);
        Id = Guid.NewGuid();
        OwnerUserId = ownerUserId;
    }

    public Guid Id { get; private set; }

    public string OwnerUserId { get; private set; } = string.Empty;
}
