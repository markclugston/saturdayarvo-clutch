using System.Security.Claims;
using Clutch.API.Application.Imports;
using Clutch.API.Domain.Imports;
using Clutch.API.Infrastructure.Identity;

namespace Clutch.API.Api.Endpoints;

public static class AdminImportLimitEndpoints
{
    public static IEndpointRouteBuilder MapAdminImportLimitEndpoints(
        this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/admin/import-limits")
            .WithTags("Administration")
            .RequireAuthorization(policy =>
                policy.RequireRole(AdminBootstrapper.AdministratorRole));

        group.MapGet("", async (
            ImportLimitSettingsService settingsService,
            CancellationToken cancellationToken) =>
        {
            var limits = await settingsService.GetAsync(cancellationToken);
            return Results.Ok(ImportLimitsResponse.FromDomain(limits));
        });

        group.MapPut("", async (
            ImportLimitsRequest request,
            ClaimsPrincipal principal,
            ImportLimitSettingsService settingsService,
            CancellationToken cancellationToken) =>
        {
            var administratorUserId = principal.FindFirstValue(ClaimTypes.NameIdentifier);
            if (administratorUserId is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status401Unauthorized);
            }

            var limits = new ImportLimits(
                request.MaxFileSizeBytes,
                request.MaxRowsPerImport,
                request.MaxImportAttemptsPerUserPerMinute);
            var updated = await settingsService.UpdateAsync(
                limits,
                administratorUserId,
                cancellationToken);
            return Results.Ok(ImportLimitsResponse.FromDomain(updated));
        });

        return endpoints;
    }

    private sealed record ImportLimitsRequest(
        int MaxFileSizeBytes,
        int MaxRowsPerImport,
        int MaxImportAttemptsPerUserPerMinute);

    private sealed record ImportLimitsResponse(
        int MaxFileSizeBytes,
        int MaxRowsPerImport,
        int MaxImportAttemptsPerUserPerMinute)
    {
        public static ImportLimitsResponse FromDomain(ImportLimits limits) =>
            new(
                limits.MaxFileSizeBytes,
                limits.MaxRowsPerImport,
                limits.MaxImportAttemptsPerUserPerMinute);
    }
}
