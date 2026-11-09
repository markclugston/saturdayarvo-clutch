using System.Security.Claims;
using Clutch.API.Application.Preferences;
using Clutch.API.Domain.Preferences;

namespace Clutch.API.Api.Endpoints;

public static class ThemePreferenceEndpoints
{
    public static IEndpointRouteBuilder MapThemePreferenceEndpoints(
        this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/preferences/theme")
            .WithTags("Preferences")
            .RequireAuthorization();

        group.MapGet("", async (
            ClaimsPrincipal principal,
            ThemePreferenceService service,
            CancellationToken cancellationToken) =>
        {
            var userId = principal.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status401Unauthorized);
            }

            var mode = await service.GetAsync(userId, cancellationToken);
            return Results.Ok(new ThemePreferenceResponse(mode.ToString()));
        });

        group.MapPut("", async Task<IResult> (
            ThemePreferenceRequest request,
            ClaimsPrincipal principal,
            ThemePreferenceService service,
            CancellationToken cancellationToken) =>
        {
            if (!TryParseMode(request.Mode, out var mode))
            {
                return Results.Problem(
                    title: "The theme mode is invalid.",
                    detail: "Choose Light, Dark, or System.",
                    statusCode: StatusCodes.Status400BadRequest);
            }

            var userId = principal.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status401Unauthorized);
            }

            var savedMode = await service.SaveAsync(userId, mode, cancellationToken);
            return Results.Ok(new ThemePreferenceResponse(savedMode.ToString()));
        });

        return endpoints;
    }

    private static bool TryParseMode(string? value, out ThemeMode mode)
    {
        mode = value switch
        {
            "Light" => ThemeMode.Light,
            "Dark" => ThemeMode.Dark,
            "System" => ThemeMode.System,
            _ => ThemeMode.Light,
        };
        return value is "Light" or "Dark" or "System";
    }

    private sealed record ThemePreferenceRequest(string? Mode);

    private sealed record ThemePreferenceResponse(string Mode);
}
