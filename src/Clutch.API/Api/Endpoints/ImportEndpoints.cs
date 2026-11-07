using System.Security.Claims;
using System.Text.Json;
using Clutch.API.Api.ProblemDetails;
using Clutch.API.Application.Imports;

namespace Clutch.API.Api.Endpoints;

public static class ImportEndpoints
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public static IEndpointRouteBuilder MapImportEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet(
            "/api/accounts/{accountId:guid}/import-settings",
            async (
                Guid accountId,
                ClaimsPrincipal principal,
                AccountImportSettingsService accountImportSettingsService,
                CancellationToken cancellationToken) =>
            {
                var ownerUserId = principal.FindFirstValue(ClaimTypes.NameIdentifier);
                if (ownerUserId is null)
                {
                    return Results.Problem(statusCode: StatusCodes.Status401Unauthorized);
                }

                var settings = await accountImportSettingsService.GetAsync(
                    ownerUserId,
                    accountId,
                    cancellationToken);
                return Results.Ok(settings);
            })
            .WithTags("Imports")
            .RequireAuthorization();

        endpoints.MapDelete(
            "/api/accounts/{accountId:guid}/active-import-review",
            async (
                Guid accountId,
                ClaimsPrincipal principal,
                ImportReviewService importReviewService,
                CancellationToken cancellationToken) =>
            {
                var ownerUserId = principal.FindFirstValue(ClaimTypes.NameIdentifier);
                if (ownerUserId is null)
                {
                    return Results.Problem(statusCode: StatusCodes.Status401Unauthorized);
                }

                await importReviewService.CancelActiveAsync(ownerUserId, accountId, cancellationToken);
                return Results.NoContent();
            })
            .WithTags("Imports")
            .RequireAuthorization();

        endpoints.MapPost(
            "/api/accounts/{accountId:guid}/import-reviews",
            async (
                Guid accountId,
                HttpRequest request,
                ClaimsPrincipal principal,
                ImportReviewService importReviewService,
                CancellationToken cancellationToken) =>
            {
                var ownerUserId = principal.FindFirstValue(ClaimTypes.NameIdentifier);
                if (ownerUserId is null)
                {
                    return Results.Problem(statusCode: StatusCodes.Status401Unauthorized);
                }

                if (!request.HasFormContentType)
                {
                    throw InvalidMultipartRequest();
                }

                IFormCollection form;
                try
                {
                    form = await request.ReadFormAsync(cancellationToken);
                }
                catch (InvalidDataException)
                {
                    throw InvalidMultipartRequest();
                }

                var file = form.Files.GetFile("file");
                if (file is null)
                {
                    throw InvalidMultipartRequest();
                }

                ImportMapping? mapping;
                try
                {
                    mapping = JsonSerializer.Deserialize<ImportMapping>(
                        form["mapping"].ToString(),
                        JsonOptions);
                }
                catch (JsonException)
                {
                    throw InvalidMultipartRequest();
                }

                if (mapping is null)
                {
                    throw InvalidMultipartRequest();
                }

                await using var stream = file.OpenReadStream();
                var response = await importReviewService.CreateAsync(
                    ownerUserId,
                    accountId,
                    stream,
                    file.Length,
                    mapping,
                    cancellationToken);
                return Results.Created($"/api/import-reviews/{response.Id}", response);
            })
            .WithTags("Imports")
            .RequireAuthorization();

        endpoints.MapDelete(
            "/api/import-reviews/{reviewId:guid}",
            async (
                Guid reviewId,
                ClaimsPrincipal principal,
                ImportReviewService importReviewService,
                CancellationToken cancellationToken) =>
            {
                var ownerUserId = principal.FindFirstValue(ClaimTypes.NameIdentifier);
                if (ownerUserId is null)
                {
                    return Results.Problem(statusCode: StatusCodes.Status401Unauthorized);
                }

                await importReviewService.CancelAsync(ownerUserId, reviewId, cancellationToken);
                return Results.NoContent();
            })
            .WithTags("Imports")
            .RequireAuthorization();

        endpoints.MapPost(
            "/api/import-reviews/{reviewId:guid}/confirm",
            async (
                Guid reviewId,
                ConfirmImportRequest request,
                ClaimsPrincipal principal,
                ConfirmImportService confirmImportService,
                CancellationToken cancellationToken) =>
            {
                var ownerUserId = principal.FindFirstValue(ClaimTypes.NameIdentifier);
                if (ownerUserId is null)
                {
                    return Results.Problem(statusCode: StatusCodes.Status401Unauthorized);
                }

                var response = await confirmImportService.ConfirmAsync(
                    ownerUserId,
                    reviewId,
                    request.ConfirmPossibleDuplicates,
                    cancellationToken);
                return Results.Ok(response);
            })
            .WithTags("Imports")
            .RequireAuthorization();

        return endpoints;
    }

    private sealed record ConfirmImportRequest(bool ConfirmPossibleDuplicates);

    private static ApiProblemException InvalidMultipartRequest() =>
        new(
            StatusCodes.Status400BadRequest,
            "The import request is invalid.",
            "Provide a CSV file and a valid column mapping.");
}
