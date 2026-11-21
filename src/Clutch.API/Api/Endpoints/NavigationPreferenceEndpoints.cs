using System.Security.Claims;
using Clutch.API.Application.Preferences;
using Clutch.API.Domain.Preferences;

namespace Clutch.API.Api.Endpoints;

public static class NavigationPreferenceEndpoints
{
    public static IEndpointRouteBuilder MapNavigationPreferenceEndpoints(
        this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/preferences/navigation")
            .WithTags("Preferences")
            .RequireAuthorization();

        group.MapGet("", async (
            ClaimsPrincipal principal,
            NavigationPreferenceService service,
            CancellationToken cancellationToken) =>
        {
            var userId = principal.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status401Unauthorized);
            }

            var state = await service.GetAsync(userId, cancellationToken);
            return Results.Ok(new NavigationPreferenceResponse(state.ToString()));
        });

        group.MapPut("", async Task<IResult> (
            NavigationPreferenceRequest request,
            ClaimsPrincipal principal,
            NavigationPreferenceService service,
            CancellationToken cancellationToken) =>
        {
            var started = PreferenceMetrics.Start();
            if (!TryParseState(request.State, out var state))
            {
                PreferenceMetrics.RecordNavigationSave("invalid", started);
                return Results.Problem(
                    title: "The navigation state is invalid.",
                    detail: "Choose Pinned or Unpinned.",
                    statusCode: StatusCodes.Status400BadRequest);
            }

            var userId = principal.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status401Unauthorized);
            }

            var saved = await service.SaveAsync(userId, state, cancellationToken);
            return Results.Ok(new NavigationPreferenceResponse(saved.ToString()));
        });

        return endpoints;
    }

    private static bool TryParseState(string? value, out NavigationState state)
    {
        state = value == "Pinned" ? NavigationState.Pinned : NavigationState.Unpinned;
        return value is "Pinned" or "Unpinned";
    }

    private sealed record NavigationPreferenceRequest(string? State);

    private sealed record NavigationPreferenceResponse(string State);
}
