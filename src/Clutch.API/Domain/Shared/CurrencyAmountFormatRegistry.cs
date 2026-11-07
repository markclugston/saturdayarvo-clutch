using System.Collections.ObjectModel;

namespace Clutch.API.Domain.Shared;

public sealed record CurrencyAmountFormat(
    string Id,
    string DecimalSeparator,
    string GroupSeparator,
    string Reference,
    string Version);

public static class CurrencyAmountFormatRegistry
{
    private const string RegistryReference = "CLDR";
    private const string RegistryVersion = "44.0";

    private static readonly IReadOnlyDictionary<string, IReadOnlyList<CurrencyAmountFormat>> Formats =
        new ReadOnlyDictionary<string, IReadOnlyList<CurrencyAmountFormat>>(
            Currency.All.ToDictionary(
                currency => currency.Code,
                _ => (IReadOnlyList<CurrencyAmountFormat>)
                [
                    new(
                        "dot-decimal-comma-grouping",
                        ".",
                        ",",
                        RegistryReference,
                        RegistryVersion),
                    new(
                        "comma-decimal-dot-grouping",
                        ",",
                        ".",
                        RegistryReference,
                        RegistryVersion),
                ],
                StringComparer.Ordinal));

    public static IReadOnlyList<CurrencyAmountFormat> GetFormats(string currencyCode) =>
        Formats.TryGetValue(currencyCode, out var formats) ? formats : [];

    public static bool TryGetFormat(
        string currencyCode,
        string? formatId,
        out CurrencyAmountFormat? format)
    {
        format = GetFormats(currencyCode)
            .FirstOrDefault(candidate => candidate.Id == formatId);
        return format is not null;
    }
}
