using System.Security.Claims;
using Clutch.API.Application.Accounts;
using Clutch.API.Domain.Accounts;
using Clutch.API.Domain.Shared;

namespace Clutch.API.Api.Endpoints;

public static class AccountEndpoints
{
    public static IEndpointRouteBuilder MapAccountEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/currencies", () =>
            Results.Ok(AccountService.GetCurrencies().Select(CurrencyResponse.FromDomain)))
            .WithTags("Accounts")
            .RequireAuthorization();

        var group = endpoints.MapGroup("/api/accounts")
            .WithTags("Accounts")
            .RequireAuthorization();

        group.MapGet("", async (
            ClaimsPrincipal principal,
            AccountService accountService,
            CancellationToken cancellationToken) =>
        {
            var ownerUserId = principal.FindFirstValue(ClaimTypes.NameIdentifier);
            if (ownerUserId is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status401Unauthorized);
            }

            var accounts = await accountService.GetOwnedAccountsAsync(ownerUserId, cancellationToken);
            return Results.Ok(accounts.Select(AccountResponse.FromDomain));
        });

        group.MapPost("", async (
            CreateAccountRequest request,
            ClaimsPrincipal principal,
            AccountService accountService,
            CancellationToken cancellationToken) =>
        {
            var ownerUserId = principal.FindFirstValue(ClaimTypes.NameIdentifier);
            if (ownerUserId is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status401Unauthorized);
            }

            var account = await accountService.CreateAsync(
                ownerUserId,
                request.Description,
                request.CurrencyCode,
                cancellationToken);
            return Results.Created(
                $"/api/accounts/{account.Id}",
                AccountResponse.FromDomain(account));
        });

        group.MapGet("/{accountId:guid}", async (
            Guid accountId,
            ClaimsPrincipal principal,
            AccountService accountService,
            CancellationToken cancellationToken) =>
        {
            var ownerUserId = principal.FindFirstValue(ClaimTypes.NameIdentifier);
            if (ownerUserId is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status401Unauthorized);
            }

            var account = await accountService.GetOwnedAsync(ownerUserId, accountId, cancellationToken);
            return account is null
                ? Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Account not found.")
                : Results.Ok(AccountResponse.FromDomain(account));
        });

        group.MapPatch("/{accountId:guid}", async (
            Guid accountId,
            UpdateAccountDescriptionRequest request,
            ClaimsPrincipal principal,
            AccountService accountService,
            CancellationToken cancellationToken) =>
        {
            var ownerUserId = principal.FindFirstValue(ClaimTypes.NameIdentifier);
            if (ownerUserId is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status401Unauthorized);
            }

            var account = await accountService.UpdateDescriptionAsync(
                ownerUserId,
                accountId,
                request.Description,
                cancellationToken);
            return Results.Ok(AccountResponse.FromDomain(account));
        });

        return endpoints;
    }

    private sealed record CreateAccountRequest(string? Description, string? CurrencyCode);

    private sealed record UpdateAccountDescriptionRequest(string? Description);

    private sealed record AccountResponse(
        Guid Id,
        string Description,
        string CurrencyCode,
        DateTimeOffset? LastSuccessfulImportAtUtc)
    {
        public static AccountResponse FromDomain(Account account) =>
            new(
                account.Id,
                account.Description,
                account.CurrencyCode,
                account.LastSuccessfulImportAtUtc);
    }

    private sealed record CurrencyResponse(
        string Code,
        string Name,
        IReadOnlyList<CurrencyAmountFormatResponse> AmountFormats)
    {
        public static CurrencyResponse FromDomain(Currency currency) =>
            new(
                currency.Code,
                currency.Name,
                CurrencyAmountFormatRegistry.GetFormats(currency.Code)
                    .Select(CurrencyAmountFormatResponse.FromDomain)
                    .ToArray());
    }

    private sealed record CurrencyAmountFormatResponse(
        string Id,
        string DecimalSeparator,
        string GroupSeparator,
        string Reference,
        string Version)
    {
        public static CurrencyAmountFormatResponse FromDomain(CurrencyAmountFormat format) =>
            new(
                format.Id,
                format.DecimalSeparator,
                format.GroupSeparator,
                format.Reference,
                format.Version);
    }
}
