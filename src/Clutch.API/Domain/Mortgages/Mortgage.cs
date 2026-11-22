namespace Clutch.API.Domain.Mortgages;

public sealed class Mortgage
{
    public const int MaximumNameLength = 100;
    public const int MaximumInterestRateChanges = 60;
    public const int MaximumPerOwner = 20;

    private readonly List<InterestRateChange> interestRateChanges = [];

    private Mortgage()
    {
    }

    public Guid Id { get; private set; }

    public string OwnerUserId { get; private set; } = string.Empty;

    public string Name { get; private set; } = string.Empty;

    public decimal OpeningBalance { get; private set; }

    public int Duration { get; private set; }

    public DateOnly DrawdownDate { get; private set; }

    public PaymentFrequency PaymentFrequency { get; private set; }

    public Guid? AccountId { get; private set; }

    public DateTimeOffset CreatedAtUtc { get; private set; }

    public int Version { get; private set; }

    public IReadOnlyList<InterestRateChange> InterestRateChanges => interestRateChanges;

    // Builds a mortgage from values already checked by MortgageValidator.
    public static Mortgage Create(
        string ownerUserId,
        string name,
        decimal openingBalance,
        int duration,
        DateOnly drawdownDate,
        PaymentFrequency paymentFrequency,
        IReadOnlyList<RateChangeValue> rateChanges,
        Guid? accountId,
        DateTimeOffset createdAtUtc)
    {
        var mortgage = new Mortgage
        {
            Id = Guid.NewGuid(),
            OwnerUserId = ownerUserId,
            CreatedAtUtc = createdAtUtc,
            Version = 1,
        };
        mortgage.Apply(
            name, openingBalance, duration, drawdownDate, paymentFrequency, rateChanges, accountId);
        return mortgage;
    }

    // Replaces every value and the whole rate-change set; always moves the version.
    public void Update(
        string name,
        decimal openingBalance,
        int duration,
        DateOnly drawdownDate,
        PaymentFrequency paymentFrequency,
        IReadOnlyList<RateChangeValue> rateChanges,
        Guid? accountId)
    {
        Apply(name, openingBalance, duration, drawdownDate, paymentFrequency, rateChanges, accountId);
        Version++;
    }

    public void ReplaceRateChanges(IReadOnlyList<RateChangeValue> rateChanges)
    {
        interestRateChanges.Clear();
        interestRateChanges.AddRange(rateChanges
            .OrderBy(change => change.EffectiveDate)
            .Select(change => new InterestRateChange(Id, change.NewInterestRate, change.EffectiveDate)));
    }

    private void Apply(
        string name,
        decimal openingBalance,
        int duration,
        DateOnly drawdownDate,
        PaymentFrequency paymentFrequency,
        IReadOnlyList<RateChangeValue> rateChanges,
        Guid? accountId)
    {
        Name = name.Trim();
        AccountId = accountId;
        OpeningBalance = openingBalance;
        Duration = duration;
        DrawdownDate = drawdownDate;
        PaymentFrequency = paymentFrequency;
        ReplaceRateChanges(rateChanges);
    }
}
