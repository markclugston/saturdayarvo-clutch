namespace Clutch.API.Domain.Mortgages;

// One balance-bearing transaction: the account balance after it, on its date.
public readonly record struct BalancePoint(DateOnly Date, decimal Balance);

// An inclusive span of days.
public readonly record struct BalancePeriod(DateOnly Start, DateOnly End);

// Pure period-end lookup: balances are read from transactions, never calculated.
public static class PeriodBalances
{
    // Periods 1 to duration of a mortgage. Period k is dated D(k), the disbursal date plus k payment intervals,
    // and its window ends on D(k) so the lookup reads the end-of-day balance on that date. Period k starts the
    // day after D(k - 1); period 1 is open at the start. Stops before a date that would pass 31 Dec 9999
    // (unreachable for validated input).
    public static IEnumerable<BalancePeriod> MortgagePeriods(
        DateOnly disbursalDate,
        int duration,
        PaymentFrequency frequency)
    {
        var start = DateOnly.MinValue;
        for (var period = 1; period <= duration; period++)
        {
            if (RepaymentDates.FinalRepaymentDate(disbursalDate, period, frequency) is not { } date)
            {
                yield break;
            }

            yield return new BalancePeriod(start, date);
            if (date == DateOnly.MaxValue)
            {
                yield break;
            }

            start = date.AddDays(1);
        }
    }

    // Monthly periods, the day anchored on the first date and clamped to the month end.
    public static IEnumerable<BalancePeriod> MonthlyPeriods(DateOnly first)
    {
        var start = first;
        for (var period = 2; ; period++)
        {
            // Period k starts k - 1 months after the first date (the loop starts at 2, so never 0 steps).
            if (RepaymentDates.FinalRepaymentDate(first, period - 1L, PaymentFrequency.Monthly) is not { } next)
            {
                yield return new BalancePeriod(start, DateOnly.MaxValue);
                yield break;
            }

            yield return new BalancePeriod(start, DayBefore(next));
            start = next;
        }
    }

    // The column starts out positive: when the first non-zero balance is negative (a debt stored as a negative
    // balance), every balance has its sign inverted. The column goes negative only if the balance crosses zero.
    public static IReadOnlyList<BalancePoint> Orient(IReadOnlyList<BalancePoint> points)
    {
        var first = points.FirstOrDefault(point => point.Balance != 0m);
        if (first.Balance >= 0m)
        {
            return points;
        }

        return points.Select(point => point with { Balance = -point.Balance }).ToList();
    }

    // points must be ordered by date then Sequence (the Transactions list order, reversed). A period holds the last
    // point on or before its end; periods before the first point are blank. Enumeration stops at the first
    // period that starts after the latest point (no carrying forward), and trailing blanks are dropped.
    public static IReadOnlyList<decimal?> Lookup(
        IReadOnlyList<BalancePoint> points,
        IEnumerable<BalancePeriod> periods)
    {
        var balances = new List<decimal?>();
        if (points.Count == 0)
        {
            return balances;
        }

        var latest = points[^1].Date;
        var next = 0;
        foreach (var period in periods)
        {
            if (period.Start > latest)
            {
                break;
            }

            while (next < points.Count && points[next].Date <= period.End)
            {
                next++;
            }

            balances.Add(next > 0 ? points[next - 1].Balance : null);
        }

        while (balances.Count > 0 && balances[^1] is null)
        {
            balances.RemoveAt(balances.Count - 1);
        }

        return balances;
    }

    private static DateOnly DayBefore(DateOnly date) =>
        date == DateOnly.MinValue ? date : date.AddDays(-1);
}
