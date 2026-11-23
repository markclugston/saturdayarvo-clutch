using Clutch.API.Domain.Mortgages;

namespace Clutch.API.Tests.Unit.Mortgages;

public sealed class PeriodBalancesTests
{
    private static DateOnly D(int year, int month, int day) => new(year, month, day);

    private static BalancePoint P(DateOnly date, decimal balance) => new(date, balance);

    // 022: period k ends on its date D(k) = disbursal + k intervals and starts the day after D(k - 1).
    [Fact]
    public void Each_period_ends_on_its_repayment_date_and_period_1_is_open_at_the_start()
    {
        var periods = PeriodBalances.MortgagePeriods(D(2024, 1, 31), 3, PaymentFrequency.Monthly).ToList();

        Assert.Equal(
            [
                new BalancePeriod(DateOnly.MinValue, D(2024, 2, 29)),
                new BalancePeriod(D(2024, 3, 1), D(2024, 3, 31)),
                new BalancePeriod(D(2024, 4, 1), D(2024, 4, 30)),
            ],
            periods);
    }

    [Fact]
    public void Duration_360_monthly_from_29_Nov_2023_gives_360_windows_ending_on_each_period_date()
    {
        var disbursal = D(2023, 11, 29);

        var periods = PeriodBalances.MortgagePeriods(disbursal, 360, PaymentFrequency.Monthly).ToList();

        Assert.Equal(360, periods.Count);
        Assert.Equal(DateOnly.MinValue, periods[0].Start);
        Assert.Equal(D(2023, 12, 29), periods[0].End);
        Assert.Equal(D(2023, 12, 30), periods[1].Start);
        Assert.Equal(D(2024, 1, 29), periods[1].End);
        Assert.Equal(D(2053, 11, 29), periods[^1].End);
        for (var k = 1; k <= 360; k++)
        {
            Assert.Equal(RepaymentDates.FinalRepaymentDate(disbursal, k, PaymentFrequency.Monthly), periods[k - 1].End);
        }
    }

    [Theory]
    [InlineData(PaymentFrequency.Weekly, 7)]
    [InlineData(PaymentFrequency.Fortnightly, 14)]
    public void Weekly_and_fortnightly_periods_step_by_whole_weeks(PaymentFrequency frequency, int days)
    {
        var disbursal = D(2026, 1, 5);

        var periods = PeriodBalances.MortgagePeriods(disbursal, 2, frequency).ToList();

        Assert.Equal(
            [
                new BalancePeriod(DateOnly.MinValue, disbursal.AddDays(days)),
                new BalancePeriod(disbursal.AddDays(days + 1), disbursal.AddDays(2 * days)),
            ],
            periods);
    }

    [Fact]
    public void Mortgage_periods_stop_before_a_date_past_31_Dec_9999()
    {
        // Saved under the old rule: 9999-12-10 + 4 weeks passes 31 Dec 9999 (unreachable for validated input).
        var periods = PeriodBalances.MortgagePeriods(D(9999, 12, 10), 4, PaymentFrequency.Weekly).ToList();

        Assert.Equal(3, periods.Count);
        Assert.Equal(D(9999, 12, 31), periods[^1].End);
    }

    [Fact]
    public void Transactions_on_a_period_date_give_its_end_of_day_balance_the_last_by_order()
    {
        var points = new[]
        {
            P(D(2023, 12, 28), 300m),
            P(D(2023, 12, 29), 200m),
            P(D(2023, 12, 29), 150m),
            P(D(2024, 1, 29), 100m),
        };

        var balances = PeriodBalances.Lookup(
            points, PeriodBalances.MortgagePeriods(D(2023, 11, 29), 3, PaymentFrequency.Monthly));

        Assert.Equal<decimal?>([150m, 100m], balances);
    }

    [Fact]
    public void With_no_transaction_on_the_date_the_previous_balance_is_used_and_the_next_day_is_ignored()
    {
        var points = new[]
        {
            P(D(2023, 12, 20), 300m),
            P(D(2023, 12, 30), 250m), // the day after period 1's date
            P(D(2024, 2, 1), 200m),
        };

        var balances = PeriodBalances.Lookup(
            points, PeriodBalances.MortgagePeriods(D(2023, 11, 29), 6, PaymentFrequency.Monthly));

        // Period 1 (29 Dec): 300. Period 2 (29 Jan): 250. Period 3 (29 Feb): 200; later periods omitted.
        Assert.Equal<decimal?>([300m, 250m, 200m], balances);
    }

    [Fact]
    public void Periods_dated_before_the_first_transaction_are_blank()
    {
        var points = new[] { P(D(2024, 2, 10), 50m) };

        var balances = PeriodBalances.Lookup(
            points, PeriodBalances.MortgagePeriods(D(2023, 11, 29), 6, PaymentFrequency.Monthly));

        Assert.Equal<decimal?>([null, null, 50m], balances);
    }

    [Fact]
    public void The_latest_transaction_between_periods_3_and_4_shows_in_period_4_and_later_periods_are_omitted()
    {
        var points = new[] { P(D(2023, 12, 1), 500m), P(D(2024, 3, 10), 400m) };

        var balances = PeriodBalances.Lookup(
            points, PeriodBalances.MortgagePeriods(D(2023, 11, 29), 12, PaymentFrequency.Monthly));

        // Dates: 29 Dec, 29 Jan, 29 Feb, 29 Mar. 10 Mar falls between periods 3 and 4.
        Assert.Equal<decimal?>([500m, 500m, 500m, 400m], balances);
    }

    [Fact]
    public void The_latest_transaction_before_period_1s_date_shows_in_period_1()
    {
        var points = new[] { P(D(2023, 11, 1), 700m), P(D(2023, 12, 5), 650m) };

        var balances = PeriodBalances.Lookup(
            points, PeriodBalances.MortgagePeriods(D(2023, 11, 29), 12, PaymentFrequency.Monthly));

        Assert.Equal<decimal?>([650m], balances);
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

        // Period 1 [.., 1 Feb] holds the point; period 2 starts after it.
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

    // 022 shifted the repayment date rule by one interval; the 020 fallback windows must not move.
    [Fact]
    public void Monthly_fallback_windows_are_unchanged_by_the_022_repayment_date_rule()
    {
        Assert.Equal(
            [
                new BalancePeriod(D(2026, 1, 31), D(2026, 2, 27)),
                new BalancePeriod(D(2026, 2, 28), D(2026, 3, 30)),
                new BalancePeriod(D(2026, 3, 31), D(2026, 4, 29)),
                new BalancePeriod(D(2026, 4, 30), D(2026, 5, 30)),
            ],
            PeriodBalances.MonthlyPeriods(D(2026, 1, 31)).Take(4));
        Assert.Equal(
            [
                new BalancePeriod(D(2026, 1, 1), D(2026, 1, 31)),
                new BalancePeriod(D(2026, 2, 1), D(2026, 2, 28)),
            ],
            PeriodBalances.MonthlyPeriods(D(2026, 1, 1)).Take(2));
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
