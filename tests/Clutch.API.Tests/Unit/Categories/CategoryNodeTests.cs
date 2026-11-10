using Clutch.API.Domain.Categories;

namespace Clutch.API.Tests.Unit.Categories;

public sealed class CategoryNodeTests
{
    [Fact]
    public void Creates_group_and_category_with_trimmed_names()
    {
        Assert.True(CategoryNode.TryCreate("user", null, "  Food ", 1, out var group));
        Assert.Equal("Food", group!.Name);
        Assert.True(group.IsGroup);

        Assert.True(CategoryNode.TryCreate("user", group.Id, "Groceries", 1, out var category));
        Assert.False(category!.IsGroup);
        Assert.Equal(group.Id, category.ParentId);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Rejects_blank_names(string? name)
    {
        Assert.False(CategoryNode.TryCreate("user", null, name, 1, out var node));
        Assert.Null(node);
    }

    [Fact]
    public void Enforces_the_100_character_limit_after_trimming()
    {
        Assert.True(CategoryNode.TryCreate("user", null, $" {new string('a', 100)} ", 1, out _));
        Assert.False(CategoryNode.TryCreate("user", null, new string('a', 101), 1, out _));
    }

    [Fact]
    public void Rename_validates_and_keeps_position()
    {
        Assert.True(CategoryNode.TryCreate("user", null, "Food", 3, out var node));
        Assert.False(node!.TryRename(" "));
        Assert.Equal("Food", node.Name);
        Assert.True(node.TryRename(" Meals "));
        Assert.Equal("Meals", node.Name);
        Assert.Equal(3, node.Position);
    }
}
