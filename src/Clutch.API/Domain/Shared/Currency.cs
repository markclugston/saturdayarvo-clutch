namespace Clutch.API.Domain.Shared;

public sealed record Currency(string Code, string Name, int MinorUnits)
{
    private static readonly IReadOnlyList<Currency> SupportedCurrencies =
    [
        new("AUD", "Australian Dollar", 2),
        new("CAD", "Canadian Dollar", 2),
        new("EUR", "Euro", 2),
        new("GBP", "Pound Sterling", 2),
        new("HKD", "Hong Kong Dollar", 2),
        new("INR", "Indian Rupee", 2),
        new("JPY", "Japanese Yen", 0),
        new("NZD", "New Zealand Dollar", 2),
        new("SGD", "Singapore Dollar", 2),
        new("USD", "US Dollar", 2),
    ];

    public static IReadOnlyList<Currency> All => SupportedCurrencies;

    public static bool TryGet(string? code, out Currency? currency)
    {
        currency = SupportedCurrencies.FirstOrDefault(
            supported => string.Equals(supported.Code, code, StringComparison.Ordinal));
        return currency is not null;
    }
}
