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

    public decimal StartingBalance { get; private set; }

    public int NumberOfPeriods { get; private set; }

    public DateOnly FirstRepaymentDate { get; private set; }

    public RepaymentFrequency RepaymentFrequency { get; private set; }

    public DateTimeOffset CreatedAtUtc { get; private set; }

    public int Version { get; private set; }

    public IReadOnlyList<InterestRateChange> InterestRateChanges => interestRateChanges;

    // Builds a mortgage from values already checked by MortgageValidator.
    public static Mortgage Create(
        string ownerUserId,
        string name,
        decimal startingBalance,
        int numberOfPeriods,
        DateOnly firstRepaymentDate,
        RepaymentFrequency repaymentFrequency,
        IReadOnlyList<RateChangeValue> rateChanges,
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
            name, startingBalance, numberOfPeriods, firstRepaymentDate, repaymentFrequency, rateChanges);
        return mortgage;
    }

    // Replaces every value and the whole rate-change set; always moves the version.
    public void Update(
        string name,
        decimal startingBalance,
        int numberOfPeriods,
        DateOnly firstRepaymentDate,
        RepaymentFrequency repaymentFrequency,
        IReadOnlyList<RateChangeValue> rateChanges)
    {
        Apply(name, startingBalance, numberOfPeriods, firstRepaymentDate, repaymentFrequency, rateChanges);
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
        decimal startingBalance,
        int numberOfPeriods,
        DateOnly firstRepaymentDate,
        RepaymentFrequency repaymentFrequency,
        IReadOnlyList<RateChangeValue> rateChanges)
    {
        Name = name.Trim();
        StartingBalance = startingBalance;
        NumberOfPeriods = numberOfPeriods;
        FirstRepaymentDate = firstRepaymentDate;
        RepaymentFrequency = repaymentFrequency;
        ReplaceRateChanges(rateChanges);
    }
}
