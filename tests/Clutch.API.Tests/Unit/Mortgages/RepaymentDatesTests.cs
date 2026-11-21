using Clutch.API.Domain.Mortgages;

namespace Clutch.API.Tests.Unit.Mortgages;

public sealed class RepaymentDatesTests
{
    [Fact]
    public void Monthly_360_periods_from_1_Jan_2000_ends_1_Dec_2029()
    {
        var result = RepaymentDates.FinalRepaymentDate(
            new DateOnly(2000, 1, 1), 360, RepaymentFrequency.Monthly);

        Assert.Equal(new DateOnly(2029, 12, 1), result);
    }

    [Fact]
    public void Monthly_from_31_Jan_clamps_to_month_end()
    {
        var result = RepaymentDates.FinalRepaymentDate(
            new DateOnly(2001, 1, 31), 2, RepaymentFrequency.Monthly);

        Assert.Equal(new DateOnly(2001, 2, 28), result);
    }

    [Fact]
    public void Monthly_anchors_on_the_first_date_not_the_previous_clamped_date()
    {
        var result = RepaymentDates.FinalRepaymentDate(
            new DateOnly(2001, 1, 31), 3, RepaymentFrequency.Monthly);

        Assert.Equal(new DateOnly(2001, 3, 31), result);
    }

    [Fact]
    public void Weekly_adds_seven_days_per_period()
    {
        var result = RepaymentDates.FinalRepaymentDate(
            new DateOnly(2000, 1, 1), 3, RepaymentFrequency.Weekly);

        Assert.Equal(new DateOnly(2000, 1, 15), result);
    }

    [Fact]
    public void Fortnightly_adds_fourteen_days_per_period()
    {
        var result = RepaymentDates.FinalRepaymentDate(
            new DateOnly(2000, 1, 1), 3, RepaymentFrequency.Fortnightly);

        Assert.Equal(new DateOnly(2000, 1, 29), result);
    }

    [Theory]
    [InlineData(RepaymentFrequency.Weekly)]
    [InlineData(RepaymentFrequency.Fortnightly)]
    [InlineData(RepaymentFrequency.Monthly)]
    public void One_period_ends_on_the_first_date(RepaymentFrequency frequency)
    {
        var first = new DateOnly(2000, 6, 15);

        Assert.Equal(first, RepaymentDates.FinalRepaymentDate(first, 1, frequency));
    }

    [Theory]
    [InlineData(RepaymentFrequency.Weekly, 3_000_000_000L)]
    [InlineData(RepaymentFrequency.Fortnightly, 3_000_000_000L)]
    [InlineData(RepaymentFrequency.Monthly, 3_000_000_000L)]
    [InlineData(RepaymentFrequency.Monthly, long.MaxValue)]
    [InlineData(RepaymentFrequency.Weekly, long.MaxValue)]
    public void Overflow_past_31_Dec_9999_returns_null(RepaymentFrequency frequency, long periods)
    {
        Assert.Null(RepaymentDates.FinalRepaymentDate(new DateOnly(2000, 1, 1), periods, frequency));
    }

    [Fact]
    public void Monthly_ending_exactly_on_31_Dec_9999_is_accepted()
    {
        var result = RepaymentDates.FinalRepaymentDate(
            new DateOnly(9999, 12, 31), 1, RepaymentFrequency.Monthly);

        Assert.Equal(new DateOnly(9999, 12, 31), result);
    }

    [Fact]
    public void Monthly_one_period_past_December_9999_is_null()
    {
        Assert.Null(RepaymentDates.FinalRepaymentDate(
            new DateOnly(9999, 12, 1), 2, RepaymentFrequency.Monthly));
    }

    [Fact]
    public void Smallest_date_with_one_monthly_period()
    {
        var result = RepaymentDates.FinalRepaymentDate(
            new DateOnly(1, 1, 1), 1, RepaymentFrequency.Monthly);

        Assert.Equal(new DateOnly(1, 1, 1), result);
    }

    [Fact]
    public void Leap_day_plus_twelve_months_clamps_to_28_Feb()
    {
        var result = RepaymentDates.FinalRepaymentDate(
            new DateOnly(4, 2, 29), 13, RepaymentFrequency.Monthly);

        Assert.Equal(new DateOnly(5, 2, 28), result);
    }

    [Fact]
    public void Weekly_in_year_50_adds_seven_days()
    {
        var result = RepaymentDates.FinalRepaymentDate(
            new DateOnly(50, 1, 1), 2, RepaymentFrequency.Weekly);

        Assert.Equal(new DateOnly(50, 1, 8), result);
    }

    [Fact]
    public void Weekly_reaching_exactly_31_Dec_9999_is_accepted()
    {
        var first = new DateOnly(9999, 12, 31).AddDays(-14);

        Assert.Equal(
            new DateOnly(9999, 12, 31),
            RepaymentDates.FinalRepaymentDate(first, 3, RepaymentFrequency.Weekly));
        Assert.Null(RepaymentDates.FinalRepaymentDate(first, 4, RepaymentFrequency.Weekly));
    }
}
