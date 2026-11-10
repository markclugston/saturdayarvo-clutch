using Clutch.API.Api.ProblemDetails;
using Clutch.API.Domain.Categories;
using Clutch.API.Infrastructure.Persistence;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace Clutch.API.Application.Categories;

public sealed record CategoryNodeItem(CategoryNode Node, int Depth);

public sealed class CategoryNodeService(AppDbContext dbContext)
{
    public async Task<IReadOnlyList<CategoryNodeItem>> GetTreeAsync(
        string ownerUserId,
        CancellationToken cancellationToken)
    {
        var nodes = await OwnedNodes(ownerUserId)
            .AsNoTracking()
            .ToListAsync(cancellationToken);
        return Flatten(nodes);
    }

    public async Task<CategoryNodeItem> CreateAsync(
        string ownerUserId,
        Guid? parentId,
        string? name,
        CancellationToken cancellationToken)
    {
        if (!CategoryNameValidator.IsValid(name))
        {
            throw InvalidName();
        }

        var trimmed = name!.Trim();

        // A concurrent create can claim the same position; retry a few times, re-checking names each time.
        for (var attempt = 0; ; attempt++)
        {
            var nodes = await OwnedNodes(ownerUserId)
                .AsNoTracking()
                .ToListAsync(cancellationToken);

            var depth = 0;
            if (parentId is { } parent)
            {
                var parentNode = nodes.SingleOrDefault(node => node.Id == parent)
                    ?? throw ParentNotFound();
                depth = Depth(nodes, parentNode) + 1;
            }

            var siblings = nodes.Where(node => node.ParentId == parentId).ToList();
            if (siblings.Any(sibling => NamesMatch(sibling.Name, trimmed)))
            {
                throw DuplicateName();
            }

            var position = siblings.Count == 0 ? 0 : siblings.Max(sibling => sibling.Position) + 1;
            if (!CategoryNode.TryCreate(ownerUserId, parentId, trimmed, position, out var created)
                || created is null)
            {
                throw InvalidName();
            }

            dbContext.CategoryNodes.Add(created);
            try
            {
                await dbContext.SaveChangesAsync(cancellationToken);
                return new CategoryNodeItem(created, depth);
            }
            catch (DbUpdateException exception) when (IsUniqueViolation(exception) && attempt < 3)
            {
                dbContext.Entry(created).State = EntityState.Detached;
            }
            catch (DbUpdateException exception) when (IsUniqueViolation(exception))
            {
                dbContext.Entry(created).State = EntityState.Detached;
                throw DuplicateName();
            }
        }
    }

    public async Task<CategoryNodeItem> RenameAsync(
        string ownerUserId,
        Guid nodeId,
        string? name,
        CancellationToken cancellationToken)
    {
        var nodes = await OwnedNodes(ownerUserId).ToListAsync(cancellationToken);
        var target = nodes.SingleOrDefault(node => node.Id == nodeId) ?? throw NodeNotFound();
        if (!CategoryNameValidator.IsValid(name))
        {
            throw InvalidName();
        }

        var trimmed = name!.Trim();
        if (nodes.Any(node => node.Id != nodeId
                && node.ParentId == target.ParentId
                && NamesMatch(node.Name, trimmed)))
        {
            throw DuplicateName();
        }

        target.TryRename(trimmed);
        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (IsUniqueViolation(exception))
        {
            throw DuplicateName();
        }

        return new CategoryNodeItem(target, Depth(nodes, target));
    }

    public async Task<int> GetDeletionImpactAsync(
        string ownerUserId,
        Guid nodeId,
        CancellationToken cancellationToken)
    {
        var nodes = await OwnedNodes(ownerUserId)
            .AsNoTracking()
            .ToListAsync(cancellationToken);
        return CollectSubtree(nodes, nodeId).Count;
    }

    public async Task DeleteAsync(
        string ownerUserId,
        Guid nodeId,
        CancellationToken cancellationToken)
    {
        var nodes = await OwnedNodes(ownerUserId).ToListAsync(cancellationToken);
        var subtree = CollectSubtree(nodes, nodeId);
        dbContext.CategoryNodes.RemoveRange(subtree);
        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            // Another request already removed some of these rows; the outcome is the same.
        }
        catch (DbUpdateException)
        {
            // A child was added to the subtree after it was loaded.
            throw new ApiProblemException(
                StatusCodes.Status409Conflict,
                "The item changed.",
                "The item was changed by another request. Refresh and try again.");
        }
    }

    private static bool IsUniqueViolation(DbUpdateException exception) =>
        exception.InnerException is SqlException { Number: 2601 or 2627 };

    private IQueryable<CategoryNode> OwnedNodes(string ownerUserId) =>
        dbContext.CategoryNodes.Where(node => node.OwnerUserId == ownerUserId);

    private static int Depth(IReadOnlyList<CategoryNode> nodes, CategoryNode node)
    {
        var byId = nodes.ToDictionary(item => item.Id);
        var depth = 0;
        var current = node;
        while (current.ParentId is { } parentId && byId.TryGetValue(parentId, out var parent))
        {
            depth++;
            current = parent;
        }

        return depth;
    }

    private static List<CategoryNodeItem> Flatten(IReadOnlyList<CategoryNode> nodes)
    {
        var childrenByParent = nodes
            .Where(node => node.ParentId is not null)
            .GroupBy(node => node.ParentId!.Value)
            .ToDictionary(
                group => group.Key,
                group => group.OrderBy(node => node.Position).ToList());
        var groups = nodes
            .Where(node => node.ParentId is null)
            .OrderBy(node => node.Position)
            .ToList();
        var result = new List<CategoryNodeItem>(nodes.Count);

        var stack = new Stack<(CategoryNode Node, int Depth)>();
        for (var index = groups.Count - 1; index >= 0; index--)
        {
            stack.Push((groups[index], 0));
        }

        while (stack.Count > 0)
        {
            var (node, depth) = stack.Pop();
            result.Add(new CategoryNodeItem(node, depth));
            if (!childrenByParent.TryGetValue(node.Id, out var children))
            {
                continue;
            }

            for (var index = children.Count - 1; index >= 0; index--)
            {
                stack.Push((children[index], depth + 1));
            }
        }

        return result;
    }

    private static List<CategoryNode> CollectSubtree(IReadOnlyList<CategoryNode> nodes, Guid nodeId)
    {
        var root = nodes.SingleOrDefault(node => node.Id == nodeId) ?? throw NodeNotFound();
        var childrenByParent = nodes
            .Where(node => node.ParentId is not null)
            .ToLookup(node => node.ParentId!.Value);
        var subtree = new List<CategoryNode> { root };
        for (var index = 0; index < subtree.Count; index++)
        {
            subtree.AddRange(childrenByParent[subtree[index].Id]);
        }

        return subtree;
    }

    private static bool NamesMatch(string left, string right) =>
        string.Equals(left, right, StringComparison.OrdinalIgnoreCase);

    private static ApiProblemException InvalidName() =>
        new(
            StatusCodes.Status400BadRequest,
            "The name is invalid.",
            "Enter a name of 1 to 100 characters.",
            new Dictionary<string, string[]>
            {
                ["name"] = [$"Enter a name of 1 to {CategoryNameValidator.MaximumLength} characters."],
            });

    private static ApiProblemException DuplicateName() =>
        new(
            StatusCodes.Status409Conflict,
            "The name is already in use.",
            "Another item in the same place already has this name.",
            new Dictionary<string, string[]>
            {
                ["name"] = ["Another item in the same place already has this name."],
            });

    private static ApiProblemException ParentNotFound() =>
        new(
            StatusCodes.Status404NotFound,
            "Parent not found.",
            "The parent does not exist or is not available to this user.");

    private static ApiProblemException NodeNotFound() =>
        new(
            StatusCodes.Status404NotFound,
            "Item not found.",
            "The item does not exist or is not available to this user.");
}
