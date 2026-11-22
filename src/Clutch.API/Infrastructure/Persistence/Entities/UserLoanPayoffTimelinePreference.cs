using Clutch.API.Domain.Preferences;

namespace Clutch.API.Infrastructure.Persistence.Entities;

public sealed class UserLoanPayoffTimelinePreference
{
    private UserLoanPayoffTimelinePreference()
    {
    }

    private UserLoanPayoffTimelinePreference(
        string userId,
        LoanPayoffTimelineView view,
        Guid clientId,
        long clientSequence,
        DateTimeOffset updatedAtUtc)
    {
        UserId = userId;
        View = view;
        ClientId = clientId;
        ClientSequence = clientSequence;
        UpdatedAtUtc = updatedAtUtc;
    }

    public string UserId { get; private set; } = string.Empty;

    public LoanPayoffTimelineView View { get; private set; }

    /// <summary>The page-load ID of the save last applied.</summary>
    public Guid ClientId { get; private set; }

    /// <summary>The page-load sequence number of the save last applied.</summary>
    public long ClientSequence { get; private set; }

    public DateTimeOffset UpdatedAtUtc { get; private set; }

    public static UserLoanPayoffTimelinePreference Create(
        string userId,
        LoanPayoffTimelineView view,
        Guid clientId,
        long clientSequence,
        DateTimeOffset updatedAtUtc) =>
        new(userId, view, clientId, clientSequence, updatedAtUtc);

    /// <summary>
    /// True when this save comes from the same page as the stored one but is not newer, so a
    /// later switch from that page has already been stored.
    /// </summary>
    public bool IsSupersededBy(Guid clientId, long clientSequence) =>
        ClientId == clientId && ClientSequence >= clientSequence;

    public void Update(
        LoanPayoffTimelineView view,
        Guid clientId,
        long clientSequence,
        DateTimeOffset updatedAtUtc)
    {
        View = view;
        ClientId = clientId;
        ClientSequence = clientSequence;
        UpdatedAtUtc = updatedAtUtc;
    }
}
