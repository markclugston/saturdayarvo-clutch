namespace Clutch.API.Domain.Assets;

// Immutable once stored: a correction deletes the valuation and adds another.
public sealed class AssetValuation
{
    private AssetValuation()
    {
    }

    public AssetValuation(Guid assetId, decimal value, DateOnly valuationDate)
    {
        Id = Guid.NewGuid();
        AssetId = assetId;
        Value = value;
        ValuationDate = valuationDate;
    }

    public Guid Id { get; private set; }

    public Guid AssetId { get; private set; }

    public decimal Value { get; private set; }

    public DateOnly ValuationDate { get; private set; }
}
