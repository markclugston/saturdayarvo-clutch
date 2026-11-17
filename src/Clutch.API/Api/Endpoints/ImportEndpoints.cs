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

        endpoints.MapGet(
            "/api/accounts/{accountId:guid}/import-status",
            async (
                Guid accountId,
                Guid? reviewId,
                ClaimsPrincipal principal,
                HttpContext context,
                ImportStateService importStateService,
                CancellationToken cancellationToken) =>
            {
                context.Response.Headers.CacheControl = "no-store";
                var ownerUserId = principal.FindFirstValue(ClaimTypes.NameIdentifier);
                if (ownerUserId is null)
                {
                    return Results.Problem(statusCode: StatusCodes.Status401Unauthorized);
                }

                var outcome = await importStateService.GetStatusAsync(
                    ownerUserId,
                    accountId,
                    reviewId,
                    cancellationToken);
                if (!outcome.IsSuccess)
                {
                    throw CoordinationProblem(outcome.Error!.Value);
                }

                return Results.Ok(outcome.Value);
            })
            .WithTags("Imports")
            .RequireAuthorization();

        endpoints.MapDelete(
            "/api/accounts/{accountId:guid}/active-import-review",
            async (
                Guid accountId,
                string? reviewId,
                ClaimsPrincipal principal,
                ImportReviewService importReviewService,
                CancellationToken cancellationToken) =>
            {
                var ownerUserId = principal.FindFirstValue(ClaimTypes.NameIdentifier);
                if (ownerUserId is null)
                {
                    return Results.Problem(statusCode: StatusCodes.Status401Unauthorized);
                }

                if (!Guid.TryParse(reviewId, out var targetReviewId) || targetReviewId == Guid.Empty)
                {
                    throw ImportTargetRequired();
                }

                var outcome = await importReviewService.EndReviewElsewhereAsync(
                    ownerUserId,
                    accountId,
                    targetReviewId,
                    cancellationToken);
                if (!outcome.IsSuccess)
                {
                    throw CoordinationProblem(outcome.Error!.Value);
                }

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

    private static ApiProblemException CoordinationProblem(ImportCoordinationError error) =>
        error switch
        {
            ImportCoordinationError.AccountNotFound or ImportCoordinationError.ReviewNotFound =>
                new ApiProblemException(
                    StatusCodes.Status404NotFound,
                    "Import status not found.",
                    "The account or watched import does not exist or is not available to this user."),
            ImportCoordinationError.ImportNotEndable =>
                new ApiProblemException(
                    StatusCodes.Status409Conflict,
                    "The import is already being processed.",
                    "Once confirmation has been accepted, an import cannot be ended.",
                    new Dictionary<string, string[]> { ["code"] = ["ImportNotEndable"] }),
            ImportCoordinationError.ImportChanged or ImportCoordinationError.ImportExpired =>
                new ApiProblemException(
                    StatusCodes.Status409Conflict,
                    "The import has changed.",
                    "Recheck the account import status before continuing.",
                    new Dictionary<string, string[]> { ["code"] = ["ImportChanged"] }),
            ImportCoordinationError.ImportEndedElsewhere =>
                new ApiProblemException(
                    StatusCodes.Status409Conflict,
                    "The import was ended elsewhere.",
                    "Return to the account's transactions before continuing.",
                    new Dictionary<string, string[]> { ["code"] = ["ImportEndedElsewhere"] }),
            ImportCoordinationError.ImportOutcomeUnknown =>
                new ApiProblemException(
                    StatusCodes.Status500InternalServerError,
                    "The import outcome could not be verified.",
                    "Recheck the account import status before continuing.",
                    new Dictionary<string, string[]> { ["code"] = ["ImportOutcomeUnknown"] }),
            ImportCoordinationError.EndingIdentityUnavailable =>
                new ApiProblemException(
                    StatusCodes.Status500InternalServerError,
                    "Import status is unavailable.",
                    "The ending user's identity could not be resolved.",
                    new Dictionary<string, string[]> { ["code"] = ["ImportStatusUnavailable"] }),
            _ =>
                new ApiProblemException(
                    StatusCodes.Status500InternalServerError,
                    "Import status is unavailable.",
                    "The current import status could not be established.",
                    new Dictionary<string, string[]> { ["code"] = ["ImportStatusUnavailable"] }),
        };

    private static ApiProblemException ImportTargetRequired() =>
        new(
            StatusCodes.Status400BadRequest,
            "An import review target is required.",
            "Provide the exact review ID returned by import status.",
            new Dictionary<string, string[]> { ["code"] = ["ImportTargetRequired"] });
}
