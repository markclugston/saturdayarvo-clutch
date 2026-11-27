using System.Globalization;
using System.Text.Json.Serialization;
using Clutch.API.Domain.Assets;

namespace Clutch.API.Application.Assets;

// Response shapes of specs/029-asset-register/contracts/assets-api.md.
public sealed record ValuationResponse(Guid Id, decimal Value, string ValuationDate);

public sealed record LatestValuationResponse(decimal Value, string ValuationDate);

public sealed record AssetListItemResponse(
    Guid Id,
    string Name,
    string? Description,
    string CurrencyCode,
    LatestValuationResponse LatestValuation);

// A decimal string: a sum can exceed what a JavaScript number holds exactly.
public sealed record CurrencyTotalResponse(string CurrencyCode, string TotalValue);

public sealed record AssetListResponse(
    IReadOnlyList<AssetListItemResponse> Assets,
    IReadOnlyList<CurrencyTotalResponse> Totals);

public sealed record AssetDetailResponse(
    Guid Id,
    string Name,
    string? Description,
    string CurrencyCode,
    IReadOnlyList<ValuationResponse> Valuations)
{
    public static AssetDetailResponse From(Asset asset) =>
        new(
            asset.Id,
            asset.Name,
            asset.Description,
            asset.CurrencyCode,
            asset.Valuations
                .OrderByDescending(valuation => valuation.ValuationDate)
                .Select(valuation => new ValuationResponse(
                    valuation.Id,
                    valuation.Value,
                    AssetDates.Format(valuation.ValuationDate)))
                .ToList());
}

public sealed record EditLeaseResponse(
    Guid EditId,
    DateTimeOffset ExpiresAtUtc,
    DateTimeOffset ServerTimeUtc,
    AssetDetailResponse Asset);

public sealed record EditStatusResponse(
    Guid AssetId,
    string Availability,
    ActiveEditResponse? ActiveEdit,
    WatchedEditResponse? WatchedEdit);

public sealed record ActiveEditResponse(Guid Id, DateTimeOffset ExpiresAtUtc);

public sealed record WatchedEditResponse(
    Guid Id,
    string State,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    DateTimeOffset? ExpiresAtUtc = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    DateTimeOffset? EndedAtUtc = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    EditEndingUserResponse? EndedBy = null);

public sealed record EditEndingUserResponse(string UserId, string UserName);

internal static class AssetDates
{
    public static string Format(DateOnly date) =>
        date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
}
