using System.Globalization;
using System.Security.Claims;
using System.Text.Json;
using Clutch.API.Api.ProblemDetails;
using Clutch.API.Application.Mortgages;
using Clutch.API.Domain.Mortgages;

namespace Clutch.API.Api.Endpoints;

public static class MortgageEndpoints
{
    public const int MaximumRequestBytes = 32 * 1024;

    public static IEndpointRouteBuilder MapMortgageEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/mortgages")
            .WithTags("Mortgages")
            .RequireAuthorization();

        group.MapGet("", async (
            ClaimsPrincipal principal,
            MortgageService service,
            CancellationToken cancellationToken) =>
        {
            if (principal.FindFirstValue(ClaimTypes.NameIdentifier) is not { } ownerUserId)
            {
                return Results.Problem(statusCode: StatusCodes.Status401Unauthorized);
            }

            var mortgages = await service.ListAsync(ownerUserId, cancellationToken);
            return Results.Ok(mortgages.Select(MortgageResponse.From));
        });

        group.MapGet("/period-balances", async (
            string? accountId,
            string? drawdownDate,
            string? frequency,
            string? duration,
            ClaimsPrincipal principal,
            PeriodBalanceService service,
            CancellationToken cancellationToken) =>
        {
            if (principal.FindFirstValue(ClaimTypes.NameIdentifier) is not { } ownerUserId)
            {
                return Results.Problem(statusCode: StatusCodes.Status401Unauthorized);
            }

            if (!Guid.TryParse(accountId, out var id) || id == Guid.Empty)
            {
                throw new ApiProblemException(
                    StatusCodes.Status400BadRequest,
                    "The period balance request is invalid.",
                    "Correct the highlighted fields and try again.",
                    new Dictionary<string, string[]> { ["accountId"] = [MortgageValidator.AccountIdMessage] });
            }

            var result = await service.GetAsync(
                ownerUserId, id, drawdownDate, frequency, duration, cancellationToken);
            return Results.Ok(result);
        });

        group.MapPost("", async (
            MortgageRequest request,
            ClaimsPrincipal principal,
            MortgageService service,
            CancellationToken cancellationToken) =>
        {
            if (principal.FindFirstValue(ClaimTypes.NameIdentifier) is not { } ownerUserId)
            {
                return Results.Problem(statusCode: StatusCodes.Status401Unauthorized);
            }

            var mortgage = await service.CreateAsync(ownerUserId, request.ToCandidate(), cancellationToken);
            return Results.Created($"/api/mortgages/{mortgage.Id}", MortgageResponse.From(mortgage));
        }).WithMetadata(new Microsoft.AspNetCore.Mvc.RequestSizeLimitAttribute(MaximumRequestBytes));

        group.MapPut("/{id:guid}", async (
            Guid id,
            MortgageRequest request,
            ClaimsPrincipal principal,
            MortgageService service,
            CancellationToken cancellationToken) =>
        {
            if (principal.FindFirstValue(ClaimTypes.NameIdentifier) is not { } ownerUserId)
            {
                return Results.Problem(statusCode: StatusCodes.Status401Unauthorized);
            }

            if (request.Version is not { } version)
            {
                throw MissingVersion();
            }

            var mortgage = await service.UpdateAsync(
                ownerUserId,
                id,
                version,
                request.ToCandidate(),
                cancellationToken);
            return Results.Ok(MortgageResponse.From(mortgage));
        }).WithMetadata(new Microsoft.AspNetCore.Mvc.RequestSizeLimitAttribute(MaximumRequestBytes));

        group.MapDelete("/{id:guid}", async (
            Guid id,
            int? version,
            ClaimsPrincipal principal,
            MortgageService service,
            CancellationToken cancellationToken) =>
        {
            if (principal.FindFirstValue(ClaimTypes.NameIdentifier) is not { } ownerUserId)
            {
                return Results.Problem(statusCode: StatusCodes.Status401Unauthorized);
            }

            if (version is not { } expectedVersion)
            {
                throw MissingVersion();
            }

            await service.DeleteAsync(ownerUserId, id, expectedVersion, cancellationToken);
            return Results.NoContent();
        });

        return endpoints;
    }

    private static ApiProblemException MissingVersion() =>
        new(
            StatusCodes.Status400BadRequest,
            "The mortgage version is required.",
            "Provide the version of the mortgage you are changing.",
            new Dictionary<string, string[]> { ["version"] = ["Provide the mortgage version"] });

    // Numbers arrive as raw JSON and dates as text so a badly shaped value becomes a field error
    // from the validator rather than a generic JSON error.
    private sealed record MortgageRequest(
        string? Name,
        JsonElement? OpeningBalance,
        JsonElement? Duration,
        string? DrawdownDate,
        string? PaymentFrequency,
        List<RateChangeRequest?>? InterestRateChanges,
        int? Version,
        string? AccountId)
    {
        public MortgageCandidate ToCandidate() =>
            new(
                Name,
                ToDecimal(OpeningBalance),
                ToDecimal(Duration),
                DrawdownDate,
                PaymentFrequency,
                (InterestRateChanges ?? [])
                    .Select(change => change is null
                        ? new RateChangeCandidate(null, null)
                        : new RateChangeCandidate(ToDecimal(change.NewInterestRate), change.EffectiveDate))
                    .ToList(),
                AccountId);
    }

    private sealed record RateChangeRequest(JsonElement? NewInterestRate, string? EffectiveDate);

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

    private sealed record InterestRateChangeResponse(decimal NewInterestRate, string EffectiveDate);

    private sealed record MortgageResponse(
        Guid Id,
        string Name,
        decimal OpeningBalance,
        int Duration,
        string DrawdownDate,
        string PaymentFrequency,
        List<InterestRateChangeResponse> InterestRateChanges,
        int Version,
        Guid? AccountId)
    {
        public static MortgageResponse From(Mortgage mortgage) =>
            new(
                mortgage.Id,
                mortgage.Name,
                mortgage.OpeningBalance,
                mortgage.Duration,
                FormatDate(mortgage.DrawdownDate),
                mortgage.PaymentFrequency.ToString(),
                mortgage.InterestRateChanges
                    .OrderBy(change => change.EffectiveDate)
                    .Select(change => new InterestRateChangeResponse(
                        change.NewInterestRate,
                        FormatDate(change.EffectiveDate)))
                    .ToList(),
                mortgage.Version,
                mortgage.AccountId);
    }

    private static string FormatDate(DateOnly date) =>
        date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
}
