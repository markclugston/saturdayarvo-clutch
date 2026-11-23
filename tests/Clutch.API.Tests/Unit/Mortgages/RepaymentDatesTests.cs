using Clutch.API.Domain.Mortgages;

namespace Clutch.API.Tests.Unit.Mortgages;

// Payment N is the disbursal date plus N intervals (022 FR-007). Shared vectors with repaymentDates.test.ts.
public sealed class RepaymentDatesTests
{
    [Fact]
    public void Monthly_one_period_is_one_month_after_disbursal()
    {
        var result = RepaymentDates.FinalRepaymentDate(
            new DateOnly(2023, 11, 29), 1, PaymentFrequency.Monthly);

        Assert.Equal(new DateOnly(2023, 12, 29), result);
    }

    [Fact]
    public void Monthly_360_periods_from_29_Nov_2023_ends_29_Nov_2053()
    {
        var result = RepaymentDates.FinalRepaymentDate(
            new DateOnly(2023, 11, 29), 360, PaymentFrequency.Monthly);

        Assert.Equal(new DateOnly(2053, 11, 29), result);
    }

    [Fact]
    public void Monthly_360_periods_from_1_Jan_2000_ends_1_Jan_2030()
    {
        var result = RepaymentDates.FinalRepaymentDate(
            new DateOnly(2000, 1, 1), 360, PaymentFrequency.Monthly);

        Assert.Equal(new DateOnly(2030, 1, 1), result);
    }

    [Theory]
    [InlineData(1, 2024, 2, 29)]
    [InlineData(2, 2024, 3, 31)]
    [InlineData(3, 2024, 4, 30)]
    public void Monthly_from_31_Jan_anchors_on_the_disbursal_day_and_clamps_to_month_end(
        long periods,
        int year,
        int month,
        int day)
    {
        var result = RepaymentDates.FinalRepaymentDate(
            new DateOnly(2024, 1, 31), periods, PaymentFrequency.Monthly);

        Assert.Equal(new DateOnly(year, month, day), result);
    }

    [Fact]
    public void Weekly_adds_seven_days_per_period()
    {
        var result = RepaymentDates.FinalRepaymentDate(
            new DateOnly(2000, 1, 1), 3, PaymentFrequency.Weekly);

        Assert.Equal(new DateOnly(2000, 1, 22), result);
    }

    [Fact]
    public void Fortnightly_adds_fourteen_days_per_period()
    {
        var result = RepaymentDates.FinalRepaymentDate(
            new DateOnly(2000, 1, 1), 3, PaymentFrequency.Fortnightly);

        Assert.Equal(new DateOnly(2000, 2, 12), result);
    }

    [Theory]
    [InlineData(PaymentFrequency.Weekly)]
    [InlineData(PaymentFrequency.Fortnightly)]
    [InlineData(PaymentFrequency.Monthly)]
    public void Zero_periods_is_null(PaymentFrequency frequency)
    {
        Assert.Null(RepaymentDates.FinalRepaymentDate(new DateOnly(2000, 6, 15), 0, frequency));
    }

    [Theory]
    [InlineData(PaymentFrequency.Weekly, 3_000_000_000L)]
    [InlineData(PaymentFrequency.Fortnightly, 3_000_000_000L)]
    [InlineData(PaymentFrequency.Monthly, 3_000_000_000L)]
    [InlineData(PaymentFrequency.Monthly, long.MaxValue)]
    [InlineData(PaymentFrequency.Weekly, long.MaxValue)]
    public void Overflow_past_31_Dec_9999_returns_null(PaymentFrequency frequency, long periods)
    {
        Assert.Null(RepaymentDates.FinalRepaymentDate(new DateOnly(2000, 1, 1), periods, frequency));
    }

    [Fact]
    public void Monthly_ending_exactly_on_31_Dec_9999_is_accepted()
    {
        var result = RepaymentDates.FinalRepaymentDate(
            new DateOnly(9999, 10, 31), 2, PaymentFrequency.Monthly);

        Assert.Equal(new DateOnly(9999, 12, 31), result);
        Assert.Null(RepaymentDates.FinalRepaymentDate(new DateOnly(9999, 10, 31), 3, PaymentFrequency.Monthly));
    }

    [Fact]
    public void Monthly_one_period_past_December_9999_is_null()
    {
        Assert.Null(RepaymentDates.FinalRepaymentDate(
            new DateOnly(9999, 12, 1), 1, PaymentFrequency.Monthly));
    }

    [Fact]
    public void Smallest_date_with_one_monthly_period()
    {
        var result = RepaymentDates.FinalRepaymentDate(
            new DateOnly(1, 1, 1), 1, PaymentFrequency.Monthly);

        Assert.Equal(new DateOnly(1, 2, 1), result);
    }

    [Fact]
    public void Leap_day_plus_twelve_months_clamps_to_28_Feb()
    {
        var result = RepaymentDates.FinalRepaymentDate(
            new DateOnly(4, 2, 29), 12, PaymentFrequency.Monthly);

        Assert.Equal(new DateOnly(5, 2, 28), result);
    }

    [Fact]
    public void Weekly_in_year_50_adds_seven_days()
    {
        var result = RepaymentDates.FinalRepaymentDate(
            new DateOnly(50, 1, 1), 1, PaymentFrequency.Weekly);

        Assert.Equal(new DateOnly(50, 1, 8), result);
    }

    [Fact]
    public void Weekly_reaching_exactly_31_Dec_9999_is_accepted()
    {
        Assert.Equal(
            new DateOnly(9999, 12, 31),
            RepaymentDates.FinalRepaymentDate(new DateOnly(9999, 12, 10), 3, PaymentFrequency.Weekly));
        Assert.Null(RepaymentDates.FinalRepaymentDate(new DateOnly(9999, 12, 10), 4, PaymentFrequency.Weekly));
        Assert.Null(RepaymentDates.FinalRepaymentDate(new DateOnly(9999, 12, 17), 3, PaymentFrequency.Weekly));
    }
}
