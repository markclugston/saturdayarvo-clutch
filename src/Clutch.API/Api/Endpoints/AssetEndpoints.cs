using System.Globalization;
using System.Security.Claims;
using System.Text.Json;
using Clutch.API.Application.Assets;
using Clutch.API.Domain.Assets;

namespace Clutch.API.Api.Endpoints;

public static class AssetEndpoints
{
    public const int MaximumRequestBytes = 64 * 1024;

    public static IEndpointRouteBuilder MapAssetEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/assets")
            .WithTags("Assets")
            .RequireAuthorization()
            .WithMetadata(new Microsoft.AspNetCore.Mvc.RequestSizeLimitAttribute(MaximumRequestBytes));

        group.MapGet("", async (
            ClaimsPrincipal principal,
            AssetService service,
            CancellationToken cancellationToken) =>
        {
            if (principal.FindFirstValue(ClaimTypes.NameIdentifier) is not { } ownerUserId)
            {
                return Results.Problem(statusCode: StatusCodes.Status401Unauthorized);
            }

            return Results.Ok(await service.ListAsync(ownerUserId, cancellationToken));
        });

        group.MapPost("", async (
            AssetRequest request,
            ClaimsPrincipal principal,
            AssetService service,
            CancellationToken cancellationToken) =>
        {
            if (principal.FindFirstValue(ClaimTypes.NameIdentifier) is not { } ownerUserId)
            {
                return Results.Problem(statusCode: StatusCodes.Status401Unauthorized);
            }

            var asset = await service.CreateAsync(ownerUserId, request.ToCandidate(), cancellationToken);
            return Results.Created($"/api/assets/{asset.Id}", asset);
        });

        group.MapPut("/{id:guid}", async (
            Guid id,
            AssetRequest request,
            ClaimsPrincipal principal,
            AssetService service,
            CancellationToken cancellationToken) =>
        {
            if (principal.FindFirstValue(ClaimTypes.NameIdentifier) is not { } ownerUserId)
            {
                return Results.Problem(statusCode: StatusCodes.Status401Unauthorized);
            }

            var asset = await service.SaveAsync(
                ownerUserId,
                id,
                ParseId(request.EditId),
                request.ToCandidate(),
                cancellationToken);
            return Results.Ok(asset);
        });

        group.MapDelete("/{id:guid}", async (
            Guid id,
            ClaimsPrincipal principal,
            AssetService service,
            CancellationToken cancellationToken) =>
        {
            if (principal.FindFirstValue(ClaimTypes.NameIdentifier) is not { } ownerUserId)
            {
                return Results.Problem(statusCode: StatusCodes.Status401Unauthorized);
            }

            await service.DeleteAsync(ownerUserId, id, cancellationToken);
            return Results.NoContent();
        });

        group.MapPost("/{id:guid}/edits", async (
            Guid id,
            ClaimsPrincipal principal,
            AssetEditService service,
            CancellationToken cancellationToken) =>
        {
            if (principal.FindFirstValue(ClaimTypes.NameIdentifier) is not { } ownerUserId)
            {
                return Results.Problem(statusCode: StatusCodes.Status401Unauthorized);
            }

            var result = await service.AcquireAsync(ownerUserId, id, cancellationToken);
            if (result.Lease is { } lease)
            {
                return Results.Created($"/api/assets/{id}/edits/{lease.EditId}", lease);
            }

            // The blocking edit travels with the problem, so the page can offer to end it.
            return Results.Problem(
                title: "This asset is being edited in another session.",
                statusCode: StatusCodes.Status409Conflict,
                extensions: new Dictionary<string, object?>
                {
                    ["errors"] = new Dictionary<string, string[]> { ["code"] = ["AssetEditActive"] },
                    ["editStatus"] = result.Blocked,
                });
        });

        group.MapGet("/{id:guid}/edit-status", async (
            Guid id,
            string? editId,
            ClaimsPrincipal principal,
            HttpContext context,
            AssetEditService service,
            CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            if (principal.FindFirstValue(ClaimTypes.NameIdentifier) is not { } ownerUserId)
            {
                return Results.Problem(statusCode: StatusCodes.Status401Unauthorized);
            }

            var watched = ParseId(editId);
            if (editId is not null && watched is null)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["editId"] = ["Provide a valid edit id"],
                });
            }

            return Results.Ok(await service.GetStatusAsync(ownerUserId, id, watched, cancellationToken));
        });

        group.MapDelete("/{id:guid}/edits/{editId:guid}", async (
            Guid id,
            Guid editId,
            ClaimsPrincipal principal,
            AssetEditService service,
            CancellationToken cancellationToken) =>
        {
            if (principal.FindFirstValue(ClaimTypes.NameIdentifier) is not { } ownerUserId)
            {
                return Results.Problem(statusCode: StatusCodes.Status401Unauthorized);
            }

            await service.ReleaseAsync(ownerUserId, id, editId, cancellationToken);
            return Results.NoContent();
        });

        group.MapDelete("/{id:guid}/active-edit", async (
            Guid id,
            string? editId,
            ClaimsPrincipal principal,
            AssetEditService service,
            CancellationToken cancellationToken) =>
        {
            if (principal.FindFirstValue(ClaimTypes.NameIdentifier) is not { } ownerUserId)
            {
                return Results.Problem(statusCode: StatusCodes.Status401Unauthorized);
            }

            var target = ParseId(editId) ?? throw AssetProblems.TargetRequired();
            await service.EndAsync(ownerUserId, id, target, cancellationToken);
            return Results.NoContent();
        });

        return endpoints;
    }

    private static Guid? ParseId(string? value) =>
        Guid.TryParse(value, out var id) && id != Guid.Empty ? id : null;

    // Values arrive as raw JSON and ids and dates as text, so a badly shaped one becomes a field
    // error from the validator rather than a generic JSON error.
    private sealed record AssetRequest(
        string? Name,
        string? Description,
        string? CurrencyCode,
        List<ValuationRequest?>? Valuations,
        string? EditId)
    {
        public AssetCandidate ToCandidate() =>
            new(
                Name,
                Description,
                CurrencyCode,
                (Valuations ?? [])
                    .Select(item => item is null
                        ? new ValuationCandidate(null, null, null)
                        : new ValuationCandidate(item.Id, ToDecimal(item.Value), item.ValuationDate))
                    .ToList());
    }

    private sealed record ValuationRequest(string? Id, JsonElement? Value, string? ValuationDate);

    private static decimal? ToDecimal(JsonElement? element)
    {
        if (element is not { ValueKind: JsonValueKind.Number } number)
        {
            return null;
        }

        if (number.TryGetDecimal(out var value))
        {
            return value;
        }

        // Too large (or too small) for decimal: keep the sign so it fails the matching bound.
        return double.TryParse(
            number.GetRawText(),
            NumberStyles.Float,
            CultureInfo.InvariantCulture,
            out var approximate) && Math.Abs(approximate) < 1
            ? 0m
            : number.GetRawText().StartsWith('-') ? decimal.MinValue : decimal.MaxValue;
    }
}
