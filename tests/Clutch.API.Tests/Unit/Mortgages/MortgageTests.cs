using Clutch.API.Domain.Mortgages;

namespace Clutch.API.Tests.Unit.Mortgages;

public sealed class MortgageTests
{
    private static readonly DateOnly First = new(2000, 1, 1);
    private static readonly DateTimeOffset Now = new(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);

    [Fact]
    public void Create_trims_the_name_and_starts_at_version_1()
    {
        var mortgage = Create("  Home loan  ");

        Assert.Equal("Home loan", mortgage.Name);
        Assert.Equal(1, mortgage.Version);
        Assert.Equal("owner", mortgage.OwnerUserId);
        Assert.Equal(Now, mortgage.CreatedAtUtc);
        Assert.NotEqual(Guid.Empty, mortgage.Id);
    }

    [Fact]
    public void Update_increments_the_version_each_time()
    {
        var mortgage = Create("Home loan");

        mortgage.Update(" Renamed ", 200m, 24, First, PaymentFrequency.Weekly, Changes((5m, First)), null);
        mortgage.Update("Renamed", 200m, 24, First, PaymentFrequency.Weekly, Changes((5m, First)), null);

        Assert.Equal(3, mortgage.Version);
        Assert.Equal("Renamed", mortgage.Name);
        Assert.Equal(200m, mortgage.OpeningBalance);
        Assert.Equal(24, mortgage.Duration);
        Assert.Equal(PaymentFrequency.Weekly, mortgage.PaymentFrequency);
    }

    [Fact]
    public void Update_replaces_the_rate_change_set()
    {
        var mortgage = Create("Home loan");
        var original = mortgage.InterestRateChanges.Select(change => change.Id).ToList();

        mortgage.Update(
            "Home loan", 100m, 12, First, PaymentFrequency.Monthly,
            Changes((6m, First), (7m, First.AddMonths(3))), null);

        Assert.Equal(2, mortgage.InterestRateChanges.Count);
        Assert.DoesNotContain(mortgage.InterestRateChanges, change => original.Contains(change.Id));
        Assert.All(mortgage.InterestRateChanges, change => Assert.Equal(mortgage.Id, change.MortgageId));
    }

    [Fact]
    public void Rate_changes_are_ordered_by_effective_date()
    {
        var mortgage = Create(
            "Home loan",
            Changes((7m, First.AddMonths(6)), (5m, First), (6m, First.AddMonths(3))));

        Assert.Equal(
            [First, First.AddMonths(3), First.AddMonths(6)],
            mortgage.InterestRateChanges.Select(change => change.EffectiveDate));
        Assert.Equal(
            [5m, 6m, 7m],
            mortgage.InterestRateChanges.Select(change => change.NewInterestRate));
    }

    [Fact]
    public void Create_keeps_the_linked_account_or_none()
    {
        var accountId = Guid.NewGuid();

        Assert.Equal(accountId, Create("Linked", accountId: accountId).AccountId);
        Assert.Null(Create("Unlinked").AccountId);
    }

    [Fact]
    public void Update_sets_and_clears_the_account_and_still_bumps_the_version()
    {
        var mortgage = Create("Home loan");
        var accountId = Guid.NewGuid();

        mortgage.Update("Home loan", 100m, 12, First, PaymentFrequency.Monthly, Changes((5m, First)), accountId);
        Assert.Equal(accountId, mortgage.AccountId);
        Assert.Equal(2, mortgage.Version);

        mortgage.Update("Home loan", 100m, 12, First, PaymentFrequency.Monthly, Changes((5m, First)), null);
        Assert.Null(mortgage.AccountId);
        Assert.Equal(3, mortgage.Version);
    }

    private static Mortgage Create(
        string name,
        IReadOnlyList<RateChangeValue>? changes = null,
        Guid? accountId = null) =>
        Mortgage.Create(
            "owner", name, 100m, 12, First, PaymentFrequency.Monthly,
            changes ?? Changes((5m, First)), accountId, Now);

    private static List<RateChangeValue> Changes(params (decimal Rate, DateOnly Date)[] values) =>
        values.Select(value => new RateChangeValue(value.Rate, value.Date)).ToList();
}
