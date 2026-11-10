using Clutch.API.Domain.Shared;

namespace Clutch.API.Domain.Accounts;

public sealed class Account
{
    private Account()
    {
    }

    private Account(string ownerUserId, string description, string currencyCode)
    {
        Id = Guid.NewGuid();
        OwnerUserId = ownerUserId;
        Description = description.Trim();
        CurrencyCode = currencyCode;
    }

    public Guid Id { get; private set; }

    public string? OwnerUserId { get; private set; }

    public string Description { get; private set; } = string.Empty;

    public string CurrencyCode { get; private set; } = string.Empty;

    public DateTimeOffset? LastSuccessfulImportAtUtc { get; private set; }

    public Guid? LastSuccessfulImportReviewId { get; private set; }

    public Guid? ActiveImportId { get; private set; }

    public static bool TryCreate(
        string? ownerUserId,
        string? description,
        string? currencyCode,
        out Account? account)
    {
        if (string.IsNullOrWhiteSpace(ownerUserId)
            || !AccountDescriptionValidator.IsValid(description)
            || !Currency.TryGet(currencyCode, out _))
        {
            account = null;
            return false;
        }

        account = new Account(ownerUserId, description!, currencyCode!);
        return true;
    }

    public bool TryUpdateDescription(string? description)
    {
        if (!AccountDescriptionValidator.IsValid(description))
        {
            return false;
        }

        Description = description!.Trim();
        return true;
    }

    public bool TryAcquireImport(Guid importId)
    {
        if (importId == Guid.Empty || ActiveImportId is not null)
        {
            return false;
        }

        ActiveImportId = importId;
        return true;
    }

    public bool TryReleaseImport(Guid importId)
    {
        if (ActiveImportId != importId)
        {
            return false;
        }

        ActiveImportId = null;
        return true;
    }

    public void MarkSuccessfulImport(DateTimeOffset completedAtUtc, Guid reviewId)
    {
        LastSuccessfulImportAtUtc = completedAtUtc;
        LastSuccessfulImportReviewId = reviewId;
    }
}
