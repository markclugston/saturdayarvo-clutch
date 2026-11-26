using System.Security.Claims;
using System.Text.Json;
using Clutch.API.Application.Preferences;
using Clutch.API.Domain.Preferences;

namespace Clutch.API.Api.Endpoints;

public static class LoanPayoffTimelinePreferenceEndpoints
{
    // The real body is under 100 bytes. Reading at most this many keeps an oversized body from
    // being buffered and parsed; anything larger is invalid.
    private const int MaxBodyBytes = 1024;

    // Largest integer a JavaScript number holds exactly (2^53 - 1).
    private const long MaxClientSequence = 9_007_199_254_740_991;

    public static IEndpointRouteBuilder MapLoanPayoffTimelinePreferenceEndpoints(
        this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/preferences/loan-payoff-timeline")
            .WithTags("Preferences")
            .RequireAuthorization();

        group.MapGet("", async (
            ClaimsPrincipal principal,
            LoanPayoffTimelinePreferenceService service,
            CancellationToken cancellationToken) =>
        {
            var userId = principal.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status401Unauthorized);
            }

            var view = await service.GetAsync(userId, cancellationToken);
            return Results.Ok(new LoanPayoffTimelinePreferenceResponse(view.ToString()));
        });

        // The body is read here rather than bound, so any malformed field gets the contract 400
        // and the `invalid` outcome instead of a framework binding error.
        group.MapPut("", async Task<IResult> (
            HttpRequest request,
            ClaimsPrincipal principal,
            LoanPayoffTimelinePreferenceService service,
            CancellationToken cancellationToken) =>
        {
            var started = PreferenceMetrics.Start();
            var save = await ReadSaveAsync(request, cancellationToken);
            if (save is null)
            {
                PreferenceMetrics.RecordLoanPayoffTimelineSave("invalid", started);
                return Results.Problem(
                    title: "The Amortization Schedule view is invalid.",
                    detail: "Choose Burndown or Schedule.",
                    statusCode: StatusCodes.Status400BadRequest);
            }

            var userId = principal.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status401Unauthorized);
            }

            var saved = await service.SaveAsync(
                userId,
                save.View,
                save.ClientId,
                save.ClientSequence,
                cancellationToken);
            return Results.Ok(new LoanPayoffTimelinePreferenceResponse(saved.ToString()));
        })
        .Accepts<LoanPayoffTimelinePreferenceRequest>("application/json");

        return endpoints;
    }

    /// <summary>Returns the validated save, or null when any field is missing or invalid.</summary>
    private static async Task<ValidSave?> ReadSaveAsync(
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

            // Property names match case-insensitively, as the web JSON defaults do when bound.
            JsonElement? view = null;
            JsonElement? clientId = null;
            JsonElement? clientSequence = null;
            foreach (var property in document.RootElement.EnumerateObject())
            {
                if (string.Equals(property.Name, "view", StringComparison.OrdinalIgnoreCase))
                {
                    view = property.Value;
                }
                else if (string.Equals(property.Name, "clientId", StringComparison.OrdinalIgnoreCase))
                {
                    clientId = property.Value;
                }
                else if (string.Equals(property.Name, "clientSequence", StringComparison.OrdinalIgnoreCase))
                {
                    clientSequence = property.Value;
                }
            }

            return TryParseView(view, out var parsedView)
                && TryParseClientId(clientId, out var parsedClientId)
                && TryParseClientSequence(clientSequence, out var parsedSequence)
                    ? new ValidSave(parsedView, parsedClientId, parsedSequence)
                    : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static bool TryParseView(JsonElement? element, out LoanPayoffTimelineView view)
    {
        var value = element is { ValueKind: JsonValueKind.String } text ? text.GetString() : null;
        view = value == "Schedule" ? LoanPayoffTimelineView.Schedule : LoanPayoffTimelineView.Burndown;
        return value is "Burndown" or "Schedule";
    }

    private static bool TryParseClientId(JsonElement? element, out Guid clientId)
    {
        clientId = Guid.Empty;
        return element is { ValueKind: JsonValueKind.String } text
            && Guid.TryParseExact(text.GetString(), "D", out clientId)
            && clientId != Guid.Empty;
    }

    private static bool TryParseClientSequence(JsonElement? element, out long clientSequence)
    {
        clientSequence = 0;
        return element is { ValueKind: JsonValueKind.Number } number
            && number.TryGetInt64(out clientSequence)
            && clientSequence is >= 1 and <= MaxClientSequence;
    }

    private sealed record ValidSave(LoanPayoffTimelineView View, Guid ClientId, long ClientSequence);

    private sealed record LoanPayoffTimelinePreferenceRequest(
        string? View,
        Guid? ClientId,
        long? ClientSequence);

    private sealed record LoanPayoffTimelinePreferenceResponse(string View);
}
