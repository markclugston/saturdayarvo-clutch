namespace Clutch.API.Domain.Mortgages;

// One balance-bearing transaction: the account balance after it, on its date.
public readonly record struct BalancePoint(DateOnly Date, decimal Balance);

// An inclusive span of days.
public readonly record struct BalancePeriod(DateOnly Start, DateOnly End);

// Pure period-end lookup: balances are read from transactions, never calculated.
public static class PeriodBalances
{
    // Periods 1 to duration + 1 of a mortgage. Period 1 starts on the disbursal date and runs one payment
    // interval; period k starts k - 1 intervals after the disbursal date. A period ends the day before the
    // next starts, and the final row is the single day the mortgage's last interval ends. Stops early if a
    // date would pass 31 Dec 9999.
    public static IEnumerable<BalancePeriod> MortgagePeriods(
        DateOnly disbursalDate,
        int duration,
        PaymentFrequency frequency)
    {
        var start = disbursalDate;
        for (var period = 1; period <= duration; period++)
        {
            if (RepaymentDates.FinalRepaymentDate(disbursalDate, period + 1L, frequency) is not { } next)
            {
                yield return new BalancePeriod(start, DateOnly.MaxValue);
                yield break;
            }

            yield return new BalancePeriod(start, DayBefore(next));
            start = next;
        }

        yield return new BalancePeriod(start, start);
    }

    // Monthly periods, the day anchored on the first date and clamped to the month end.
    public static IEnumerable<BalancePeriod> MonthlyPeriods(DateOnly first)
    {
        var start = first;
        for (var period = 2; ; period++)
        {
            if (RepaymentDates.FinalRepaymentDate(first, period, PaymentFrequency.Monthly) is not { } next)
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
