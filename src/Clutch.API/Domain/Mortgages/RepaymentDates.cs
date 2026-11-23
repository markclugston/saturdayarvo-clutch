namespace Clutch.API.Domain.Mortgages;

public static class RepaymentDates
{
    // Date of repayment `periods` (the last of `periods` repayments): the disbursal date plus `periods` payment
    // intervals, so repayment 1 is one interval after disbursal. Null when it would be later than 31 Dec 9999
    // or `periods` is below 1. Monthly dates are anchored on the disbursal day and clamp to the end of the month.
    public static DateOnly? FinalRepaymentDate(
        DateOnly disbursalDate,
        long periods,
        PaymentFrequency frequency)
    {
        if (periods < 1)
        {
            return null;
        }

        var steps = periods;
        if (frequency == PaymentFrequency.Monthly)
        {
            var maxMonthIndex = (DateOnly.MaxValue.Year * 12L) + (DateOnly.MaxValue.Month - 1);
            var firstMonthIndex = (disbursalDate.Year * 12L) + (disbursalDate.Month - 1);
            if (steps > maxMonthIndex - firstMonthIndex)
            {
                return null;
            }

            var monthIndex = firstMonthIndex + steps;
            var year = (int)(monthIndex / 12);
            var month = (int)(monthIndex % 12) + 1;
            var day = Math.Min(disbursalDate.Day, DateTime.DaysInMonth(year, month));
            return new DateOnly(year, month, day);
        }

        var daysPerPeriod = frequency == PaymentFrequency.Weekly ? 7L : 14L;
        var availableDays = DateOnly.MaxValue.DayNumber - (long)disbursalDate.DayNumber;
        if (steps > availableDays / daysPerPeriod)
        {
            return null;
        }

        return DateOnly.FromDayNumber((int)(disbursalDate.DayNumber + (steps * daysPerPeriod)));
    }
}
