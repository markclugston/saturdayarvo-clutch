using System.Text.RegularExpressions;

namespace Clutch.API.Domain.Accounts;

public static class AccountDescriptionValidator
{
    public const int MaximumLength = 200;

    private static readonly TimeSpan RegexTimeout = TimeSpan.FromMilliseconds(100);

    private static readonly Regex CardDigitGroups = new(
        @"(?<![\p{L}\p{N}])[0-9]+(?:[ -]+[0-9]+)*(?![\p{L}\p{N}])",
        RegexOptions.CultureInvariant,
        RegexTimeout);

    private static readonly Regex AccountLabels = new(
        @"(?<![\p{L}\p{N}])(?:account(?:\s*(?:number|no\.?|#))?|acct(?:\s*(?:number|no\.?|#))?|bsb\s*/\s*(?:account|acct)|(?:account|acct)\s*/\s*bsb|bsb)\s*[:#-]?\s*([0-9][0-9\s.,/-]*[0-9])",
        RegexOptions.CultureInvariant | RegexOptions.IgnoreCase,
        RegexTimeout);

    private static readonly Regex CardLabels = new(
        @"(?<![\p{L}\p{N}])(?:card(?:holder)?(?:\s*(?:number|no\.?|#))?|(?:credit|debit)\s+card|pan)\s*[:#-]?\s*([0-9][0-9 -]*[0-9])",
        RegexOptions.CultureInvariant | RegexOptions.IgnoreCase,
        RegexTimeout);

    public static bool IsValid(string? description)
    {
        if (string.IsNullOrWhiteSpace(description) || description.Length > MaximumLength)
        {
            return false;
        }

        return !ContainsLabelledAccountNumber(description)
            && !ContainsCardNumber(description);
    }

    private static bool ContainsLabelledAccountNumber(string description)
    {
        foreach (Match match in AccountLabels.Matches(description))
        {
            if (CountDigits(match.Groups[1].Value) >= 6)
            {
                return true;
            }
        }

        return false;
    }

    private static bool ContainsCardNumber(string description)
    {
        foreach (Match match in CardLabels.Matches(description))
        {
            var digits = DigitsOnly(match.Groups[1].Value);
            if (digits.Length is >= 13 and <= 19)
            {
                return true;
            }
        }

        foreach (Match match in CardDigitGroups.Matches(description))
        {
            var digits = DigitsOnly(match.Value);
            if (IsRecognizedCardNumber(digits))
            {
                return true;
            }
        }

        return false;
    }

    private static int CountDigits(string value) =>
        value.Count(character => character is >= '0' and <= '9');

    private static string DigitsOnly(string value) =>
        new(value.Where(character => character is >= '0' and <= '9').ToArray());

    private static bool IsRecognizedCardNumber(string digits)
    {
        if (digits.Length is 13 or 16 or 19 && digits.StartsWith('4'))
        {
            return true;
        }

        if (digits.Length == 15
            && (digits.StartsWith("34", StringComparison.Ordinal)
                || digits.StartsWith("37", StringComparison.Ordinal)))
        {
            return true;
        }

        if (digits.Length != 16)
        {
            return false;
        }

        var firstTwo = (digits[0] - '0') * 10 + digits[1] - '0';
        var firstFour = firstTwo * 100 + (digits[2] - '0') * 10 + digits[3] - '0';
        return firstTwo is >= 51 and <= 55 || firstFour is >= 2221 and <= 2720;
    }
}
