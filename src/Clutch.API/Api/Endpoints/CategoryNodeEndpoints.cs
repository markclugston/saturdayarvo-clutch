using System.Security.Claims;
using Clutch.API.Application.Categories;

namespace Clutch.API.Api.Endpoints;

public static class CategoryNodeEndpoints
{
    public static IEndpointRouteBuilder MapCategoryNodeEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/category-nodes")
            .WithTags("Categories")
            .RequireAuthorization();

        group.MapGet("", async (
            ClaimsPrincipal principal,
            CategoryNodeService service,
            CancellationToken cancellationToken) =>
        {
            if (principal.FindFirstValue(ClaimTypes.NameIdentifier) is not { } ownerUserId)
            {
                return Results.Problem(statusCode: StatusCodes.Status401Unauthorized);
            }

            var items = await service.GetTreeAsync(ownerUserId, cancellationToken);
            return Results.Ok(items.Select(CategoryNodeResponse.FromItem));
        });

        group.MapPost("", async (
            CreateCategoryNodeRequest request,
            ClaimsPrincipal principal,
            CategoryNodeService service,
            CancellationToken cancellationToken) =>
        {
            if (principal.FindFirstValue(ClaimTypes.NameIdentifier) is not { } ownerUserId)
            {
                return Results.Problem(statusCode: StatusCodes.Status401Unauthorized);
            }

            var item = await service.CreateAsync(
                ownerUserId,
                request.ParentId,
                request.Name,
                cancellationToken);
            return Results.Created(
                $"/api/category-nodes/{item.Node.Id}",
                CategoryNodeResponse.FromItem(item));
        });

        group.MapPatch("/{id:guid}", async (
            Guid id,
            RenameCategoryNodeRequest request,
            ClaimsPrincipal principal,
            CategoryNodeService service,
            CancellationToken cancellationToken) =>
        {
            if (principal.FindFirstValue(ClaimTypes.NameIdentifier) is not { } ownerUserId)
            {
                return Results.Problem(statusCode: StatusCodes.Status401Unauthorized);
            }

            var item = await service.RenameAsync(ownerUserId, id, request.Name, cancellationToken);
            return Results.Ok(CategoryNodeResponse.FromItem(item));
        });

        group.MapGet("/{id:guid}/deletion-impact", async (
            Guid id,
            ClaimsPrincipal principal,
            CategoryNodeService service,
            CancellationToken cancellationToken) =>
        {
            if (principal.FindFirstValue(ClaimTypes.NameIdentifier) is not { } ownerUserId)
            {
                return Results.Problem(statusCode: StatusCodes.Status401Unauthorized);
            }

            var count = await service.GetDeletionImpactAsync(ownerUserId, id, cancellationToken);
            return Results.Ok(new DeletionImpactResponse(count));
        });

        group.MapDelete("/{id:guid}", async (
            Guid id,
            ClaimsPrincipal principal,
            CategoryNodeService service,
            CancellationToken cancellationToken) =>
        {
            if (principal.FindFirstValue(ClaimTypes.NameIdentifier) is not { } ownerUserId)
            {
                return Results.Problem(statusCode: StatusCodes.Status401Unauthorized);
            }

            await service.DeleteAsync(ownerUserId, id, cancellationToken);
            return Results.NoContent();
        });

        return endpoints;
    }

    private sealed record CreateCategoryNodeRequest(string? Name, Guid? ParentId);

    private sealed record RenameCategoryNodeRequest(string? Name);

    private sealed record DeletionImpactResponse(int ItemCount);

    private sealed record CategoryNodeResponse(Guid Id, Guid? ParentId, string Name, int Depth)
    {
        public static CategoryNodeResponse FromItem(CategoryNodeItem item) =>
            new(item.Node.Id, item.Node.ParentId, item.Node.Name, item.Depth);
    }
}
