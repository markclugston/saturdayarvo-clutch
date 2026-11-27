namespace Clutch.API.Domain.Assets;

public sealed class Asset
{
    public const int MaximumNameLength = 100;
    public const int MaximumDescriptionLength = 500;
    public const string CurrencyFixedMessage = "The currency cannot be changed";

    private readonly List<AssetValuation> valuations = [];

    private Asset()
    {
    }

    public Guid Id { get; private set; }

    public string OwnerUserId { get; private set; } = string.Empty;

    public string Name { get; private set; } = string.Empty;

    public string? Description { get; private set; }

    public string CurrencyCode { get; private set; } = string.Empty;

    public DateTimeOffset CreatedAtUtc { get; private set; }

    // Lease pointer to the active AssetEdit; changed only by conditional updates.
    public Guid? ActiveEditId { get; private set; }

    public IReadOnlyList<AssetValuation> Valuations => valuations;

    // Builds an asset from values already checked by AssetValidator.
    public static Asset Create(string ownerUserId, ValidAsset values, DateTimeOffset createdAtUtc)
    {
        var asset = new Asset
        {
            Id = Guid.NewGuid(),
            OwnerUserId = ownerUserId,
            CreatedAtUtc = createdAtUtc,
            // Chosen once: nothing changes an asset's currency after this (029 FR-007).
            CurrencyCode = values.Currency.Code,
        };
        asset.Update(values);
        foreach (var valuation in values.Valuations)
        {
            asset.AddValuation(valuation.Value, valuation.ValuationDate);
        }

        return asset;
    }

    public void Update(ValidAsset values)
    {
        Name = values.Name;
        Description = values.Description;
    }

    public AssetValuation AddValuation(decimal value, DateOnly valuationDate)
    {
        var valuation = new AssetValuation(Id, value, valuationDate);
        valuations.Add(valuation);
        return valuation;
    }

    public void RemoveValuation(AssetValuation valuation) => valuations.Remove(valuation);
}
