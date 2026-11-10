namespace Clutch.API.Domain.Categories;

// A node without a parent is a group; a node with a parent is a category.
public sealed class CategoryNode
{
    private CategoryNode()
    {
    }

    private CategoryNode(string ownerUserId, Guid? parentId, string name, int position)
    {
        Id = Guid.NewGuid();
        OwnerUserId = ownerUserId;
        ParentId = parentId;
        Name = name.Trim();
        Position = position;
    }

    public Guid Id { get; private set; }

    public string OwnerUserId { get; private set; } = string.Empty;

    public Guid? ParentId { get; private set; }

    public string Name { get; private set; } = string.Empty;

    public int Position { get; private set; }

    public bool IsGroup => ParentId is null;

    public static bool TryCreate(
        string? ownerUserId,
        Guid? parentId,
        string? name,
        int position,
        out CategoryNode? node)
    {
        if (string.IsNullOrWhiteSpace(ownerUserId)
            || parentId == Guid.Empty
            || position < 0
            || !CategoryNameValidator.IsValid(name))
        {
            node = null;
            return false;
        }

        node = new CategoryNode(ownerUserId, parentId, name!, position);
        return true;
    }

    public bool TryRename(string? name)
    {
        if (!CategoryNameValidator.IsValid(name))
        {
            return false;
        }

        Name = name!.Trim();
        return true;
    }
}
