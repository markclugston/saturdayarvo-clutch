using System.Security.Claims;
using Clutch.API.Application.Families;
using Clutch.API.Domain.Families;

namespace Clutch.API.Api.Endpoints;

public static class FamilyEndpoints
{
    public static IEndpointRouteBuilder MapFamilyEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/families")
            .WithTags("Families")
            .RequireAuthorization();

        group.MapGet("", async (
            ClaimsPrincipal principal,
            FamilyService familyService,
            CancellationToken cancellationToken) =>
        {
            var ownerUserId = principal.FindFirstValue(ClaimTypes.NameIdentifier);
            if (ownerUserId is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status401Unauthorized);
            }

            var family = await familyService.GetOwnedAsync(ownerUserId, cancellationToken);
            return Results.Ok(family is null
                ? Array.Empty<FamilyResponse>()
                : [FamilyResponse.FromDomain(family)]);
        });

        group.MapPost("", async (
            ClaimsPrincipal principal,
            FamilyService familyService,
            CancellationToken cancellationToken) =>
        {
            var ownerUserId = principal.FindFirstValue(ClaimTypes.NameIdentifier);
            if (ownerUserId is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status401Unauthorized);
            }

            var family = await familyService.CreateAsync(ownerUserId, cancellationToken);
            return Results.Created(
                $"/api/families/{family.Id}",
                FamilyResponse.FromDomain(family));
        });

        return endpoints;
    }

    private sealed record FamilyResponse(Guid Id, string OwnerUserId)
    {
        public static FamilyResponse FromDomain(Family family) =>
            new(family.Id, family.OwnerUserId);
    }
}
