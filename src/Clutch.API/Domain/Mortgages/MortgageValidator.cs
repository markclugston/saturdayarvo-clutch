using System.Globalization;

namespace Clutch.API.Domain.Mortgages;

public sealed record RateChangeCandidate(decimal? NewInterestRate, string? EffectiveDate);

public sealed record MortgageCandidate(
    string? Name,
    decimal? OpeningBalance,
    decimal? Duration,
    string? DrawdownDate,
    string? PaymentFrequency,
    IReadOnlyList<RateChangeCandidate> InterestRateChanges,
    string? AccountId = null);

public sealed record ValidMortgage(
    string Name,
    decimal OpeningBalance,
    int Duration,
    DateOnly DrawdownDate,
    PaymentFrequency PaymentFrequency,
    IReadOnlyList<RateChangeValue> RateChanges,
    Guid? AccountId);

// One message per field key: the first applicable row of the contract's message table.
public sealed record MortgageValidationResult(
    IReadOnlyDictionary<string, string> Errors,
    ValidMortgage? Value);

public static class MortgageValidator
{
    public const decimal MaximumOpeningBalance = 999_999_999_999.99m;
    private const string DateFormat = "yyyy-MM-dd";

    public static MortgageValidationResult Validate(MortgageCandidate candidate, TimeProvider timeProvider)
    {
        var errors = new Dictionary<string, string>(StringComparer.Ordinal);
        var name = ValidateName(candidate.Name, errors);
        var balance = ValidateOpeningBalance(candidate.OpeningBalance, errors);
        var firstDate = ValidateDrawdownDate(candidate.DrawdownDate, timeProvider, errors);
        var frequency = ValidateFrequency(candidate.PaymentFrequency, errors);
        var periods = ValidatePeriods(candidate.Duration, firstDate, frequency, errors);
        var accountId = ValidateAccountId(candidate.AccountId, errors);

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

        var headerValid = !errors.ContainsKey("drawdownDate")
            && !errors.ContainsKey("duration")
            && !errors.ContainsKey("paymentFrequency")
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
                "Add the opening interest rate, effective on the drawdown date";
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
                changes,
                accountId));
    }

    public const string AccountIdMessage = "Choose one of your accounts";

    public static string FormatDate(DateOnly date) =>
        date.ToString("d MMM yyyy", CultureInfo.InvariantCulture);

    // Blank means no linked account; ownership is checked by the service.
    private static Guid? ValidateAccountId(string? value, Dictionary<string, string> errors)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        if (Guid.TryParse(value, out var id) && id != Guid.Empty)
        {
            return id;
        }

        errors["accountId"] = AccountIdMessage;
        return null;
    }

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

    private static decimal? ValidateOpeningBalance(decimal? value, Dictionary<string, string> errors)
    {
        if (value is null or <= 0)
        {
            errors["openingBalance"] = "Enter a opening balance greater than 0";
            return null;
        }

        if (value > MaximumOpeningBalance)
        {
            errors["openingBalance"] = "Enter a opening balance up to 999,999,999,999.99";
            return null;
        }

        if (value != decimal.Round(value.Value, 2))
        {
            errors["openingBalance"] = "Enter a opening balance with up to 2 decimal places";
            return null;
        }

        return value;
    }

    private static DateOnly? ValidateDrawdownDate(
        string? value,
        TimeProvider timeProvider,
        Dictionary<string, string> errors)
    {
        var date = ParseDate(value);
        if (date is null)
        {
            errors["drawdownDate"] = "Enter a valid date";
            return null;
        }

        // The latest date anywhere in the world (UTC+14), so a valid local date is never rejected.
        var latest = DateOnly.FromDateTime(timeProvider.GetUtcNow().AddHours(14).UtcDateTime);
        if (date.Value > latest)
        {
            errors["drawdownDate"] = "Enter a date that is not in the future";
            return null;
        }

        return date;
    }

    private static PaymentFrequency? ValidateFrequency(string? value, Dictionary<string, string> errors)
    {
        PaymentFrequency? frequency = value switch
        {
            "Weekly" => PaymentFrequency.Weekly,
            "Fortnightly" => PaymentFrequency.Fortnightly,
            "Monthly" => PaymentFrequency.Monthly,
            _ => null,
        };
        if (frequency is null)
        {
            errors["paymentFrequency"] = "Choose Weekly, Fortnightly or Monthly";
        }

        return frequency;
    }

    private static int? ValidatePeriods(
        decimal? value,
        DateOnly? firstDate,
        PaymentFrequency? frequency,
        Dictionary<string, string> errors)
    {
        if (value is null || value < 1 || value != decimal.Truncate(value.Value))
        {
            errors["duration"] = "Enter a whole number of 1 or more";
            return null;
        }

        const string tooLate = "The final repayment date would be later than 31 Dec 9999";
        if (value > int.MaxValue)
        {
            errors["duration"] = tooLate;
            return null;
        }

        var periods = (int)value;
        if (firstDate is not null
            && frequency is not null
            && RepaymentDates.FinalRepaymentDate(firstDate.Value, periods, frequency.Value) is null)
        {
            errors["duration"] = tooLate;
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
