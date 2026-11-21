using System.Globalization;

namespace Clutch.API.Domain.Mortgages;

public sealed record RateChangeCandidate(decimal? NewInterestRate, string? EffectiveDate);

public sealed record MortgageCandidate(
    string? Name,
    decimal? StartingBalance,
    decimal? NumberOfPeriods,
    string? FirstRepaymentDate,
    string? RepaymentFrequency,
    IReadOnlyList<RateChangeCandidate> InterestRateChanges);

public sealed record ValidMortgage(
    string Name,
    decimal StartingBalance,
    int NumberOfPeriods,
    DateOnly FirstRepaymentDate,
    RepaymentFrequency RepaymentFrequency,
    IReadOnlyList<RateChangeValue> RateChanges);

// One message per field key: the first applicable row of the contract's message table.
public sealed record MortgageValidationResult(
    IReadOnlyDictionary<string, string> Errors,
    ValidMortgage? Value);

public static class MortgageValidator
{
    public const decimal MaximumStartingBalance = 999_999_999_999.99m;
    private const string DateFormat = "yyyy-MM-dd";

    public static MortgageValidationResult Validate(MortgageCandidate candidate, TimeProvider timeProvider)
    {
        var errors = new Dictionary<string, string>(StringComparer.Ordinal);
        var name = ValidateName(candidate.Name, errors);
        var balance = ValidateStartingBalance(candidate.StartingBalance, errors);
        var firstDate = ValidateFirstRepaymentDate(candidate.FirstRepaymentDate, timeProvider, errors);
        var frequency = ValidateFrequency(candidate.RepaymentFrequency, errors);
        var periods = ValidatePeriods(candidate.NumberOfPeriods, firstDate, frequency, errors);

        var rows = candidate.InterestRateChanges
            .Select((row, index) => (row, index))
            .Where(item => item.row.NewInterestRate is not null || item.row.EffectiveDate is not null)
            .ToList();
        if (rows.Count > Mortgage.MaximumInterestRateChanges)
        {
            errors["interestRateChanges"] =
                $"A mortgage can have up to {Mortgage.MaximumInterestRateChanges} interest rate changes";
        }

        var parsedDates = rows.ToDictionary(item => item.index, item => ParseDate(item.row.EffectiveDate));
        var datesUsedTwice = parsedDates.Values
            .Where(date => date is not null)
            .GroupBy(date => date!.Value)
            .Where(group => group.Count() > 1)
            .Select(group => group.Key)
            .ToHashSet();

        var headerValid = !errors.ContainsKey("firstRepaymentDate")
            && !errors.ContainsKey("numberOfPeriods")
            && !errors.ContainsKey("repaymentFrequency")
            && firstDate is not null
            && periods is not null
            && frequency is not null;
        DateOnly? finalDate = headerValid
            ? RepaymentDates.FinalRepaymentDate(firstDate!.Value, periods!.Value, frequency!.Value)
            : null;

        var changes = new List<RateChangeValue>();
        foreach (var (row, index) in rows)
        {
            var prefix = $"interestRateChanges[{index}]";
            var rate = ValidateRate(row.NewInterestRate, $"{prefix}.newInterestRate", errors);
            var date = parsedDates[index];
            var dateKey = $"{prefix}.effectiveDate";
            if (date is null)
            {
                errors[dateKey] = "Enter a valid date";
            }
            else if (datesUsedTwice.Contains(date.Value))
            {
                errors[dateKey] = "This effective date is already used";
            }
            else if (headerValid && finalDate is { } final
                && (date.Value < firstDate!.Value || date.Value > final))
            {
                errors[dateKey] =
                    $"Choose a date from {FormatDate(firstDate.Value)} to {FormatDate(final)}";
            }

            if (rate is not null && date is not null)
            {
                changes.Add(new RateChangeValue(rate.Value, date.Value));
            }
        }

        if (headerValid
            && !errors.ContainsKey("interestRateChanges")
            && !changes.Any(change => change.EffectiveDate == firstDate!.Value))
        {
            errors["interestRateChanges"] =
                "Add the opening interest rate, effective on the first repayment date";
        }

        if (errors.Count > 0)
        {
            return new MortgageValidationResult(errors, null);
        }

        return new MortgageValidationResult(
            errors,
            new ValidMortgage(
                name!,
                balance!.Value,
                periods!.Value,
                firstDate!.Value,
                frequency!.Value,
                changes));
    }

    public static string FormatDate(DateOnly date) =>
        date.ToString("d MMM yyyy", CultureInfo.InvariantCulture);

    private static string? ValidateName(string? value, Dictionary<string, string> errors)
    {
        var trimmed = value?.Trim();
        if (string.IsNullOrEmpty(trimmed))
        {
            errors["name"] = "Enter a name";
            return null;
        }

        if (trimmed.Length > Mortgage.MaximumNameLength)
        {
            errors["name"] = "Enter a name of up to 100 characters";
            return null;
        }

        return trimmed;
    }

    private static decimal? ValidateStartingBalance(decimal? value, Dictionary<string, string> errors)
    {
        if (value is null or <= 0)
        {
            errors["startingBalance"] = "Enter a starting balance greater than 0";
            return null;
        }

        if (value > MaximumStartingBalance)
        {
            errors["startingBalance"] = "Enter a starting balance up to 999,999,999,999.99";
            return null;
        }

        if (value != decimal.Round(value.Value, 2))
        {
            errors["startingBalance"] = "Enter a starting balance with up to 2 decimal places";
            return null;
        }

        return value;
    }

    private static DateOnly? ValidateFirstRepaymentDate(
        string? value,
        TimeProvider timeProvider,
        Dictionary<string, string> errors)
    {
        var date = ParseDate(value);
        if (date is null)
        {
            errors["firstRepaymentDate"] = "Enter a valid date";
            return null;
        }

        // The latest date anywhere in the world (UTC+14), so a valid local date is never rejected.
        var latest = DateOnly.FromDateTime(timeProvider.GetUtcNow().AddHours(14).UtcDateTime);
        if (date.Value > latest)
        {
            errors["firstRepaymentDate"] = "Enter a date that is not in the future";
            return null;
        }

        return date;
    }

    private static RepaymentFrequency? ValidateFrequency(string? value, Dictionary<string, string> errors)
    {
        RepaymentFrequency? frequency = value switch
        {
            "Weekly" => RepaymentFrequency.Weekly,
            "Fortnightly" => RepaymentFrequency.Fortnightly,
            "Monthly" => RepaymentFrequency.Monthly,
            _ => null,
        };
        if (frequency is null)
        {
            errors["repaymentFrequency"] = "Choose Weekly, Fortnightly or Monthly";
        }

        return frequency;
    }

    private static int? ValidatePeriods(
        decimal? value,
        DateOnly? firstDate,
        RepaymentFrequency? frequency,
        Dictionary<string, string> errors)
    {
        if (value is null || value < 1 || value != decimal.Truncate(value.Value))
        {
            errors["numberOfPeriods"] = "Enter a whole number of 1 or more";
            return null;
        }

        const string tooLate = "The final repayment date would be later than 31 Dec 9999";
        if (value > int.MaxValue)
        {
            errors["numberOfPeriods"] = tooLate;
            return null;
        }

        var periods = (int)value;
        if (firstDate is not null
            && frequency is not null
            && RepaymentDates.FinalRepaymentDate(firstDate.Value, periods, frequency.Value) is null)
        {
            errors["numberOfPeriods"] = tooLate;
            return null;
        }

        return periods;
    }

    private static decimal? ValidateRate(decimal? value, string key, Dictionary<string, string> errors)
    {
        if (value is null)
        {
            errors[key] = "Enter an interest rate";
            return null;
        }

        if (value < 0 || value > 100)
        {
            errors[key] = "Enter an interest rate from 0 to 100";
            return null;
        }

        if (value != decimal.Round(value.Value, 2))
        {
            errors[key] = "Enter an interest rate with up to 2 decimal places";
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
