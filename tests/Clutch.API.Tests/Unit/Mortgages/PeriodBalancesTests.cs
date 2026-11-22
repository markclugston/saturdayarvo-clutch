using Clutch.API.Domain.Mortgages;

namespace Clutch.API.Tests.Unit.Mortgages;

public sealed class PeriodBalancesTests
{
    private static DateOnly D(int year, int month, int day) => new(year, month, day);

    private static BalancePoint P(DateOnly date, decimal balance) => new(date, balance);

    [Fact]
    public void Period_1_starts_on_the_disbursal_date_and_ends_one_payment_interval_later()
    {
        var periods = PeriodBalances.MortgagePeriods(D(2026, 1, 31), 3, PaymentFrequency.Monthly).ToList();

        Assert.Equal(4, periods.Count);
        Assert.Equal(D(2026, 1, 31), periods[0].Start);
        Assert.Equal(D(2026, 2, 27), periods[0].End); // clamped 28 Feb minus one day
        Assert.Equal(D(2026, 2, 28), periods[1].Start);
        Assert.Equal(D(2026, 3, 30), periods[1].End);
        Assert.Equal(D(2026, 3, 31), periods[2].Start);
        Assert.Equal(D(2026, 4, 29), periods[2].End);
        Assert.Equal(D(2026, 4, 30), periods[3].Start);
        Assert.Equal(D(2026, 4, 30), periods[3].End); // final row is a single day
    }

    [Theory]
    [InlineData(PaymentFrequency.Weekly, 7)]
    [InlineData(PaymentFrequency.Fortnightly, 14)]
    public void Weekly_and_fortnightly_periods_step_by_whole_weeks(PaymentFrequency frequency, int days)
    {
        var start = D(2026, 1, 5);

        var periods = PeriodBalances.MortgagePeriods(start, 2, frequency).ToList();

        Assert.Equal(start, periods[0].Start);
        Assert.Equal(start.AddDays(days - 1), periods[0].End);
        Assert.Equal(start.AddDays(2 * days), periods[2].Start);
        Assert.Equal(periods[2].Start, periods[2].End);
    }

    [Fact]
    public void A_balance_is_the_last_one_on_or_before_the_period_end()
    {
        var points = new[]
        {
            P(D(2026, 1, 10), 100m),
            P(D(2026, 2, 15), 90m),
            P(D(2026, 2, 20), 80m),
            P(D(2026, 4, 2), 70m),
        };

        var balances = PeriodBalances.Lookup(points, PeriodBalances.MonthlyPeriods(D(2026, 1, 1)));

        // Jan: 100. Feb: 80 (last in period). Mar: no transaction, so 80 carries. Apr: 70 (latest point's period).
        Assert.Equal<decimal?>([100m, 80m, 80m, 70m], balances);
    }

    [Fact]
    public void Periods_ending_before_the_first_balance_are_blank()
    {
        var points = new[] { P(D(2026, 3, 10), 50m) };

        var balances = PeriodBalances.Lookup(points, PeriodBalances.MonthlyPeriods(D(2026, 1, 1)));

        Assert.Equal<decimal?>([null, null, 50m], balances);
    }

    [Fact]
    public void A_balance_is_never_carried_into_a_period_starting_after_the_latest_balance_date()
    {
        var points = new[] { P(D(2026, 1, 10), 50m) };
        var periods = PeriodBalances.MortgagePeriods(D(2026, 1, 1), 12, PaymentFrequency.Monthly);

        var balances = PeriodBalances.Lookup(points, periods);

        // Period 1 [1 Jan, 31 Jan] holds the point; period 2 starts after it.
        Assert.Equal<decimal?>([50m], balances);
    }

    [Fact]
    public void Trailing_blanks_are_omitted_but_leading_blanks_stay()
    {
        var points = new[] { P(D(2026, 2, 10), 5m) };

        var balances = PeriodBalances.Lookup(points, PeriodBalances.MonthlyPeriods(D(2026, 1, 1)));

        Assert.Equal<decimal?>([null, 5m], balances);
    }

    [Fact]
    public void Same_day_points_keep_the_order_given_so_the_last_one_wins()
    {
        var points = new[]
        {
            P(D(2026, 1, 10), 100m),
            P(D(2026, 1, 10), 60m),
        };

        var balances = PeriodBalances.Lookup(points, PeriodBalances.MonthlyPeriods(D(2026, 1, 1)));

        Assert.Equal<decimal?>([60m], balances);
    }

    [Fact]
    public void Orient_inverts_a_debt_stored_as_negative_so_the_column_starts_positive()
    {
        var points = new[] { P(D(2026, 1, 1), -500m), P(D(2026, 2, 1), -100m), P(D(2026, 3, 1), 50m) };

        var oriented = PeriodBalances.Orient(points);

        Assert.Equal([500m, 100m, -50m], oriented.Select(point => point.Balance));
    }

    [Fact]
    public void Orient_keeps_positive_balances_and_goes_negative_only_after_crossing_zero()
    {
        var points = new[] { P(D(2026, 1, 1), 0m), P(D(2026, 2, 1), 500m), P(D(2026, 3, 1), -20m) };

        Assert.Equal([0m, 500m, -20m], PeriodBalances.Orient(points).Select(point => point.Balance));
    }

    [Fact]
    public void Orient_of_no_points_is_empty() =>
        Assert.Empty(PeriodBalances.Orient([]));

    [Fact]
    public void No_points_gives_no_balances() =>
        Assert.Empty(PeriodBalances.Lookup([], PeriodBalances.MonthlyPeriods(D(2026, 1, 1))));

    [Fact]
    public void Monthly_fallback_periods_anchor_the_day_and_clamp_to_month_end()
    {
        var periods = PeriodBalances.MonthlyPeriods(D(2026, 1, 31)).Take(3).ToList();

        Assert.Equal(D(2026, 1, 31), periods[0].Start);
        Assert.Equal(D(2026, 2, 27), periods[0].End);
        Assert.Equal(D(2026, 2, 28), periods[1].Start);
        Assert.Equal(D(2026, 3, 30), periods[1].End);
        Assert.Equal(D(2026, 3, 31), periods[2].Start);
    }

    [Fact]
    public void Irregular_period_lengths_each_use_their_own_end()
    {
        // Monthly from the 31st: [31 Jan, 27 Feb], [28 Feb, 30 Mar], [31 Mar, ...].
        var points = new[]
        {
            P(D(2026, 2, 27), 10m),
            P(D(2026, 2, 28), 20m),
            P(D(2026, 3, 30), 30m),
        };

        var balances = PeriodBalances.Lookup(points, PeriodBalances.MonthlyPeriods(D(2026, 1, 31)));

        Assert.Equal<decimal?>([10m, 30m], balances);
    }

    [Fact]
    public void Periods_stop_at_the_last_representable_date()
    {
        var periods = PeriodBalances.MonthlyPeriods(D(9999, 11, 15)).ToList();

        Assert.Equal(2, periods.Count);
        Assert.Equal(D(9999, 12, 15), periods[1].Start);
        Assert.Equal(DateOnly.MaxValue, periods[1].End);
    }
}
