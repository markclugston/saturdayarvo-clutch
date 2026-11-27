namespace Clutch.API.Domain.Assets;

// What a Save adds to and removes from an asset's stored valuations, from the full desired set.
public sealed record AssetValuationDiff(
    IReadOnlyList<ValidValuation> Added,
    IReadOnlyList<AssetValuation> Removed,
    IReadOnlyDictionary<string, string> Errors)
{
    public const string ChangedValuationMessage = "Delete this valuation and add it again to change it";

    // desired must keep the submitted order, so an error key names the submitted position.
    public static AssetValuationDiff Compare(
        IReadOnlyList<AssetValuation> existing,
        IReadOnlyList<ValidValuation> desired)
    {
        var errors = new Dictionary<string, string>(StringComparer.Ordinal);
        var unmatched = existing.ToDictionary(valuation => valuation.Id);
        var added = new List<ValidValuation>();
        for (var index = 0; index < desired.Count; index++)
        {
            var item = desired[index];
            if (item.Id is not { } id)
            {
                added.Add(item);
                continue;
            }

            if (!unmatched.Remove(id, out var stored))
            {
                errors[$"valuations[{index}].id"] = AssetValidator.UnknownValuationMessage;
            }
            else if (stored.Value != item.Value || stored.ValuationDate != item.ValuationDate)
            {
                // Stored valuations are immutable; accepting this would silently discard the change.
                errors[$"valuations[{index}].id"] = ChangedValuationMessage;
            }
        }

        return new AssetValuationDiff(added, unmatched.Values.ToList(), errors);
    }
}
