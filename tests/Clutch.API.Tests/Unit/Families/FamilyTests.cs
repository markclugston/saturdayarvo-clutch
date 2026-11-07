using Clutch.API.Domain.Families;

namespace Clutch.API.Tests.Unit.Families;

public sealed class FamilyTests
{
    [Fact]
    public void Family_is_created_with_a_non_removable_owner()
    {
        var family = new Family("owner-id");

        Assert.NotEqual(Guid.Empty, family.Id);
        Assert.Equal("owner-id", family.OwnerUserId);
    }

    [Fact]
    public void Families_for_different_owners_have_distinct_identifiers()
    {
        var first = new Family("first-owner");
        var second = new Family("second-owner");

        Assert.NotEqual(first.Id, second.Id);
    }
}
