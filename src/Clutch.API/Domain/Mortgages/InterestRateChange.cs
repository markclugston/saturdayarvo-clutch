namespace Clutch.API.Domain.Mortgages;

public sealed record RateChangeValue(decimal NewInterestRate, DateOnly EffectiveDate);

public sealed class InterestRateChange
{
    private InterestRateChange()
    {
    }

    internal InterestRateChange(Guid mortgageId, decimal newInterestRate, DateOnly effectiveDate)
    {
        Id = Guid.NewGuid();
        MortgageId = mortgageId;
        NewInterestRate = newInterestRate;
        EffectiveDate = effectiveDate;
    }

    public Guid Id { get; private set; }

    public Guid MortgageId { get; private set; }

    public decimal NewInterestRate { get; private set; }

    public DateOnly EffectiveDate { get; private set; }
}
