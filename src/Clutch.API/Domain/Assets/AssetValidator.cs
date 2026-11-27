using System.Globalization;
using Clutch.API.Domain.Shared;

namespace Clutch.API.Domain.Assets;

public sealed record ValuationCandidate(string? Id, decimal? Value, string? ValuationDate);

public sealed record AssetCandidate(
    string? Name,
    string? Description,
    string? CurrencyCode,
    IReadOnlyList<ValuationCandidate> Valuations);

public sealed record ValidValuation(Guid? Id, decimal Value, DateOnly ValuationDate);

public sealed record ValidAsset(
    string Name,
    string? Description,
    Currency Currency,
    IReadOnlyList<ValidValuation> Valuations);

// One message per field key, as the assets API contract's validation table lists them.
public sealed record AssetValidationResult(
    IReadOnlyDictionary<string, string> Errors,
    ValidAsset? Value);

public static class AssetValidator
{
    public const decimal MaximumValue = 999_999_999_999.99m;
    public const string UnknownValuationMessage = "This valuation is no longer part of the asset";
    private const string DateFormat = "yyyy-MM-dd";

    // The most decimal places any value may have; the column is decimal(18,2).
    private const int MaximumMinorUnits = 2;

    public static AssetValidationResult Validate(AssetCandidate candidate, TimeProvider timeProvider)
    {
        var errors = new Dictionary<string, string>(StringComparer.Ordinal);
        var name = ValidateName(candidate.Name, errors);
        var description = ValidateDescription(candidate.Description, errors);
        if (!Currency.TryGet(candidate.CurrencyCode, out var currency))
        {
            errors["currencyCode"] = "Select a currency";
        }

        var valuations = ValidateValuations(candidate.Valuations, currency, timeProvider, errors);

        return errors.Count > 0
            ? new AssetValidationResult(errors, null)
            : new AssetValidationResult(errors, new ValidAsset(name!, description, currency!, valuations));
    }

    private static string? ValidateName(string? value, Dictionary<string, string> errors)
    {
        var trimmed = value?.Trim();
        if (string.IsNullOrEmpty(trimmed))
        {
            errors["name"] = "Enter a name";
            return null;
        }

        if (trimmed.Length > Asset.MaximumNameLength)
        {
            errors["name"] = "Enter a name of up to 100 characters";
            return null;
        }

        return trimmed;
    }

    private static string? ValidateDescription(string? value, Dictionary<string, string> errors)
    {
        var trimmed = value?.Trim();
        if (string.IsNullOrEmpty(trimmed))
        {
            return null;
        }

        if (trimmed.Length > Asset.MaximumDescriptionLength)
        {
            errors["description"] = "Enter a description of up to 500 characters";
            return null;
        }

        return trimmed;
    }

    private static List<ValidValuation> ValidateValuations(
        IReadOnlyList<ValuationCandidate> candidates,
        Currency? currency,
        TimeProvider timeProvider,
        Dictionary<string, string> errors)
    {
        var valid = new List<ValidValuation>();
        if (candidates.Count == 0)
        {
            errors["valuations"] = "Add at least one valuation";
            return valid;
        }

        var dates = candidates.Select(candidate => ParseDate(candidate.ValuationDate)).ToList();
        var datesUsedTwice = dates
            .Where(date => date is not null)
            .GroupBy(date => date!.Value)
            .Where(group => group.Count() > 1)
            .Select(group => group.Key)
            .ToHashSet();
        // The latest date anywhere in the world (UTC+14), so a valid local date is never rejected.
        var latest = DateOnly.FromDateTime(timeProvider.GetUtcNow().AddHours(14).UtcDateTime);

        for (var index = 0; index < candidates.Count; index++)
        {
            var candidate = candidates[index];
            var prefix = $"valuations[{index}]";

            Guid? id = null;
            if (candidate.Id is not null)
            {
                if (Guid.TryParse(candidate.Id, out var parsed) && parsed != Guid.Empty)
                {
                    id = parsed;
                }
                else
                {
                    errors[$"{prefix}.id"] = UnknownValuationMessage;
                }
            }

            var value = ValidateValue(candidate.Value, currency, $"{prefix}.value", errors);

            var date = dates[index];
            var dateKey = $"{prefix}.valuationDate";
            if (date is null)
            {
                errors[dateKey] = "Enter a valid date";
            }
            else if (date.Value > latest)
            {
                errors[dateKey] = "Enter a date that is not in the future";
            }
            else if (datesUsedTwice.Contains(date.Value))
            {
                errors[dateKey] = "This valuation date is already used";
            }

            if (value is not null && date is not null)
            {
                valid.Add(new ValidValuation(id, value.Value, date.Value));
            }
        }

        return valid;
    }

    private static decimal? ValidateValue(
        decimal? value,
        Currency? currency,
        string key,
        Dictionary<string, string> errors)
    {
        if (value is null)
        {
            errors[key] = "Enter a value";
            return null;
        }

        if (value < 0)
        {
            errors[key] = "Enter a value of 0 or more";
            return null;
        }

        if (value > MaximumValue)
        {
            errors[key] = "Enter a value up to 999,999,999,999.99";
            return null;
        }

        var minorUnits = currency?.MinorUnits ?? MaximumMinorUnits;
        if (value != decimal.Round(value.Value, minorUnits))
        {
            errors[key] = minorUnits == 0
                ? $"{currency!.Code} values have no decimal places"
                : $"Enter at most {minorUnits} decimal places";
            return null;
        }

        return value;
    }

    private static DateOnly? ParseDate(string? value) =>
        value is not null
        && DateOnly.TryParseExact(
            value,
            DateFormat,
            CultureInfo.InvariantCulture,
            DateTimeStyles.None,
            out var date)
            ? date
            : null;
}
