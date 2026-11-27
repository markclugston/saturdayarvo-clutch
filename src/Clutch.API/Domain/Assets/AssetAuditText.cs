using System.Globalization;
using System.Text;
using Clutch.API.Domain.Shared;

namespace Clutch.API.Domain.Assets;

public sealed record AssetAuditDetails(string Name, string? Description, string CurrencyCode);

public sealed record AssetAuditValuation(decimal Value, DateOnly ValuationDate);

// Descriptions of the asset audit events. Never truncated: the audit column is unlimited.
public static class AssetAuditText
{
    public static string Created(
        Guid assetId,
        AssetAuditDetails details,
        IReadOnlyList<AssetAuditValuation> added) =>
        Snapshot($"Asset {assetId} was created.", details, "Valuations added", added);

    public static string Deleted(
        Guid assetId,
        AssetAuditDetails details,
        IReadOnlyList<AssetAuditValuation> removed) =>
        Snapshot($"Asset {assetId} was deleted.", details, "Valuations removed", removed);

    public static string Updated(
        Guid assetId,
        AssetAuditDetails before,
        AssetAuditDetails after,
        IReadOnlyList<AssetAuditValuation> added,
        IReadOnlyList<AssetAuditValuation> removed)
    {
        var text = new StringBuilder($"Asset {assetId} was updated.");
        AppendChange(text, "Name", before.Name, after.Name);
        AppendChange(text, "Description", before.Description, after.Description);
        AppendValuations(text, "Valuations added", added, after.CurrencyCode);
        AppendValuations(text, "Valuations removed", removed, before.CurrencyCode);
        return text.ToString();
    }

    public static string EditRejected(Guid assetId, string rejectedUserId, Guid activeEditId) =>
        $"An edit of asset {assetId} by user {rejectedUserId} was rejected because edit {activeEditId} is active.";

    public static string EditEnded(Guid assetId, Guid editId, string endedByUserId) =>
        $"Edit {editId} of asset {assetId} was ended by user {endedByUserId}.";

    private static string Snapshot(
        string opening,
        AssetAuditDetails details,
        string label,
        IReadOnlyList<AssetAuditValuation> valuations)
    {
        var text = new StringBuilder(opening);
        text.Append(CultureInfo.InvariantCulture, $" Name: {details.Name}.");
        if (details.Description is not null)
        {
            text.Append(CultureInfo.InvariantCulture, $" Description: {details.Description}.");
        }

        text.Append(CultureInfo.InvariantCulture, $" Currency: {details.CurrencyCode}.");
        AppendValuations(text, label, valuations, details.CurrencyCode);
        return text.ToString();
    }

    private static void AppendChange(StringBuilder text, string label, string? before, string? after)
    {
        if (!string.Equals(before, after, StringComparison.Ordinal))
        {
            text.Append(
                CultureInfo.InvariantCulture,
                $" {label} changed from {before ?? "(none)"} to {after ?? "(none)"}.");
        }
    }

    private static void AppendValuations(
        StringBuilder text,
        string label,
        IReadOnlyList<AssetAuditValuation> valuations,
        string currencyCode)
    {
        if (valuations.Count == 0)
        {
            return;
        }

        var minorUnits = Currency.TryGet(currencyCode, out var currency) ? currency!.MinorUnits : 2;
        var format = $"F{minorUnits}";
        text.Append(CultureInfo.InvariantCulture, $" {label}: ");
        text.AppendJoin("; ", valuations.Select(valuation => string.Create(
            CultureInfo.InvariantCulture,
            $"{valuation.Value.ToString(format, CultureInfo.InvariantCulture)} {currencyCode} on {valuation.ValuationDate:yyyy-MM-dd}")));
        text.Append('.');
    }
}
