using System.Globalization;
using Clutch.API.Api.ProblemDetails;
using Clutch.API.Application.Accounts;
using Clutch.API.Domain.Mortgages;
using Clutch.API.Domain.Shared;
using Clutch.API.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Clutch.API.Application.Mortgages;

public sealed record PeriodBalancesResult(
    string CurrencyCode,
    int PeriodCount,
    IReadOnlyList<string?> Balances);

public sealed class PeriodBalanceService(
    AppDbContext dbContext,
    AccountService accountService,
    ILogger<PeriodBalanceService> logger)
{
    private const string DateFormat = "yyyy-MM-dd";

    // The three schedule values are all given or all absent (monthly fallback from the account history).
    public async Task<PeriodBalancesResult> GetAsync(
        string ownerUserId,
        Guid accountId,
        string? disbursalDate,
        string? frequency,
        string? duration,
        CancellationToken cancellationToken)
    {
        var started = MortgageMetrics.Start();
        var mode = "fallback";
        var outcome = "failure";
        try
        {
            var account = await accountService.GetOwnedAsync(ownerUserId, accountId, cancellationToken);
            if (account is null)
            {
                outcome = "not_found";
                throw new ApiProblemException(
                    StatusCodes.Status404NotFound,
                    "Account not found.",
                    "The account does not exist or is not available to this user.");
            }

            var schedule = ParseSchedule(disbursalDate, frequency, duration);
            mode = schedule is null ? "fallback" : "mortgage";

            var points = await dbContext.Transactions
                .AsNoTracking()
                .Where(transaction => transaction.AccountId == accountId && transaction.Balance != null)
                .OrderBy(transaction => transaction.TransactionDate)
                .ThenBy(transaction => transaction.Sequence)
                .Select(transaction => new BalancePoint(transaction.TransactionDate, transaction.Balance!.Value))
                .ToListAsync(cancellationToken);
            points = PeriodBalances.Orient(points).ToList();

            IReadOnlyList<decimal?> balances;
            int periodCount;
            if (schedule is { } valid)
            {
                balances = PeriodBalances.Lookup(
                    points,
                    PeriodBalances.MortgagePeriods(valid.DisbursalDate, valid.Duration, valid.Frequency));
                periodCount = valid.Duration;
            }
            else
            {
                balances = points.Count == 0
                    ? []
                    : PeriodBalances.Lookup(points, PeriodBalances.MonthlyPeriods(points[0].Date));
                periodCount = balances.Count;
            }

            var minorUnits = Currency.TryGet(account.CurrencyCode, out var currency)
                ? currency!.MinorUnits
                : 2;
            var format = "F" + minorUnits.ToString(CultureInfo.InvariantCulture);
            outcome = "success";
            logger.LogInformation(
                "Period balances were read for account {AccountId} in {Mode} mode.",
                accountId,
                mode);
            return new PeriodBalancesResult(
                account.CurrencyCode,
                periodCount,
                balances.Select(balance => balance?.ToString(format, CultureInfo.InvariantCulture)).ToList());
        }
        catch (ApiProblemException exception)
        {
            if (outcome == "failure")
            {
                outcome = "invalid";
            }

            logger.LogInformation(
                "A period balance read for account {AccountId} was rejected with status {StatusCode}.",
                accountId,
                exception.StatusCode);
            throw;
        }
        finally
        {
            MortgageMetrics.RecordBalanceRead(mode, outcome, started);
        }
    }

    private static (DateOnly DisbursalDate, PaymentFrequency Frequency, int Duration)? ParseSchedule(
        string? disbursalDate,
        string? frequency,
        string? duration)
    {
        if (string.IsNullOrEmpty(disbursalDate) && string.IsNullOrEmpty(frequency) && string.IsNullOrEmpty(duration))
        {
            return null;
        }

        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);
        DateOnly? date = DateOnly.TryParseExact(
            disbursalDate,
            DateFormat,
            CultureInfo.InvariantCulture,
            DateTimeStyles.None,
            out var parsedDate)
            ? parsedDate
            : null;
        if (date is null)
        {
            errors["disbursalDate"] = ["Enter a valid date"];
        }

        PaymentFrequency? parsedFrequency = frequency switch
        {
            "Weekly" => PaymentFrequency.Weekly,
            "Fortnightly" => PaymentFrequency.Fortnightly,
            "Monthly" => PaymentFrequency.Monthly,
            _ => null,
        };
        if (parsedFrequency is null)
        {
            errors["frequency"] = ["Choose Weekly, Fortnightly or Monthly"];
        }

        int? periods = int.TryParse(
            duration,
            NumberStyles.None,
            CultureInfo.InvariantCulture,
            out var parsedDuration) && parsedDuration >= 1
            ? parsedDuration
            : null;
        if (periods is null)
        {
            errors["duration"] = ["Enter a whole number of 1 or more"];
        }
        else if (date is not null
            && parsedFrequency is not null
            && RepaymentDates.FinalRepaymentDate(date.Value, periods.Value, parsedFrequency.Value) is null)
        {
            errors["duration"] = ["The final repayment date would be later than 31 Dec 9999"];
        }

        if (errors.Count > 0)
        {
            throw new ApiProblemException(
                StatusCodes.Status400BadRequest,
                "The period balance request is invalid.",
                "Correct the highlighted fields and try again.",
                errors);
        }

        return (date!.Value, parsedFrequency!.Value, periods!.Value);
    }
}
