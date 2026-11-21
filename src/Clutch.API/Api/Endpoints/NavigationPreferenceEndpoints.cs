using System.Security.Claims;
using System.Text.Json;
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

        // The body is read here rather than bound, so a non-string, missing or malformed `state`
        // gets the contract 400 and the `invalid` outcome instead of a framework binding error.
        group.MapPut("", async Task<IResult> (
            HttpRequest request,
            ClaimsPrincipal principal,
            NavigationPreferenceService service,
            CancellationToken cancellationToken) =>
        {
            var started = PreferenceMetrics.Start();
            var requested = await ReadStateAsync(request, cancellationToken);
            if (!TryParseState(requested, out var state))
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
        })
        .Accepts<NavigationPreferenceRequest>("application/json");

        return endpoints;
    }

    // The real body is under 30 bytes. Reading at most this many keeps an oversized body from
    // being buffered and parsed; anything larger is invalid.
    private const int MaxBodyBytes = 1024;

    /// <summary>Returns the `state` string, or null when the body has no string `state`.</summary>
    private static async Task<string?> ReadStateAsync(
        HttpRequest request,
        CancellationToken cancellationToken)
    {
        if (!request.HasJsonContentType())
        {
            return null;
        }

        try
        {
            var buffer = new byte[MaxBodyBytes + 1];
            var length = 0;
            while (length < buffer.Length)
            {
                var read = await request.Body.ReadAsync(buffer.AsMemory(length), cancellationToken);
                if (read == 0)
                {
                    break;
                }

                length += read;
            }

            if (length > MaxBodyBytes)
            {
                return null;
            }

            using var document = JsonDocument.Parse(buffer.AsMemory(0, length));
            if (document.RootElement.ValueKind != JsonValueKind.Object)
            {
                return null;
            }

            // Property names match case-insensitively, as the web JSON defaults did when bound.
            string? state = null;
            foreach (var property in document.RootElement.EnumerateObject())
            {
                if (string.Equals(property.Name, "state", StringComparison.OrdinalIgnoreCase))
                {
                    state = property.Value.ValueKind == JsonValueKind.String
                        ? property.Value.GetString()
                        : null;
                }
            }

            return state;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static bool TryParseState(string? value, out NavigationState state)
    {
        state = value == "Pinned" ? NavigationState.Pinned : NavigationState.Unpinned;
        return value is "Pinned" or "Unpinned";
    }

    private sealed record NavigationPreferenceRequest(string? State);

    private sealed record NavigationPreferenceResponse(string State);
}
